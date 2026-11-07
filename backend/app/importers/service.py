"""导入服务：两阶段提交（draft → commit / rollback）、覆盖提示、模板生成。

- 上传阶段：解析 + 校验 + 预览 + 覆盖提示，结果落在 import_batch（status=draft）；
- 确认阶段：把 draft 的行写入事实表，并把同数据集同键的旧行标记 superseded_by（不物理删除）；
- 回滚：删除该批次写入的行，并把被它覆盖的旧行恢复。
"""

from __future__ import annotations

import io
import json
import re
from app.models.common import utcnow

from sqlalchemy import delete, or_, select, update
from sqlalchemy.orm import Session

from app.config import settings
from app.importers.base import DatasetSpec, error, parse_table
from app.importers.registry import (
    DATASETS,
    DATASET_ORDER,
    TARGET_CHANNEL_ALIASES,
    dataset_spec,
)
from app.models import (
    Account,
    BudgetFact,
    Channel,
    ChannelRevenueFact,
    DaypartFact,
    FunnelFact,
    ImportBatch,
    PLFact,
    Product,
    ProductSalesFact,
    ProductSeries,
    Store,
    StoreRevenueFact,
    TargetFact,
)

ALL_STORES = ("全部", "", None)
TIME_SLOT_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")


class ImportError_(Exception):
    """导入业务错误（API 层转 400）。"""


class ImportContext:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.stores = {row.name: row for row in session.scalars(select(Store))}
        self.accounts = {row.name: row for row in session.scalars(select(Account))}
        self.channels = {row.name: row for row in session.scalars(select(Channel))}
        self.series = {row.name: row for row in session.scalars(select(ProductSeries))}
        self.products = {row.name: row for row in session.scalars(select(Product))}

    def store_id(self, name: str | None) -> int | None:
        if name in ALL_STORES:
            return None
        return self.stores[name].id

    def store_name(self, store_id: int | None) -> str:
        if store_id is None:
            return "全部"
        for name, store in self.stores.items():
            if store.id == store_id:
                return name
        return "全部"


# ---------------------------------------------------------------------------
# 上传 / 校验
# ---------------------------------------------------------------------------
def stage_import(
    session: Session,
    dataset: str,
    filename: str,
    content: bytes,
    operator: str = "admin",
    account_mapping: dict[str, str] | None = None,
) -> ImportBatch:
    spec = dataset_spec(dataset)
    ctx = ImportContext(session)
    rows, errors, warnings = parse_table(spec, filename, content, account_mapping)
    if not errors:
        validation_errors, validation_warnings = _validate(session, spec, rows, ctx, account_mapping)
        errors.extend(validation_errors)
        warnings.extend(validation_warnings)

    batch = ImportBatch(
        dataset=spec.key,
        dataset_name=spec.name,
        filename=filename,
        row_count=0,
        operator=operator,
        status="draft",
        errors_json=json.dumps(errors, ensure_ascii=False),
        warnings_json=json.dumps(warnings, ensure_ascii=False),
        payload_json=json.dumps(rows, ensure_ascii=False) if not errors else "[]",
    )
    if rows:
        periods = sorted({row.get("期间") for row in rows if row.get("期间")})
        batch.period_from = periods[0] if periods else None
        batch.period_to = periods[-1] if periods else None
    if not errors:
        batch.coverage_json = json.dumps(_coverage(session, spec.key, rows, ctx), ensure_ascii=False)
        batch.preview_json = json.dumps(_preview(rows), ensure_ascii=False)
    session.add(batch)
    session.commit()
    return batch


def _preview(rows: list[dict], limit: int = 50) -> list[dict]:
    preview: list[dict] = []
    for row in rows[:limit]:
        item: dict = {"行号": row.get("_row")}
        for key, value in row.items():
            if key == "_row":
                continue
            item[key.split("::", 1)[1] if key.startswith("__account__::") else key] = value
        preview.append(item)
    return preview


def _validate(
    session: Session,
    spec: DatasetSpec,
    rows: list[dict],
    ctx: ImportContext,
    account_mapping: dict[str, str] | None,
) -> tuple[list[dict], list[dict]]:
    errors: list[dict] = []
    warnings: list[dict] = []
    handler = {
        "pl_monthly": _validate_pl,
        "store_revenue": _validate_store_revenue,
        "channel_revenue": _validate_channel_revenue,
        "product_series": _validate_product_series,
        "product_item": _validate_product_item,
        "funnel": _validate_funnel,
        "daypart": _validate_daypart,
        "budget_target": _validate_budget_target,
    }[spec.key]
    handler(rows, ctx, errors, warnings, account_mapping)
    return errors, warnings


