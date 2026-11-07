"""SQLAlchemy 模型：全部维度表与事实表。

约定（见 design.md 第 10 节）：
- 金额单位：pl_fact / store_revenue_fact / channel_revenue_fact / budget_fact 为万元；
  product_sales_fact 的金额为元；funnel_fact.platform_fee 为元。
- 每个事实行都带 import_batch_id 与 superseded_by；覆盖导入时旧行 superseded_by 指向新批次，
  不物理删除，回滚时把 superseded_by 置空并删除新批次行。
- 事实表不建外键（SQLite 单机 Demo，回滚/覆盖逻辑更简单）；维度引用用 *_id 列 + 服务层校验。
"""

from app.models.dimensions import (
    Account,
    Brand,
    Channel,
    ImportBatch,
    Period,
    Product,
    ProductSeries,
    Store,
)
from app.models.facts import (
    BudgetFact,
    ChannelRevenueFact,
    DaypartFact,
    FunnelFact,
    PLFact,
    ProductSalesFact,
    StoreRevenueFact,
    TargetFact,
)

__all__ = [
    "Account",
    "Brand",
    "Channel",
    "ImportBatch",
    "Period",
    "Product",
    "ProductSeries",
    "Store",
    "BudgetFact",
    "ChannelRevenueFact",
    "DaypartFact",
    "FunnelFact",
    "PLFact",
    "ProductSalesFact",
    "StoreRevenueFact",
    "TargetFact",
]
