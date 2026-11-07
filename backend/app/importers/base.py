"""导入器框架：列定义、文件解析、类型转换与通用校验。

错误结构统一为 {row, column, message}，row 为文件真实行号（表头为第 1 行）。
"""

from __future__ import annotations

import csv
import io
import re
from dataclasses import dataclass, field
from datetime import date, datetime
from pathlib import Path

UNIT_SUFFIX_RE = re.compile(r"[（(](万元|元|人次|元/人次|份|人|%)[）)]\s*$")
PERIOD_RE = re.compile(r"^\d{4}-(0[1-9]|1[0-2])$")


def normalize_header(value) -> str:
    text = str(value or "").strip()
    text = UNIT_SUFFIX_RE.sub("", text).strip()
    text = text.replace("&", "").replace("＆", "")
    text = re.sub(r"\s+", "", text)
    return text


@dataclass
class Column:
    name: str
    kind: str = "text"  # text / float / int / period / bool
    required: bool = False
    enum: tuple[str, ...] | None = None
    min_value: float | None = None
    max_value: float | None = None
    aliases: tuple[str, ...] = ()
    note: str = ""

    def matches(self, header: str) -> bool:
        normalized = normalize_header(header)
        if normalize_header(self.name) == normalized:
            return True
        return any(normalize_header(alias) == normalized for alias in self.aliases)


@dataclass
class DatasetSpec:
    key: str
    name: str
    columns: list[Column]
    example: dict
    description: str = ""
    allow_dynamic_accounts: bool = False
    required_columns_missing_hint: str = ""
    extra: dict = field(default_factory=dict)

    @property
    def column_names(self) -> list[str]:
        return [column.name for column in self.columns]

    def find_column(self, header: str) -> Column | None:
        for column in self.columns:
            if column.matches(header):
                return column
        return None

    def find_by_name(self, name: str) -> Column | None:
        for column in self.columns:
            if column.name == name:
                return column
        return None


def error(row: int, column: str, message: str) -> dict:
    return {"row": row, "column": column, "message": message}


def _read_matrix(filename: str, content: bytes) -> list[list]:
    suffix = Path(filename or "").suffix.lower()
    if suffix in (".xlsx", ".xlsm"):
        from openpyxl import load_workbook

        workbook = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = workbook[workbook.sheetnames[0]]
        matrix: list[list] = []
        for row in sheet.iter_rows(values_only=True):
            matrix.append(list(row))
        workbook.close()
        return matrix
    if suffix in (".csv", ".txt"):
        text = content.decode("utf-8-sig")
        return [row for row in csv.reader(io.StringIO(text))]
    raise ValueError(f"不支持的文件类型：{suffix or '未知'}（仅支持 .xlsx / .csv）")


def _to_float(value, column: Column) -> float | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        raise ValueError("不能是布尔值")
    if isinstance(value, (int, float)):
        number = float(value)
    else:
        text = str(value).strip().replace(",", "").replace("，", "")
        if text.endswith("%"):
            text = str(float(text[:-1]) / 100)
        try:
            number = float(text)
        except ValueError as exc:
            raise ValueError(f"必须是数字（当前为「{value}」）") from exc
    if column.min_value is not None and number < column.min_value:
        if column.min_value == 0:
            raise ValueError("不能为负数")
        raise ValueError(f"不能小于 {column.min_value}")
    if column.max_value is not None and number > column.max_value:
        raise ValueError(f"不能大于 {column.max_value}")
    return number


def _to_int(value, column: Column) -> int | None:
    number = _to_float(value, column)
    if number is None:
        return None
    if abs(number - round(number)) > 1e-9:
        raise ValueError(f"必须是整数（当前为「{value}」）")
    return int(round(number))


def _to_bool(value) -> bool | None:
    if value is None or value == "":
        return None
    if isinstance(value, bool):
        return value
    text = str(value).strip().lower()
    if text in ("是", "true", "1", "y", "yes", "套餐", "√"):
        return True
    if text in ("否", "false", "0", "n", "no", "单品", "×"):
        return False
    raise ValueError(f"必须是 是/否（当前为「{value}」）")