def _resolve_store(row: dict, ctx: ImportContext, errors: list[dict]) -> int | None:
    name = row.get("门店")
    if name in ALL_STORES:
        return None
    if name not in ctx.stores:
        errors.append(error(row["_row"], "门店", f"门店「{name}」不存在"))
        return None
    return ctx.stores[name].id


def _duplicate_keys(rows: list[dict], key_fn, errors: list[dict], columns: tuple[str, ...]) -> None:
    seen: dict = {}
    for row in rows:
        key = key_fn(row)
        if key in seen:
            errors.append(
                error(row["_row"], "/".join(columns), f"与第 {seen[key]} 行重复（同期间同门店同键）")
            )
        else:
            seen[key] = row["_row"]


def _validate_pl(
    rows: list[dict], ctx: ImportContext, errors: list[dict], warnings: list[dict], mapping
) -> None:
    standard = list(ctx.accounts)
    periods: dict[tuple, set[str]] = {}
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        row["_store_id"] = store_id
        account_amounts: dict[str, float] = {}
        for column in ("营业收入", "食材成本", "优惠及手续费", "水电气低值", "宣传费用", "工资奖金", "宿舍房租", "店铺房租", "其它费用", "税金及附加"):
            value = row.get(column)
            if value is not None:
                account_amounts[column] = float(value)
        for key, value in list(row.items()):
            if not key.startswith("__account__::"):
                continue
            raw_name = key.split("::", 1)[1]
            account_name = (mapping or {}).get(raw_name, raw_name)
            if account_name not in ctx.accounts:
                from app.importers.base import _suggest

                errors.append(
                    error(
                        row["_row"],
                        raw_name,
                        f"科目「{raw_name}」不在标准科目表内，最接近的标准科目：{_suggest(account_name, standard)}；"
                        "可通过科目映射指定后再导入",
                    )
                )
                continue
            account_amounts[account_name] = float(value)
        row["_accounts"] = account_amounts
        period = row.get("期间")
        periods.setdefault((period, store_id), set()).update(account_amounts)

    seen_accounts: dict[tuple, int] = {}
    for row in rows:
        for account_name in (row.get("_accounts") or {}):
            key = (row.get("期间"), row.get("_store_id"), account_name)
            if key in seen_accounts:
                errors.append(
                    error(
                        row["_row"],
                        account_name,
                        f"科目「{account_name}」与第 {seen_accounts[key]} 行重复（同期间同门店同科目）",
                    )
                )
            else:
                seen_accounts[key] = row["_row"]
    for (period, store_id), accounts in periods.items():
        missing = [name for name in settings.standard_accounts if name not in accounts and name != "税金及附加"]
        if missing:
            warnings.append(
                error(
                    1,
                    "科目",
                    f"期间 {period}（{ctx.store_name(store_id)}）缺少科目：{'、'.join(missing)}，利润桥可能不完整",
                )
            )


def _validate_store_revenue(rows, ctx, errors, warnings, mapping) -> None:
    _duplicate_keys(
        rows,
        lambda row: (row.get("期间"), row.get("门店")),
        errors,
        ("期间", "门店"),
    )
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        if store_id is None:
            errors.append(error(row["_row"], "门店", "门店收入必须指定具体门店，不能填「全部」"))
            continue
        row["_store_id"] = store_id
        store = ctx.stores[row["门店"]]
        for field, expected, label in (
            ("区域", store.region, "区域"),
            ("经营模式", store.business_model, "经营模式"),
            ("店型", store.store_type, "店型"),
        ):
            value = row.get(field)
            if value and value != expected:
                warnings.append(
                    error(row["_row"], field, f"{label}「{value}」与门店档案「{expected}」不一致，以门店档案为准")
                )
        revenue = float(row.get("营业收入（万元）") or 0)
        traffic = float(row.get("客流（人次）") or 0)
        declared = row.get("客单价（元）")
        if revenue and traffic:
            computed = revenue * 10000 / traffic
            if declared is not None and declared > 0:
                gap = abs(computed - declared) / declared
                if gap > 0.01:
                    warnings.append(
                        error(
                            row["_row"],
                            "客单价（元）",
                            f"申报客单价 {declared:.2f} 与收入/客流反算 {computed:.2f} 差异 {gap * 100:.1f}%，超过 1%",
                        )
                    )
            if not declared:
                row["客单价（元）"] = round(computed, 2)


