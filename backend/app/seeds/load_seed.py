"""加载示例数据：把 backend/seed/*.csv 走与正式导入完全相同的链路写入数据库。

用法（在 backend/ 下执行）：
    .venv/bin/python -m app.seeds.load_seed            # 空库加载；已有示例数据则提示
    .venv/bin/python -m app.seeds.load_seed --force    # 覆盖重新加载
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from sqlalchemy import select

from app.config import settings
from app.db import SessionLocal, init_db
from app.importers.service import ImportError_, commit_import, stage_import
from app.models import ImportBatch
from app.seeds.dimensions import seed_dimensions

# 文件名前缀 → 数据集 key，导入顺序即依赖顺序（门店收入先于渠道/时段）
SEED_FILES: list[tuple[str, str]] = [
    ("01_月度利润表.csv", "pl_monthly"),
    ("02_门店收入.csv", "store_revenue"),
    ("03_渠道收入.csv", "channel_revenue"),
    ("04_产品系列销售.csv", "product_series"),
    ("05_单品销售.csv", "product_item"),
    ("06_线上漏斗.csv", "funnel"),
    ("07_时段客流.csv", "daypart"),
    ("08_预算与目标.csv", "budget_target"),
]


def already_seeded(session) -> bool:
    return session.scalar(select(ImportBatch.id).where(ImportBatch.dataset == "pl_monthly", ImportBatch.status == "committed").limit(1)) is not None


def load_seed(force: bool = False, operator: str = "seed") -> dict:
    init_db()
    session = SessionLocal()
    try:
        if already_seeded(session) and not force:
            raise ImportError_("示例数据已加载；如需重新加载请使用 --force 或 POST /api/seeds/load?force=true")
        dims = seed_dimensions(session)
        session.commit()

        imported: list[dict] = []
        for filename, dataset in SEED_FILES:
            path = Path(settings.seed_dir) / filename
            if not path.exists():
                raise ImportError_(f"缺少示例数据文件：{path}")
            content = path.read_bytes()
            batch = stage_import(session, dataset, filename, content, operator=operator)
            if batch.errors_json != "[]":
                raise ImportError_(f"{filename} 校验失败：{batch.errors_json}")
            batch = commit_import(session, batch.id)
            imported.append(
                {
                    "dataset": batch.dataset,
                    "dataset_name": batch.dataset_name,
                    "file": filename,
                    "batch_id": batch.id,
                    "rows": batch.row_count,
                }
            )
        return {"dimensions": dims, "imports": imported}
    finally:
        session.close()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="加载餐饮经营分析示例数据")
    parser.add_argument("--force", action="store_true", help="已有示例数据时覆盖重新加载")
    args = parser.parse_args(argv)
    try:
        result = load_seed(force=args.force)
    except ImportError_ as exc:
        print(f"加载失败：{exc}", file=sys.stderr)
        return 1
    print("示例数据加载完成：")
    print(f"  维度：{result['dimensions']}")
    for item in result["imports"]:
        print(f"  - {item['dataset_name']:<8} {item['file']:<22} 批次 {item['batch_id']:>2} 写入 {item['rows']} 行")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
