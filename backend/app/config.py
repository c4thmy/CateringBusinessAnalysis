from __future__ import annotations

import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data"
DATA_DIR.mkdir(parents=True, exist_ok=True)
SEED_DIR = BASE_DIR / "seed"


class Settings:
    """一期配置。敏感项走环境变量，其余给默认值，保证空库即可跑。"""

    app_name: str = "Catering Business Analysis"
    database_url: str = os.getenv("CBA_DATABASE_URL", f"sqlite:///{DATA_DIR / 'cba.db'}")

    admin_username: str = os.getenv("CBA_ADMIN_USERNAME", "admin")
    admin_password: str = os.getenv("CBA_ADMIN_PASSWORD", "admin123")
    session_secret: str = os.getenv("CBA_SESSION_SECRET", "dev-only-change-me-32bytes-minimum-key")
    session_cookie: str = "cba_session"
    session_max_age: int = 60 * 60 * 12

    # 洞察阈值（design.md 第 15 节 / api-contract.md 第 5 节）
    platform_fee_rate_max: float = float(os.getenv("CBA_PLATFORM_FEE_RATE_MAX", "0.15"))
    gross_roi_min: float = float(os.getenv("CBA_GROSS_ROI_MIN", "1.0"))
    sales_roi_min: float = float(os.getenv("CBA_SALES_ROI_MIN", "4.0"))
    funnel_cvr_drop: float = float(os.getenv("CBA_FUNNEL_CVR_DROP", "0.01"))
    top_n: int = int(os.getenv("CBA_TOP_N", "3"))

    # 线上平台毛利率（表8「增收提价预算」给大众点评/外卖毛利率 60%；
    # 渠道页面毛利 ROI = 平台收入 × 该毛利率 ÷ 平台费用）。
    platform_gross_margin: float = float(os.getenv("CBA_PLATFORM_GROSS_MARGIN", "0.6"))

    # 必填科目（缺失给警告，见 data-import spec）
    standard_accounts: tuple[str, ...] = (
        "营业收入",
        "食材成本",
        "优惠及手续费",
        "水电气低值",
        "宣传费用",
        "工资奖金",
        "宿舍房租",
        "店铺房租",
        "其它费用",
        "税金及附加",
    )

    seed_dir: Path = SEED_DIR
    frontend_dist: Path = BASE_DIR.parent / "frontend" / "dist"


settings = Settings()