def _validate_channel_revenue(rows, ctx, errors, warnings, mapping) -> None:
    _duplicate_keys(
        rows,
        lambda row: (row.get("期间"), row.get("门店"), row.get("渠道")),
        errors,
        ("期间", "门店", "渠道"),
    )
    staged: dict[tuple, float] = {}
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        row["_store_id"] = store_id
        channel_name = row.get("渠道")
        if channel_name not in ctx.channels:
            import difflib

            suggestion = difflib.get_close_matches(channel_name, list(ctx.channels), n=1, cutoff=0.2)
            errors.append(
                error(
                    row["_row"],
                    "渠道",
                    f"渠道「{channel_name}」不在渠道清单内，最接近的是「{suggestion[0] if suggestion else '美团大众'}」",
                )
            )
            continue
        channel = ctx.channels[channel_name]
        row["_channel_id"] = channel.id
        category = row.get("渠道大类")
        if category and category != channel.category:
            warnings.append(
                error(row["_row"], "渠道大类", f"渠道「{channel_name}」大类应为「{channel.category}」，已按渠道清单纠正")
            )
        staged[(row.get("期间"), store_id)] = staged.get((row.get("期间"), store_id), 0.0) + float(row.get("收入（万元）") or 0)

    for (period, store_id), channel_total in staged.items():
        store_total = session_store_total(ctx.session, period, store_id)
        if store_total:
            gap = abs(channel_total - store_total) / store_total
            if gap > 0.01:
                warnings.append(
                    error(
                        1,
                        "收入（万元）",
                        f"{period} 渠道合计 {channel_total:.2f} 万与门店收入 {store_total:.2f} 万相差 {gap * 100:.1f}%，超过 1%",
                    )
                )


def session_store_total(session: Session, period: str, store_id: int | None) -> float:
    conditions = [StoreRevenueFact.period == period, StoreRevenueFact.superseded_by.is_(None)]
    if store_id is None:
        stmt = select(StoreRevenueFact.revenue).where(*conditions)
    else:
        stmt = select(StoreRevenueFact.revenue).where(*conditions, StoreRevenueFact.store_id == store_id)
    return float(sum(value or 0 for value in session.scalars(stmt)))


def _validate_product_series(rows, ctx, errors, warnings, mapping) -> None:
    _duplicate_keys(
        rows,
        lambda row: (row.get("期间"), row.get("门店"), row.get("产品系列")),
        errors,
        ("期间", "门店", "产品系列"),
    )
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        row["_store_id"] = store_id
        series_name = row.get("产品系列")
        if series_name not in ctx.series:
            # 产品系列可由导入自动扩充（维度表），此处只记录提示
            warnings.append(error(row["_row"], "产品系列", f"产品系列「{series_name}」不存在，导入时自动新增"))
        amount = float(row.get("销售额（元）") or 0)
        dish = float(row.get("菜品收入（元）") or 0)
        discount = float(row.get("菜品优惠（元）") or 0)
        if amount and dish + discount:
            gap = abs(dish + discount - amount) / amount
            if gap > 0.01:
                warnings.append(
                    error(
                        row["_row"],
                        "菜品收入（元）",
                        f"菜品收入+菜品优惠 = {dish + discount:.2f} 与销售额 {amount:.2f} 相差 {gap * 100:.1f}%，超过 1%",
                    )
                )


def _validate_product_item(rows, ctx, errors, warnings, mapping) -> None:
    _duplicate_keys(
        rows,
        lambda row: (row.get("期间"), row.get("门店"), row.get("产品名称")),
        errors,
        ("期间", "门店", "产品名称"),
    )
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        row["_store_id"] = store_id
        is_set = bool(row.get("是否套餐"))
        row["是否套餐"] = is_set
        series_name = row.get("产品系列")
        if series_name:
            if series_name not in ctx.series:
                from app.importers.base import _suggest

                errors.append(
                    error(
                        row["_row"],
                        "产品系列",
                        f"产品系列「{series_name}」必须已存在，最接近的系列：{_suggest(series_name, list(ctx.series))}",
                    )
                )
            else:
                row["_series_id"] = ctx.series[series_name].id
        elif not is_set:
            errors.append(error(row["_row"], "产品系列", "单品必须指定已存在的产品系列（套餐可留空）"))
        amount = float(row.get("销售额（元）") or 0)
        dish = float(row.get("菜品收入（元）") or 0)
        discount = float(row.get("菜品优惠（元）") or 0)
        if amount and dish + discount and abs(dish + discount - amount) / amount > 0.01:
            warnings.append(
                error(
                    row["_row"],
                    "菜品收入（元）",
                    f"菜品收入+菜品优惠 = {dish + discount:.2f} 与销售额 {amount:.2f} 相差超过 1%",
                )
            )


