import pandas as pd


def generate_executive_summary(data):

    # Convert Series → DataFrame
    if isinstance(data, pd.Series):
        df = data.reset_index()
        df.columns = ["Entity", "Value"]

    elif isinstance(data, pd.DataFrame):
        df = data.copy()

    else:
        return ["No summary available."]

    if df.empty:
        return ["Dataset is empty."]

    summary = []

    # Detect numeric columns
    numeric_cols = df.select_dtypes(include="number").columns.tolist()

    if not numeric_cols:
        return ["Dataset does not contain numeric columns."]

    metric = numeric_cols[0]

    # Detect entity column (first non-numeric column)
    non_numeric_cols = [c for c in df.columns if c not in numeric_cols]

    if non_numeric_cols:
        entity_col = non_numeric_cols[0]
    else:
        df["Entity"] = df.index.astype(str)
        entity_col = "Entity"

    df_sorted = df.sort_values(metric, ascending=False)

    top = df_sorted.iloc[0]
    bottom = df_sorted.iloc[-1]

    summary.append(
        f"Top performer is {top[entity_col]} with value {top[metric]:,.0f}."
    )

    summary.append(
        f"Lowest performer is {bottom[entity_col]} with value {bottom[metric]:,.0f}."
    )

    total = df[metric].sum()

    if total > 0:

        contribution = (top[metric] / total) * 100

        summary.append(
            f"{top[entity_col]} contributes {contribution:.1f}% of total."
        )

    summary.append(
        f"Total {metric} across all categories is {total:,.0f}."
    )

    return summary