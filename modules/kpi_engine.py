import pandas as pd


def generate_kpis(df):

    kpis = []

    # detect numeric columns
    numeric_cols = df.select_dtypes(include="number").columns.tolist()

    # if dataset has no numeric values
    if len(numeric_cols) == 0:
        return []

    # only take first 3 metrics
    for col in numeric_cols[:3]:

        try:

            total = df[col].sum()
            avg = df[col].mean()

            kpis.append({
                "metric": col,
                "total": round(float(total), 2),
                "average": round(float(avg), 2)
            })

        except:
            continue

    return kpis