def _validate_funnel(rows, ctx, errors, warnings, mapping) -> None:
    _duplicate_keys(
        rows,
        lambda row: (row.get("期间"), row.get("门店"), row.get("渠道")),
        errors,
        ("期间", "门店", "渠道"),
    )
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        row["_store_id"] = store_id
        channel_name = row.get("渠道")
        if channel_name not in ctx.channels:
            errors.append(error(row["_row"], "渠道", f"渠道「{channel_name}」不在渠道清单内"))
            continue
        row["_channel_id"] = ctx.channels[channel_name].id
        levels = [
            ("曝光人数", row.get("曝光人数")),
            ("访问人数", row.get("访问人数")),
            ("支付人数", row.get("支付人数")),
            ("消费人数", row.get("消费人数")),
        ]
        if all(value is None for _, value in levels):
            errors.append(error(row["_row"], "曝光人数", "漏斗至少需要填写曝光人数"))
            continue
        previous_name, previous_value = None, None
        for name, value in levels:
            if value is None:
                continue
            if previous_value is not None and value > previous_value:
                errors.append(
                    error(row["_row"], name, f"漏斗必须逐级递减：{name} {value:.0f} 大于 {previous_name} {previous_value:.0f}")
                )
            previous_name, previous_value = name, value


def _validate_daypart(rows, ctx, errors, warnings, mapping) -> None:
    _duplicate_keys(
        rows,
        lambda row: (row.get("期间"), row.get("门店"), row.get("日类型"), row.get("时段")),
        errors,
        ("期间", "门店", "日类型", "时段"),
    )
    sums: dict[tuple, float] = {}
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        if store_id is None:
            errors.append(error(row["_row"], "门店", "时段客流必须指定具体门店"))
            continue
        row["_store_id"] = store_id
        slot = str(row.get("时段") or "").replace("：", ":").strip()
        match = TIME_SLOT_RE.match(slot)
        if not match:
            errors.append(error(row["_row"], "时段", f"时段格式应为 9:00-14:00（当前为「{row.get('时段')}」）"))
        else:
            h1, m1, h2, m2 = match.groups()
            row["时段"] = f"{int(h1)}:{m1}-{int(h2)}:{m2}"
        sums[(row.get("期间"), store_id, row.get("日类型"))] = sums.get(
            (row.get("期间"), store_id, row.get("日类型")), 0.0
        ) + float(row.get("客流") or 0)

    for (period, store_id, day_type), total in sums.items():
        traffic = _store_traffic(ctx.session, period, store_id)
        if traffic:
            # 工作日 / 节假日 各自与门店客流比较无意义，这里比较「同期间同门店」全部时段合计
            pass
    for period in {row.get("期间") for row in rows}:
        for store_id in {row.get("_store_id") for row in rows}:
            if store_id is None:
                continue
            total = sum(
                float(row.get("客流") or 0)
                for row in rows
                if row.get("期间") == period and row.get("_store_id") == store_id
            )
            traffic = _store_traffic(ctx.session, period, store_id)
            if traffic and abs(total - traffic) / traffic > 0.01:
                warnings.append(
                    error(
                        1,
                        "客流",
                        f"{period} {ctx.store_name(store_id)} 时段客流合计 {total:.0f} 与门店客流 {traffic:.0f} 相差超过 1%",
                    )
                )


def _store_traffic(session: Session, period: str, store_id: int) -> float | None:
    value = session.scalar(
        select(StoreRevenueFact.traffic).where(
            StoreRevenueFact.period == period,
            StoreRevenueFact.store_id == store_id,
            StoreRevenueFact.superseded_by.is_(None),
        )
    )
    return float(value) if value else None


