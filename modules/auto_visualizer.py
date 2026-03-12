import pandas as pd
import plotly.express as px


def auto_visualize(data):

    charts = []

    if data is None:
        return charts

    # Convert Series → DataFrame
    if isinstance(data, pd.Series):
        df = data.reset_index()
        df.columns = ["Category", "Value"]

    elif isinstance(data, pd.DataFrame):
        df = data.copy()

    else:
        return charts

    if df.empty:
        return charts

    df = df.reset_index(drop=True)

    # Detect column types
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    cat_cols = df.select_dtypes(include=["object", "category"]).columns.tolist()
    date_cols = df.select_dtypes(include=["datetime", "datetime64"]).columns.tolist()

    if not numeric_cols:
        return charts

    # Ensure category column exists
    if not cat_cols:
        df["Category"] = df.index.astype(str)
        cat_cols = ["Category"]

    x_col = cat_cols[0]

    # -------------------------------------------------
    # BAR CHARTS (for each numeric column)
    # -------------------------------------------------
    for y_col in numeric_cols:

        try:

            fig_bar = px.bar(
                df,
                x=x_col,
                y=y_col,
                color=x_col,
                text_auto=True,
                title=f"{y_col} by {x_col}",
                template="plotly_white"
            )

            fig_bar.update_layout(
                title_font_size=22,
                height=450,
                showlegend=False
            )

            charts.append(fig_bar)

        except:
            pass

    # -------------------------------------------------
    # LINE CHART (time trends)
    # -------------------------------------------------
    possible_time_cols = date_cols + ["date", "month", "year", "time"]

    for col in possible_time_cols:

        if col in df.columns:

            try:

                fig_line = px.line(
                    df,
                    x=col,
                    y=numeric_cols[0],
                    markers=True,
                    title=f"{numeric_cols[0]} Trend",
                    template="plotly_white"
                )

                fig_line.update_layout(
                    title_font_size=22,
                    height=450
                )

                charts.append(fig_line)

                break

            except:
                pass

    # -------------------------------------------------
    # PIE CHART (only small datasets)
    # -------------------------------------------------
    if len(df) <= 10:

        try:

            fig_pie = px.pie(
                df,
                names=x_col,
                values=numeric_cols[0],
                title=f"{numeric_cols[0]} Distribution",
                template="plotly_white"
            )

            charts.append(fig_pie)

        except:
            pass

    return charts