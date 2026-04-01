import pandas as pd


def _detect_numeric_columns(df: pd.DataFrame) -> list[str]:
    return df.select_dtypes(include="number").columns.tolist()


def _build_standard_numeric_kpis(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    kpis: list[dict] = []

    for col in numeric_cols[:4]:
        try:
            total = df[col].sum()
            avg = df[col].mean()
            max_val = df[col].max()
            min_val = df[col].min()

            kpis.append(
                {
                    "metric": col,
                    "total": round(float(total), 2),
                    "average": round(float(avg), 2),
                    "max": round(float(max_val), 2),
                    "min": round(float(min_val), 2),
                }
            )
        except (TypeError, ValueError, KeyError):
            continue

    return kpis


def _build_hr_kpis(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    """Special KPIs for HR‑style datasets (Attrition)."""
    kpis: list[dict] = []

    attrition_col = None
    for col in df.columns:
        if col.lower() == "attrition":
            attrition_col = col
            break

    if attrition_col and attrition_col in numeric_cols:
        try:
            attrition_rate = df[attrition_col].mean() * 100
            kpis.append(
                {
                    "metric": "Attrition Rate (%)",
                    "total": round(float(attrition_rate), 2),
                    "average": round(float(attrition_rate), 2),
                    "max": round(float(attrition_rate), 2),
                    "min": round(float(attrition_rate), 2),
                }
            )
        except (TypeError, ValueError, KeyError):
            pass

    return kpis


def _build_sales_margin_kpis(df: pd.DataFrame, numeric_cols: list[str]) -> list[dict]:
    """Special KPIs for sales‑style datasets (margin column)."""
    kpis: list[dict] = []

    margin_col = None
    for col in df.columns:
        if "margin" in col.lower():
            margin_col = col
            break

    if margin_col and margin_col in numeric_cols:
        try:
            avg_margin = df[margin_col].mean()
            kpis.append(
                {
                    "metric": "Avg Profit Margin (%)",
                    "total": round(float(avg_margin), 2),
                    "average": round(float(avg_margin), 2),
                    "max": round(float(df[margin_col].max()), 2),
                    "min": round(float(df[margin_col].min()), 2),
                }
            )
        except (TypeError, ValueError, KeyError):
            pass

    return kpis


def _build_business_kpis(df: pd.DataFrame) -> list[dict]:
    """Business‑level KPIs like total revenue / profit and margin."""
    kpis: list[dict] = []

    revenue_col = None
    profit_col = None

    for col in df.columns:
        lower = col.lower()
        if "revenue" in lower:
            revenue_col = col
        if "profit" in lower:
            profit_col = col

    total_revenue = None
    total_profit = None

    if revenue_col:
        total_revenue = df[revenue_col].sum()
        kpis.append(
            {
                "metric": "Total Revenue",
                "total": round(float(total_revenue), 2),
                "average": "",
                "max": "",
                "min": "",
            }
        )

    if profit_col:
        total_profit = df[profit_col].sum()
        kpis.append(
            {
                "metric": "Total Profit",
                "total": round(float(total_profit), 2),
                "average": "",
                "max": "",
                "min": "",
            }
        )

    if revenue_col and profit_col and total_revenue not in (None, 0):
        margin = (total_profit / total_revenue) * 100  # type: ignore[operator]
        kpis.append(
            {
                "metric": "Profit Margin (%)",
                "total": round(float(margin), 2),
                "average": "",
                "max": "",
                "min": "",
            }
        )

    return kpis


def generate_kpis(df: pd.DataFrame) -> list[dict]:
    """
    Generate up to 5 KPI dictionaries for the dashboard.

    Keeps backward‑compatible output while delegating to smaller helpers
    for numeric, HR, sales, and business KPIs.
    """
    numeric_cols = _detect_numeric_columns(df)
    if not numeric_cols:
        return []

    kpis: list[dict] = []

    # Standard numeric KPIs
    kpis.extend(_build_standard_numeric_kpis(df, numeric_cols))

    # HR‑specific KPIs
    kpis.extend(_build_hr_kpis(df, numeric_cols))

    # Sales margin KPIs
    kpis.extend(_build_sales_margin_kpis(df, numeric_cols))

    # Business total revenue/profit/margin KPIs
    business_kpis = _build_business_kpis(df)
    if business_kpis:
        # Insert at the front in the same order as before
        # Total Revenue, Total Profit, Profit Margin (%)
        for idx, item in reversed(list(enumerate(business_kpis))):
            kpis.insert(idx, item)

    # Limit to 5 KPIs for display (unchanged behavior)
    return kpis[:5]