def _validate_budget_target(rows, ctx, errors, warnings, mapping) -> None:
    budget_seen: dict = {}
    target_seen: dict = {}
    for row in rows:
        store_id = _resolve_store(row, ctx, errors)
        row["_store_id"] = store_id
        period = row.get("期间")
        if row.get("科目") or row.get("预算值（万元）") is not None:
            account_name = row.get("科目")
            if account_name not in ctx.accounts:
                errors.append(error(row["_row"], "科目", f"预算科目「{account_name}」不在标准科目表内"))
                continue
            if row.get("预算值（万元）") is None:
                errors.append(error(row["_row"], "预算值（万元）", "预算行必须填写预算值"))
                continue
            key = (period, store_id, account_name)
            if key in budget_seen:
                errors.append(error(row["_row"], "科目", f"与第 {budget_seen[key]} 行重复"))
            budget_seen[key] = row["_row"]
            row["_row_type"] = "budget"
            row["_account_id"] = ctx.accounts[account_name].id
        elif row.get("渠道"):
            channel_name = TARGET_CHANNEL_ALIASES.get(row["渠道"], row["渠道"])
            if channel_name not in ctx.channels:
                errors.append(error(row["_row"], "渠道", f"目标渠道「{row['渠道']}」无法映射到渠道清单"))
                continue
            if row.get("目标ROI") is None or float(row.get("目标ROI") or 0) <= 0:
                errors.append(error(row["_row"], "目标ROI", "目标行必须填写大于 0 的目标 ROI"))
                continue
            key = (period, channel_name)
            if key in target_seen:
                errors.append(error(row["_row"], "渠道", f"与第 {target_seen[key]} 行重复"))
            target_seen[key] = row["_row"]
            row["_row_type"] = "target"
            row["_channel_id"] = ctx.channels[channel_name].id
        else:
            errors.append(error(row["_row"], "科目", "每行必须填写「科目+预算值」或「渠道+目标字段」"))


# ---------------------------------------------------------------------------
# 覆盖提示
# ---------------------------------------------------------------------------
def _coverage(session: Session, dataset: str, rows: list[dict], ctx: ImportContext) -> list[dict]:
    groups: dict[tuple[str, int | None], int] = {}
    for row in rows:
        key = (row.get("期间"), row.get("_store_id"))
        groups[key] = groups.get(key, 0) + 1
    coverage: list[dict] = []
    for (period, store_id), count in sorted(groups.items(), key=lambda item: (item[0][0], str(item[0][1]))):
        if _has_existing(session, dataset, period, store_id, ctx):
            coverage.append(
                {
                    "period": period,
                    "store": ctx.store_name(store_id),
                    "rows": count,
                    "message": f"将覆盖 {ctx.store_name(store_id)} {period} 的 {title_of(dataset)} 数据",
                }
            )
    return coverage


def title_of(dataset: str) -> str:
    return DATASETS[dataset].name if dataset in DATASETS else dataset


def _has_existing(session: Session, dataset: str, period: str, store_id: int | None, ctx: ImportContext) -> bool:
    def exists(model, conditions) -> bool:
        return session.scalar(select(model.id).where(*conditions, model.superseded_by.is_(None)).limit(1)) is not None

    if dataset == "pl_monthly":
        conditions = [PLFact.period == period, PLFact.scenario == "actual"]
        if store_id is None:
            conditions.append(PLFact.store_id.is_(None))
        else:
            conditions.append(PLFact.store_id == store_id)
        return exists(PLFact, conditions)
    if dataset == "store_revenue":
        return exists(StoreRevenueFact, [StoreRevenueFact.period == period, StoreRevenueFact.store_id == store_id])
    if dataset == "channel_revenue":
        conditions = [ChannelRevenueFact.period == period]
        conditions.append(ChannelRevenueFact.store_id.is_(None) if store_id is None else ChannelRevenueFact.store_id == store_id)
        return exists(ChannelRevenueFact, conditions)
    if dataset == "product_series":
        conditions = [ProductSalesFact.period == period, ProductSalesFact.product_id.is_(None)]
        conditions.append(ProductSalesFact.store_id.is_(None) if store_id is None else ProductSalesFact.store_id == store_id)
        return exists(ProductSalesFact, conditions)
    if dataset == "product_item":
        conditions = [ProductSalesFact.period == period, ProductSalesFact.product_id.is_not(None)]
        conditions.append(ProductSalesFact.store_id.is_(None) if store_id is None else ProductSalesFact.store_id == store_id)
        return exists(ProductSalesFact, conditions)
    if dataset == "funnel":
        conditions = [FunnelFact.period == period]
        conditions.append(FunnelFact.store_id.is_(None) if store_id is None else FunnelFact.store_id == store_id)
        return exists(FunnelFact, conditions)
    if dataset == "daypart":
        return exists(DaypartFact, [DaypartFact.period == period, DaypartFact.store_id == store_id])
    if dataset == "budget_target":
        budget = exists(BudgetFact, [BudgetFact.period == period])
        target = exists(TargetFact, [TargetFact.period == period])
        return budget or target
    return False


