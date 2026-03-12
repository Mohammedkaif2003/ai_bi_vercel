import pandas as pd


def generate_auto_insights(df):

    insights = []

    if df.empty:
        return insights

    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()

    # ---------- TOP CONTRIBUTOR ----------
    if numeric_cols and cat_cols:

        metric = numeric_cols[0]
        category = cat_cols[0]

        grouped = df.groupby(category)[metric].sum().sort_values(ascending=False)

        top = grouped.index[0]
        share = (grouped.iloc[0] / grouped.sum()) * 100

        insights.append(
            f"🏆 {top} contributes {share:.1f}% of total {metric}."
        )

    # ---------- MAX VALUE ----------
    if numeric_cols:

        metric = numeric_cols[0]

        max_value = df[metric].max()

        insights.append(
            f"📈 Highest {metric} observed is {max_value:,.0f}."
        )

    # ---------- TREND DETECTION ----------
    time_cols = ["date", "year", "month"]

    for col in time_cols:

        if col in df.columns and numeric_cols:

            metric = numeric_cols[0]

            trend = df.sort_values(col)[metric].diff().mean()

            if trend > 0:
                insights.append("📈 Overall trend appears to be increasing.")

            elif trend < 0:
                insights.append("📉 Overall trend appears to be declining.")

            break

    return insights