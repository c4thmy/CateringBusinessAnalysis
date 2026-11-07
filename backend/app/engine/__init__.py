"""计算引擎：纯函数，不依赖数据库与 FastAPI（design.md 第 14 节）。

前端沙盘将来用 TypeScript 复算同一套公式，因此这里所有函数只接收普通 dict/list，
返回普通 dict/list，方便用 shared/fixtures/*.json 做回归。
"""

from app.engine.chain_substitution import (
    chain_substitution,
    gross_profit_volume_price_cost,
    revenue_qty_price,
)
from app.engine.compare import compare, compare_rate, diff, pct_rate, pp_change
from app.engine.mix_rate_split import mix_rate_split
from app.engine.percentiles import bucket_of, percentiles
from app.engine.profit_bridge import DEFAULT_ACCOUNTS, profit_bridge
from app.engine.revenue import (
    channel_split,
    daypart_table,
    funnel,
    product_volume_price,
    roi,
    same_store,
    structure,
)

__all__ = [
    "chain_substitution",
    "gross_profit_volume_price_cost",
    "revenue_qty_price",
    "compare",
    "compare_rate",
    "diff",
    "pct_rate",
    "pp_change",
    "mix_rate_split",
    "bucket_of",
    "percentiles",
    "DEFAULT_ACCOUNTS",
    "profit_bridge",
    "channel_split",
    "daypart_table",
    "funnel",
    "product_volume_price",
    "roi",
    "same_store",
    "structure",
]