# ---------------------------------------------------------------------------
# 确认入库
# ---------------------------------------------------------------------------
def commit_import(session: Session, batch_id: int) -> ImportBatch:
    batch = session.get(ImportBatch, batch_id)
    if batch is None:
        raise ImportError_("批次不存在")
    if batch.status != "draft":
        raise ImportError_(f"批次状态为 {batch.status}，不能重复确认")
    errors = json.loads(batch.errors_json or "[]")
    if errors:
        raise ImportError_("存在校验错误，不能确认入库")
    rows = json.loads(batch.payload_json or "[]")
    if not rows:
        raise ImportError_("批次没有可入库的数据")
    ctx = ImportContext(session)
    inserted = _commit_rows(session, batch, rows, ctx)
    batch.row_count = inserted
    batch.status = "committed"
    batch.committed_at = utcnow()
    session.commit()
    return batch


def _commit_rows(session: Session, batch: ImportBatch, rows: list[dict], ctx: ImportContext) -> int:
    dataset = batch.dataset
    periods = sorted({row.get("期间") for row in rows if row.get("期间")})
    if dataset == "budget_target":
        _supersede_budget_target(session, batch, rows, periods)
        count = 0
        for row in rows:
            if row.get("_row_type") == "budget":
                session.add(
                    BudgetFact(
                        import_batch_id=batch.id,
                        store_id=row.get("_store_id"),
                        period=row.get("期间"),
                        account_id=row["_account_id"],
                        amount=float(row.get("预算值（万元）") or 0),
                    )
                )
                count += 1
            else:
                session.add(
                    TargetFact(
                        import_batch_id=batch.id,
                        period=row.get("期间"),
                        channel_id=row["_channel_id"],
                        new_customers=row.get("新客量"),
                        exposure_cvr=row.get("曝光转化率"),
                        avg_ticket=row.get("客单价"),
                        gross_margin=row.get("毛利率"),
                        cac=row.get("新客成本"),
                        target_roi=row.get("目标ROI"),
                    )
                )
                count += 1
        session.flush()
        return count

    fact_objects: list = []
    for row in rows:
        store_id = row.get("_store_id")
        period = row.get("期间")
        if dataset == "pl_monthly":
            for account_name, amount in (row.get("_accounts") or {}).items():
                fact_objects.append(
                    PLFact(
                        import_batch_id=batch.id,
                        store_id=store_id,
                        period=period,
                        scenario="actual",
                        account_id=ctx.accounts[account_name].id,
                        amount=float(amount),
                    )
                )
        elif dataset == "store_revenue":
            fact_objects.append(
                StoreRevenueFact(
                    import_batch_id=batch.id,
                    store_id=store_id,
                    period=period,
                    revenue=float(row.get("营业收入（万元）") or 0),
                    traffic=float(row.get("客流（人次）") or 0),
                    avg_ticket=row.get("客单价（元）"),
                    store_flag=row.get("同店/新店/闭店"),
                )
            )
        elif dataset == "channel_revenue":
            fact_objects.append(
                ChannelRevenueFact(
                    import_batch_id=batch.id,
                    store_id=store_id,
                    period=period,
                    channel_id=row["_channel_id"],
                    revenue=float(row.get("收入（万元）") or 0),
                )
            )
        elif dataset == "product_series":
            series_name = row.get("产品系列")
            series = ctx.series.get(series_name)
            if series is None:
                series = ProductSeries(name=series_name, sort_order=100)
                session.add(series)
                session.flush()
                ctx.series[series_name] = series
                row["_series_id"] = series.id
            fact_objects.append(
                ProductSalesFact(
                    import_batch_id=batch.id,
                    store_id=store_id,
                    period=period,
                    product_series_id=row.get("_series_id") or series.id,
                    product_id=None,
                    qty=float(row.get("销售数量") or 0),
                    amount=float(row.get("销售额（元）") or 0),
                    dish_revenue=float(row.get("菜品收入（元）") or 0),
                    discount=float(row.get("菜品优惠（元）") or 0),
                    actual_cost=row.get("实际成本（万元）"),
                    std_unit_cost=row.get("理论单位成本（元）"),
                    is_set=False,
                )
            )
        elif dataset == "product_item":
            product_name = row.get("产品名称")
            product = ctx.products.get(product_name)
            if product is None:
                product = Product(
                    name=product_name,
                    series_id=row.get("_series_id"),
                    is_set=bool(row.get("是否套餐")),
                )
                session.add(product)
                session.flush()
                ctx.products[product_name] = product
            fact_objects.append(
                ProductSalesFact(
                    import_batch_id=batch.id,
                    store_id=store_id,
                    period=period,
                    product_series_id=row.get("_series_id"),
                    product_id=product.id,
                    qty=float(row.get("销售数量") or 0),
                    amount=float(row.get("销售额（元）") or 0),
                    dish_revenue=float(row.get("菜品收入（元）") or 0),
                    discount=float(row.get("菜品优惠（元）") or 0),
                    actual_cost=None,
                    std_unit_cost=None,
                    is_set=bool(row.get("是否套餐")),
                )
            )
        elif dataset == "funnel":
            fact_objects.append(
                FunnelFact(
                    import_batch_id=batch.id,
                    store_id=store_id,
                    period=period,
                    channel_id=row["_channel_id"],
                    exposure=row.get("曝光人数"),
                    visits=row.get("访问人数"),
                    payers=row.get("支付人数"),
                    consumers=row.get("消费人数"),
                    brand_customers=row.get("品牌顾客"),
                    new_customers=row.get("新客"),
                    old_customers=row.get("老客"),
                    platform_fee=row.get("平台费用（元）"),
                )
            )
        elif dataset == "daypart":
            fact_objects.append(
                DaypartFact(
                    import_batch_id=batch.id,
                    store_id=store_id,
                    period=period,
                    day_type=row.get("日类型"),
                    daypart=row.get("时段"),
                    traffic=float(row.get("客流") or 0),
                )
            )

    _supersede(session, batch, dataset, fact_objects, periods, ctx)
    session.add_all(fact_objects)
    session.flush()
    return len(fact_objects)


