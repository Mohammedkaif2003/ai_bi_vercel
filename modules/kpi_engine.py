import pandas as pd


def generate_kpis(df):

    kpis = []

    # detect numeric columns
    numeric_cols = df.select_dtypes(include="number").columns.tolist()

    # if dataset has no numeric values
    if len(numeric_cols) == 0:
        return []

    # Standard numeric KPIs (first 4 metrics)
    for col in numeric_cols[:4]:

        try:

            total = df[col].sum()
            avg = df[col].mean()
            max_val = df[col].max()
            min_val = df[col].min()

            kpis.append({
                "metric": col,
                "total": round(float(total), 2),
                "average": round(float(avg), 2),
                "max": round(float(max_val), 2),
                "min": round(float(min_val), 2),
            })

        except:
            continue

    # ---------- SPECIAL KPIs ----------

    # Attrition rate (for HR data)
    attrition_col = None
    for col in df.columns:
        if col.lower() == "attrition":
            attrition_col = col
            break

    if attrition_col and attrition_col in numeric_cols:
        try:
            attrition_rate = df[attrition_col].mean() * 100
            kpis.append({
                "metric": "Attrition Rate (%)",
                "total": round(attrition_rate, 2),
                "average": round(attrition_rate, 2),
                "max": round(attrition_rate, 2),
                "min": round(attrition_rate, 2),
            })
        except:
            pass

    # Profit margin (for sales data)
    margin_col = None
    for col in df.columns:
        if "margin" in col.lower():
            margin_col = col
            break

    if margin_col and margin_col in numeric_cols:
        try:
            avg_margin = df[margin_col].mean()
            kpis.append({
                "metric": "Avg Profit Margin (%)",
                "total": round(avg_margin, 2),
                "average": round(avg_margin, 2),
                "max": round(float(df[margin_col].max()), 2),
                "min": round(float(df[margin_col].min()), 2),
            })
        except:
            pass

    # Limit to 5 KPIs for display
    return kpis[:5]