def _to_period(value) -> str:
    if value is None or value == "":
        raise ValueError("期间不能为空")
    if isinstance(value, (datetime, date)):
        return value.strftime("%Y-%m")
    text = str(value).strip()
    if PERIOD_RE.match(text):
        return text
    raise ValueError(f"期间格式必须为 YYYY-MM（如 2025-09，当前为「{value}」）")


def convert_value(value, column: Column):
    if column.kind == "period":
        return _to_period(value)
    if column.kind == "float":
        return _to_float(value, column)
    if column.kind == "int":
        return _to_int(value, column)
    if column.kind == "bool":
        return _to_bool(value)
    if value is None:
        return None
    text = str(value).strip()
    if column.enum and text and text not in column.enum:
        raise ValueError(f"必须是 {'/'.join(column.enum)} 之一（当前为「{text}」）")
    return text or None


def parse_table(
    spec: DatasetSpec,
    filename: str,
    content: bytes,
    account_mapping: dict[str, str] | None = None,
) -> tuple[list[dict], list[dict], list[dict]]:
    """解析文件为行字典，返回 (rows, errors, warnings)。

    rows 中每行带 `_row`（文件行号）；动态科目列（利润表额外科目）以 "__account__::<表头>" 存放。
    """
    try:
        matrix = _read_matrix(filename, content)
    except ValueError as exc:
        return [], [error(1, "文件", str(exc))], []
    errors: list[dict] = []
    warnings: list[dict] = []

    header_index = None
    for index, row in enumerate(matrix):
        if any(str(cell).strip() for cell in row if cell is not None):
            header_index = index
            break
    if header_index is None:
        return [], [error(1, "文件", "文件为空，没有表头")], []

    headers = matrix[header_index]
    mapping: dict[int, Column] = {}
    dynamic_columns: dict[int, str] = {}
    for index, raw_header in enumerate(headers):
        if raw_header is None or str(raw_header).strip() == "":
            continue
        column = spec.find_column(str(raw_header))
        if column is not None:
            mapping[index] = column
            continue
        if account_mapping and str(raw_header).strip() in account_mapping:
            dynamic_columns[index] = account_mapping[str(raw_header).strip()]
            continue
        if spec.allow_dynamic_accounts:
            dynamic_columns[index] = str(raw_header).strip()
            continue
        suggestion = _suggest(str(raw_header), spec.column_names)
        errors.append(
            error(
                header_index + 1,
                str(raw_header).strip(),
                f"列名不在模板内，最接近的标准字段：{suggestion}",
            )
        )

    present = {column.name for column in mapping.values()}
    for column in spec.columns:
        if column.required and column.name not in present:
            errors.append(
                error(header_index + 1, column.name, f"缺少必填列「{column.name}」")
            )

    rows: list[dict] = []
    for row_offset in range(header_index + 1, len(matrix)):
        raw_row = matrix[row_offset]
        cells = [str(cell).strip() for cell in raw_row if cell is not None and str(cell).strip() != ""]
        if not cells:
            continue
        if cells[0].startswith("说明："):
            continue
        row_number = row_offset + 1
        values: dict = {"_row": row_number}
        row_error = False
        for index, column in mapping.items():
            value = raw_row[index] if index < len(raw_row) else None
            try:
                values[column.name] = convert_value(value, column)
            except ValueError as exc:
                errors.append(error(row_number, column.name, str(exc)))
                row_error = True
                continue
            if column.required and values[column.name] in (None, ""):
                errors.append(error(row_number, column.name, f"「{column.name}」为必填项"))
                row_error = True
        for index, account_name in dynamic_columns.items():
            value = raw_row[index] if index < len(raw_row) else None
            if value is None or str(value).strip() == "":
                continue
            try:
                values[f"__account__::{account_name}"] = float(str(value).replace(",", ""))
            except ValueError:
                values[f"__account__::{account_name}"] = value
        if not row_error:
            rows.append(values)
    return rows, errors, warnings


def _suggest(header: str, candidates: list[str], n: int = 3) -> str:
    """返回最接近的标准字段（带「」），供错误提示列出候选。"""
    import difflib

    matches = difflib.get_close_matches(header, candidates, n=n, cutoff=0.0)
    if not matches:
        matches = candidates[:n]
    return "、".join(f"「{item}」" for item in matches)