def _store_scope_condition(model, store_ids: set):
    """门店作用域条件：包含品牌级（store_id IS NULL）时不能只用 IN（SQL 的 IN (NULL) 不匹配 NULL）。"""
    ids = [store_id for store_id in store_ids if store_id is not None]
    conditions = []
    if ids:
        conditions.append(model.store_id.in_(ids))
    if None in store_ids:
        conditions.append(model.store_id.is_(None))
    return or_(*conditions)


def _supersede(session, batch, dataset, fact_objects, periods, ctx) -> None:
    if not fact_objects:
        return
    store_ids = {getattr(item, "store_id", None) for item in fact_objects}
    store_scope = _store_scope_condition(PLFact, store_ids)
    batch_id = batch.id
    superseded = False

    def apply(model, conditions) -> None:
        nonlocal superseded
        session.execute(update(model).where(*conditions, model.superseded_by.is_(None)).values(superseded_by=batch_id))
        superseded = True

    if dataset == "pl_monthly":
        apply(
            PLFact,
            [PLFact.period.in_(periods), PLFact.scenario == "actual", _store_scope_condition(PLFact, store_ids)],
        )
    elif dataset == "store_revenue":
        apply(StoreRevenueFact, [StoreRevenueFact.period.in_(periods), _store_scope_condition(StoreRevenueFact, store_ids)])
    elif dataset == "channel_revenue":
        apply(ChannelRevenueFact, [ChannelRevenueFact.period.in_(periods), _store_scope_condition(ChannelRevenueFact, store_ids)])
    elif dataset == "product_series":
        apply(
            ProductSalesFact,
            [
                ProductSalesFact.period.in_(periods),
                ProductSalesFact.product_id.is_(None),
                _store_scope_condition(ProductSalesFact, store_ids),
            ],
        )
    elif dataset == "product_item":
        product_ids = {item.product_id for item in fact_objects}
        apply(
            ProductSalesFact,
            [
                ProductSalesFact.period.in_(periods),
                ProductSalesFact.product_id.in_(product_ids),
                _store_scope_condition(ProductSalesFact, store_ids),
            ],
        )
    elif dataset == "funnel":
        apply(FunnelFact, [FunnelFact.period.in_(periods), _store_scope_condition(FunnelFact, store_ids)])
    elif dataset == "daypart":
        apply(DaypartFact, [DaypartFact.period.in_(periods), _store_scope_condition(DaypartFact, store_ids)])
    _ = superseded


def _supersede_budget_target(session, batch, rows, periods) -> None:
    budget_store_ids = {row.get("_store_id") for row in rows if row.get("_row_type") == "budget"}
    target_channels = {row.get("_channel_id") for row in rows if row.get("_row_type") == "target"}
    if budget_store_ids:
        session.execute(
            update(BudgetFact)
            .where(
                BudgetFact.period.in_(periods),
                _store_scope_condition(BudgetFact, budget_store_ids),
                BudgetFact.superseded_by.is_(None),
            )
            .values(superseded_by=batch.id)
        )
    if target_channels:
        session.execute(
            update(TargetFact)
            .where(
                TargetFact.period.in_(periods),
                TargetFact.channel_id.in_(target_channels),
                TargetFact.superseded_by.is_(None),
            )
            .values(superseded_by=batch.id)
        )


# ---------------------------------------------------------------------------
# 回滚
# ---------------------------------------------------------------------------
FACT_MODELS = (PLFact, StoreRevenueFact, ChannelRevenueFact, ProductSalesFact, FunnelFact, DaypartFact, BudgetFact, TargetFact)


def rollback_import(session: Session, batch_id: int) -> ImportBatch:
    batch = session.get(ImportBatch, batch_id)
    if batch is None:
        raise ImportError_("批次不存在")
    if batch.status != "committed":
        raise ImportError_(f"批次状态为 {batch.status}，只有已入库批次可以回滚")
    for model in FACT_MODELS:
        session.execute(delete(model).where(model.import_batch_id == batch.id))
        session.execute(
            update(model).where(model.superseded_by == batch.id).values(superseded_by=None)
        )
    batch.status = "rolled_back"
    batch.rolled_back_at = utcnow()
    session.commit()
    return batch


def list_batches(session: Session, limit: int = 20) -> list[ImportBatch]:
    return list(
        session.scalars(
            select(ImportBatch).order_by(ImportBatch.created_at.desc(), ImportBatch.id.desc()).limit(limit)
        )
    )


def batch_to_dict(batch: ImportBatch, include_payload: bool = False) -> dict:
    data = {
        "id": batch.id,
        "dataset": batch.dataset,
        "dataset_name": batch.dataset_name or title_of(batch.dataset),
        "filename": batch.filename,
        "period_from": batch.period_from,
        "period_to": batch.period_to,
        "row_count": batch.row_count,
        "operator": batch.operator,
        "status": batch.status,
        "created_at": batch.created_at.isoformat() if batch.created_at else None,
        "committed_at": batch.committed_at.isoformat() if batch.committed_at else None,
        "rolled_back_at": batch.rolled_back_at.isoformat() if batch.rolled_back_at else None,
        "errors": json.loads(batch.errors_json or "[]"),
        "warnings": json.loads(batch.warnings_json or "[]"),
        "coverage": json.loads(batch.coverage_json or "[]"),
        "preview": json.loads(batch.preview_json or "[]"),
    }
    if include_payload:
        data["payload"] = json.loads(batch.payload_json or "[]")
    return data


# ---------------------------------------------------------------------------
# 模板生成
# ---------------------------------------------------------------------------
def template_list() -> list[dict]:
    return [
        {
            "key": key,
            "name": DATASETS[key].name,
            "description": DATASETS[key].description,
            "columns": DATASETS[key].column_names,
        }
        for key in DATASET_ORDER
    ]


def render_template(dataset: str) -> bytes:
    from openpyxl import Workbook
    from openpyxl.styles import Font

    spec = dataset_spec(dataset)
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = spec.name
    sheet.append(spec.column_names)
    for cell in sheet[1]:
        cell.font = Font(bold=True)
    example = [spec.example.get(name, "") for name in spec.column_names]
    sheet.append(example)
    notes = ["说明：", spec.description, "第 2 行为示例行，填写前请删除；金额非负，期间格式 YYYY-MM。"]
    sheet.append(notes)
    for index, name in enumerate(spec.column_names, start=1):
        sheet.column_dimensions[sheet.cell(row=1, column=index).column_letter].width = max(12, len(name) * 2 + 4)
    buffer = io.BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()
