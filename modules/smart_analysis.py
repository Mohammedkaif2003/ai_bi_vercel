"""
Deterministic analysis engine.

Philosophy: **pandas computes, Python picks the chart, the LLM only narrates.**

This module replaces the unreliable pattern of asking an LLM to both calculate
numbers AND write chart code.  Instead:

1. *Classify* the query into an analytical pattern (ranking, comparison, trend …).
2. *Match* the user's words to real DataFrame columns.
3. *Compute* the answer with plain pandas — no LLM involved.
4. *Pick* the right chart type in Python based on the pattern.
5. Return a structured dict that the caller can hand to the LLM for narration only.
"""

from __future__ import annotations

import re
from typing import Any

import numpy as np
import pandas as pd
import plotly.express as px

from modules.app_logging import get_logger

logger = get_logger("smart_analysis")

# ── Design tokens (match auto_visualizer palette) ───────────────────────────
PRIMARY = "#4F46E5"
PRIMARY_SOFT = "#818CF8"
SECONDARY = "#10B981"
TERTIARY = "#F59E0B"
PALETTE = [PRIMARY, SECONDARY, TERTIARY, "#EC4899", "#06B6D4", "#8B5CF6"]


# ═════════════════════════════════════════════════════════════════════════════
# 1.  Query type detection
# ═════════════════════════════════════════════════════════════════════════════

_RANKING_TOKENS = (
    "highest", "lowest", "top", "bottom", "best", "worst",
    "most", "least", "rank", "ranking", "leading", "trailing",
    "biggest", "smallest", "maximum", "minimum",
)
_COMPARISON_TOKENS = (
    "vary", "varies", "compare", "comparison", "vs", "versus",
    "difference", "between", "across", "by day type", "day type",
    "weekday", "saturday", "sunday", "grouped", "breakdown",
)
_TREND_TOKENS = (
    "over time", "trend", "trends", "time series", "line chart",
    "monthly", "yearly", "quarterly", "weekly", "daily",
    "growth", "decline", "change over", "changed over", "history",
    "historical", "evolution",
)
_DISTRIBUTION_TOKENS = (
    "distribution", "spread", "boxplot", "box plot", "histogram",
    "quartile", "iqr", "whisker",
)
_CORRELATION_TOKENS = (
    "correlation", "relationship", "scatter", "heatmap", "heat map",
    "correlations",
)
_OUTLIER_TOKENS = (
    "outlier", "outliers", "anomaly", "anomalies", "abnormal",
    "unusual", "extreme value", "detect outlier",
)
_FORECAST_TOKENS = (
    "forecast", "predict", "projection", "future",
    "next month", "next year", "extrapolat",
)
_AGGREGATE_TOKENS = (
    "total", "sum", "average", "mean", "count", "how many",
    "median", "overall",
)
_WHATIF_TOKENS = (
    "what if", "scenario", "suppose", "increase", "decrease",
    "percent", "%", "change", "impact", "effect",
)


def _detect_query_type(q: str) -> str:
    if any(t in q for t in _OUTLIER_TOKENS):
        return "outlier"
    if any(t in q for t in _FORECAST_TOKENS):
        return "forecast"
    if any(t in q for t in _CORRELATION_TOKENS):
        return "correlation"
    if any(t in q for t in _DISTRIBUTION_TOKENS):
        return "distribution"
    if any(t in q for t in _RANKING_TOKENS):
        return "ranking"
    if any(t in q for t in _COMPARISON_TOKENS):
        return "comparison"
    if any(t in q for t in _TREND_TOKENS):
        return "trend"
    if any(t in q for t in _AGGREGATE_TOKENS):
        return "aggregate"
    if any(t in q for t in _WHATIF_TOKENS) and re.search(r"\d+[%]|percent", q):
        return "whatif"
    return "general"


# ═════════════════════════════════════════════════════════════════════════════
# 2.  Column matching
# ═════════════════════════════════════════════════════════════════════════════

def _tokenize(text: str) -> set[str]:
    return set(re.findall(r"[a-z0-9]+", text.lower()))


def _col_mentioned(query_lc: str, col: str) -> bool:
    """Check if a column is referenced in the query (exact, substring, or stem)."""
    col_lc = col.lower()
    if col_lc in query_lc:
        return True
    tokens = [t for t in re.findall(r"[a-z]+", col_lc) if len(t) >= 3]
    if not tokens:
        return False
    # All meaningful tokens appear in query
    if all(t in query_lc for t in tokens):
        return True
    # Stem match: "ridership" ↔ "rides"
    query_tokens = _tokenize(query_lc)
    for ct in tokens:
        for qt in query_tokens:
            if len(qt) >= 4 and len(ct) >= 3 and (qt in ct or ct in qt):
                return True
    return False


def _find_metrics(query_lc: str, df: pd.DataFrame) -> list[str]:
    """Return numeric columns relevant to the query, falling back to all."""
    numeric = df.select_dtypes(include="number").columns.tolist()
    matched = [c for c in numeric if _col_mentioned(query_lc, c)]
    return matched if matched else numeric


def _find_group_col(query_lc: str, df: pd.DataFrame) -> str | None:
    cats = df.select_dtypes(include=["object", "category", "string"]).columns.tolist()
    for c in cats:
        if _col_mentioned(query_lc, c):
            return c
    return cats[0] if cats else None


def _find_date_col(df: pd.DataFrame) -> str | None:
    for c in df.columns:
        lc = c.lower()
        if any(t in lc for t in ("date", "month", "time", "quarter")):
            return c
    dt = df.select_dtypes(include=["datetime64"]).columns.tolist()
    return dt[0] if dt else None


# ═════════════════════════════════════════════════════════════════════════════
# 3.  Shared chart layout
# ═════════════════════════════════════════════════════════════════════════════

def _polish(fig, height: int = 460):
    fig.update_layout(
        template="plotly_white",
        height=height,
        font=dict(family="Manrope, Segoe UI, sans-serif", size=12),
        title=dict(font=dict(size=18, family="Manrope, Segoe UI, sans-serif")),
        margin=dict(l=70, r=30, t=60, b=70),
        hoverlabel=dict(
            bgcolor="#0F172A",
            bordercolor=PRIMARY_SOFT,
            font=dict(color="#F8FAFC", family="Manrope, Segoe UI, sans-serif"),
        ),
    )
    fig.update_xaxes(showgrid=False, showline=True, linecolor="rgba(148,163,184,0.25)")
    fig.update_yaxes(showgrid=True, gridcolor="rgba(148,163,184,0.12)")
    return fig


def _fmt(val, name: str = "") -> str:
    name_lc = name.lower()
    if isinstance(val, float):
        if any(t in name_lc for t in ("rate", "pct", "percent", "margin")):
            return f"{val:.1f}%"
        if any(t in name_lc for t in ("revenue", "sales", "profit", "cost", "price")):
            return f"${val:,.2f}"
        return f"{val:,.2f}"
    if isinstance(val, int):
        return f"{val:,}"
    return str(val)


# ═════════════════════════════════════════════════════════════════════════════
# 4.  Analysis patterns
# ═════════════════════════════════════════════════════════════════════════════

def _analyze_ranking(df, metrics, group_col, query_lc):
    metric = metrics[0]
    grouped = (
        df.groupby(group_col, dropna=False)[metric]
        .mean()
        .sort_values(ascending=False)
        .reset_index()
    )
    grouped.columns = [group_col, metric]

    top = grouped.head(1).iloc[0]
    bot = grouped.tail(1).iloc[0]

    summary = (
        f"Average {metric} grouped by {group_col}: "
        f"highest is {top[group_col]} at {_fmt(top[metric], metric)}, "
        f"lowest is {bot[group_col]} at {_fmt(bot[metric], metric)}. "
        f"Total categories: {len(grouped)}. "
        f"Overall mean across all {group_col}s: {_fmt(grouped[metric].mean(), metric)}."
    )

    show = grouped.head(12).sort_values(metric)
    fig = px.bar(
        show, x=metric, y=group_col,
        orientation="h",
        color_discrete_sequence=[PRIMARY],
        title=f"Average {metric} by {group_col}",
    )
    fig.update_traces(
        texttemplate="%{x:,.0f}", textposition="outside",
        textfont=dict(size=11, color="#E2E8F0"),
        marker=dict(line=dict(color="#FFFFFF", width=1)),
    )
    _polish(fig)
    fig.update_layout(showlegend=False, yaxis_title="", xaxis_title=metric)

    return {"result": grouped, "chart": fig, "summary": summary, "query_type": "ranking"}


def _analyze_comparison(df, metrics, group_col, query_lc):
    """Compare multiple metrics side-by-side (e.g. weekday vs saturday vs sunday)."""
    # Detect "by day type" pattern: multiple ride/metric columns to compare
    compare_cols = metrics if len(metrics) >= 2 else []

    # If the query mentions day-type concepts and we have multiple ride columns,
    # compare those columns directly (not grouped by a category).
    if compare_cols:
        means = {col: df[col].mean() for col in compare_cols}
        summary_parts = [f"{col}: {_fmt(v, col)}" for col, v in means.items()]
        summary = f"Comparing averages — " + ", ".join(summary_parts) + "."

        compare_df = pd.DataFrame(
            [{"Metric": col, "Average": df[col].mean()} for col in compare_cols]
        ).sort_values("Average", ascending=False)

        fig = px.bar(
            compare_df, x="Metric", y="Average",
            color="Metric",
            color_discrete_sequence=PALETTE,
            title="Average Ridership by Day Type",
        )
        fig.update_traces(
            texttemplate="%{y:,.0f}", textposition="outside",
            textfont=dict(size=11, color="#E2E8F0"),
        )
        _polish(fig)
        fig.update_layout(showlegend=False, xaxis_title="", bargap=0.3)
        return {"result": compare_df, "chart": fig, "summary": summary, "query_type": "comparison"}

    # Fallback: group by category and compare
    if group_col and metrics:
        metric = metrics[0]
        grouped = (
            df.groupby(group_col, dropna=False)[metric]
            .mean()
            .sort_values(ascending=False)
            .reset_index()
        )
        top = grouped.head(1).iloc[0]
        bot = grouped.tail(1).iloc[0]
        summary = (
            f"Average {metric} by {group_col}: "
            f"highest is {top[group_col]} ({_fmt(top[metric], metric)}), "
            f"lowest is {bot[group_col]} ({_fmt(bot[metric], metric)})."
        )
        show = grouped.head(12).sort_values(metric, ascending=False)
        fig = px.bar(
            show, x=group_col, y=metric,
            color=group_col,
            color_discrete_sequence=PALETTE,
            title=f"{metric} Comparison by {group_col}",
        )
        fig.update_traces(texttemplate="%{y:,.0f}", textposition="outside",
                          textfont=dict(size=11, color="#E2E8F0"))
        _polish(fig)
        fig.update_layout(showlegend=False, bargap=0.25)
        return {"result": grouped, "chart": fig, "summary": summary, "query_type": "comparison"}

    return None


def _analyze_trend(df, metrics, date_col):
    metric = metrics[0]
    trend = df[[date_col, metric]].dropna().copy()
    try:
        trend[date_col] = pd.to_datetime(trend[date_col], errors="coerce")
        trend = trend.dropna(subset=[date_col])
    except Exception:
        pass
    if len(trend) < 2:
        return None

    grouped = (
        trend.groupby(date_col)[metric]
        .mean()
        .reset_index()
        .sort_values(date_col)
    )

    first_val = grouped[metric].iloc[0]
    last_val = grouped[metric].iloc[-1]
    direction = "upward" if last_val > first_val else "downward" if last_val < first_val else "flat"

    summary = (
        f"{metric} over {date_col}: "
        f"starts at {_fmt(first_val, metric)}, ends at {_fmt(last_val, metric)} ({direction} trend). "
        f"Peak: {_fmt(grouped[metric].max(), metric)}, trough: {_fmt(grouped[metric].min(), metric)}. "
        f"{len(grouped)} time periods."
    )

    fig = px.line(
        grouped, x=date_col, y=metric,
        markers=True,
        color_discrete_sequence=[PRIMARY],
        title=f"{metric} Trend Over {date_col}",
    )
    fig.update_traces(
        line=dict(width=3),
        marker=dict(size=8, line=dict(width=2, color="#FFFFFF")),
    )
    _polish(fig)
    return {"result": grouped, "chart": fig, "summary": summary, "query_type": "trend"}


def _analyze_distribution(df, metrics, group_col):
    metric = metrics[0]

    numeric_s = pd.to_numeric(df[metric], errors="coerce").dropna()
    summary = (
        f"Distribution of {metric}: "
        f"median {_fmt(numeric_s.median(), metric)}, "
        f"mean {_fmt(numeric_s.mean(), metric)}, "
        f"std {_fmt(numeric_s.std(), metric)}. "
        f"Range: {_fmt(numeric_s.min(), metric)} – {_fmt(numeric_s.max(), metric)}."
    )

    if group_col and df[group_col].nunique(dropna=True) <= 12:
        fig = px.box(
            df, x=group_col, y=metric, color=group_col,
            color_discrete_sequence=PALETTE,
            title=f"Distribution of {metric} by {group_col}",
        )
    else:
        fig = px.box(
            df, y=metric,
            color_discrete_sequence=[PRIMARY],
            title=f"Distribution of {metric}",
        )
    fig.update_traces(boxmean="sd")
    _polish(fig)
    fig.update_layout(showlegend=False)
    return {"result": df[[metric]].describe(), "chart": fig, "summary": summary, "query_type": "distribution"}


def _analyze_correlation(df, numeric_cols):
    if len(numeric_cols) < 2:
        return None
    cols = numeric_cols[:8]
    corr = df[cols].apply(pd.to_numeric, errors="coerce").corr()

    mask = np.triu(np.ones_like(corr, dtype=bool), k=1)
    tri = corr.where(mask)
    if not tri.stack().empty:
        max_pair = tri.stack().abs().idxmax()
        val = corr.loc[max_pair[0], max_pair[1]]
        summary = f"Strongest correlation: {max_pair[0]} ↔ {max_pair[1]} ({val:.2f}). Showing {len(cols)} numeric columns."
    else:
        summary = f"Correlation matrix for {len(cols)} numeric columns."

    fig = px.imshow(
        corr, text_auto=".2f",
        color_continuous_scale="RdBu_r",
        zmin=-1, zmax=1,
        aspect="auto",
        title="Correlation Heatmap",
    )
    fig.update_traces(textfont=dict(color="#1F2937", size=12))
    _polish(fig, height=520)
    fig.update_layout(
        coloraxis_colorbar=dict(title="Correlation", tickvals=[-1, -0.5, 0, 0.5, 1]),
    )
    return {"result": corr, "chart": fig, "summary": summary, "query_type": "correlation"}


def _analyze_outlier(df, metrics, group_col):
    metric = metrics[0]
    s = pd.to_numeric(df[metric], errors="coerce").dropna()
    if len(s) < 4:
        return None

    q1, q3 = s.quantile(0.25), s.quantile(0.75)
    iqr = q3 - q1
    lower, upper = q1 - 1.5 * iqr, q3 + 1.5 * iqr
    outlier_mask = (s < lower) | (s > upper)
    n_outliers = outlier_mask.sum()

    if n_outliers == 0:
        summary = f"No outliers detected in {metric} using the IQR method (bounds: {_fmt(lower, metric)} – {_fmt(upper, metric)})."
        fig = px.box(df, y=metric, color_discrete_sequence=[PRIMARY], title=f"No Outliers in {metric}")
        fig.update_traces(boxmean="sd")
        _polish(fig)
        return {"result": pd.DataFrame({"info": [summary]}), "chart": fig, "summary": summary, "query_type": "outlier"}

    plot_df = df.loc[s.index].copy()
    plot_df["_status"] = outlier_mask.map({True: "Outlier", False: "Normal"})
    x_col = group_col if (group_col and group_col in plot_df.columns) else "Index"
    if x_col == "Index":
        plot_df["Index"] = range(len(plot_df))

    summary = (
        f"{n_outliers} outlier{'s' if n_outliers != 1 else ''} detected in {metric}. "
        f"IQR bounds: {_fmt(lower, metric)} – {_fmt(upper, metric)}. "
        f"Outlier values range from {_fmt(s[outlier_mask].min(), metric)} to {_fmt(s[outlier_mask].max(), metric)}."
    )

    fig = px.scatter(
        plot_df, x=x_col, y=metric, color="_status",
        color_discrete_map={"Normal": PRIMARY_SOFT, "Outlier": "#EF4444"},
        title=f"Outlier Detection — {metric} ({n_outliers} outlier{'s' if n_outliers != 1 else ''})",
    )
    fig.update_traces(marker=dict(size=8, opacity=0.8, line=dict(width=1, color="#FFFFFF")))
    fig.add_hline(y=upper, line_dash="dash", line_color=TERTIARY, annotation_text="Upper bound")
    fig.add_hline(y=lower, line_dash="dash", line_color=TERTIARY, annotation_text="Lower bound")
    _polish(fig)
    fig.update_layout(legend_title_text="")

    return {"result": plot_df.drop(columns=["_status", "Index"], errors="ignore"),
            "chart": fig, "summary": summary, "query_type": "outlier"}


def _analyze_forecast(df, metrics, date_col):
    metric = metrics[0]
    trend = df[[date_col, metric]].dropna().copy()
    try:
        trend[date_col] = pd.to_datetime(trend[date_col], errors="coerce")
        trend = trend.dropna(subset=[date_col])
    except Exception:
        pass
    if len(trend) < 4:
        return None

    grouped = trend.groupby(date_col)[metric].mean().reset_index().sort_values(date_col)
    x_num = np.arange(len(grouped), dtype=float)
    y_vals = grouped[metric].values.astype(float)
    coeffs = np.polyfit(x_num, y_vals, 1)

    n_fc = max(int(len(grouped) * 0.2), 3)
    future_x = np.arange(len(grouped), len(grouped) + n_fc, dtype=float)
    future_y = np.polyval(coeffs, future_x)

    last_date = grouped[date_col].max()
    try:
        freq = pd.infer_freq(grouped[date_col])
    except Exception:
        freq = None
    if freq:
        future_dates = pd.date_range(start=last_date, periods=n_fc + 1, freq=freq)[1:]
    else:
        avg_d = grouped[date_col].diff().mean()
        future_dates = [last_date + avg_d * (i + 1) for i in range(n_fc)]
    fc_df = pd.DataFrame({date_col: future_dates, metric: future_y})

    slope_dir = "upward" if coeffs[0] > 0 else "downward" if coeffs[0] < 0 else "flat"
    summary = (
        f"Linear forecast for {metric}: {slope_dir} trend (slope {coeffs[0]:,.2f} per period). "
        f"Forecasting {n_fc} future periods."
    )

    fig = px.line(grouped, x=date_col, y=metric, markers=True,
                  color_discrete_sequence=[PRIMARY],
                  title=f"{metric} — Actual + Forecast")
    fig.update_traces(line=dict(width=3), marker=dict(size=8, line=dict(width=2, color="#FFFFFF")), name="Actual")
    fig.add_scatter(x=fc_df[date_col], y=fc_df[metric], mode="lines+markers",
                    line=dict(dash="dash", width=3, color=TERTIARY),
                    marker=dict(size=8, line=dict(width=2, color="#FFFFFF"), color=TERTIARY),
                    name="Forecast")
    _polish(fig)
    fig.update_layout(showlegend=True)

    return {"result": pd.concat([grouped, fc_df], ignore_index=True),
            "chart": fig, "summary": summary, "query_type": "forecast"}


def _analyze_aggregate(df, metrics, group_col, query_lc):
    """Simple aggregate: total, average, count."""
    metric = metrics[0]
    is_avg = any(t in query_lc for t in ("average", "avg", "mean"))
    is_count = any(t in query_lc for t in ("count", "how many"))

    if group_col:
        if is_count:
            grouped = df.groupby(group_col).size().reset_index(name="Count").sort_values("Count", ascending=False)
            val_col = "Count"
        elif is_avg:
            grouped = df.groupby(group_col, dropna=False)[metric].mean().reset_index().sort_values(metric, ascending=False)
            val_col = metric
        else:
            grouped = df.groupby(group_col, dropna=False)[metric].sum().reset_index().sort_values(metric, ascending=False)
            val_col = metric

        summary = f"{'Average' if is_avg else 'Count' if is_count else 'Total'} of {val_col} by {group_col}. " \
                  f"Top: {grouped.iloc[0][group_col]} ({_fmt(grouped.iloc[0][val_col], val_col)}), " \
                  f"bottom: {grouped.iloc[-1][group_col]} ({_fmt(grouped.iloc[-1][val_col], val_col)})."

        show = grouped.head(12)
        fig = px.bar(show, x=group_col, y=val_col, color=group_col,
                     color_discrete_sequence=PALETTE,
                     title=f"{'Average' if is_avg else 'Count' if is_count else 'Total'} {val_col} by {group_col}")
        fig.update_traces(texttemplate="%{y:,.0f}", textposition="outside",
                          textfont=dict(size=11, color="#E2E8F0"))
        _polish(fig)
        fig.update_layout(showlegend=False, bargap=0.25)
        return {"result": grouped, "chart": fig, "summary": summary, "query_type": "aggregate"}

    # No grouping column — just give the scalar
    if is_count:
        val = len(df)
        summary = f"Total row count: {val:,}."
    elif is_avg:
        val = df[metric].mean()
        summary = f"Average {metric}: {_fmt(val, metric)}."
    else:
        val = df[metric].sum()
        summary = f"Total {metric}: {_fmt(val, metric)}."
    return {"result": val, "chart": None, "summary": summary, "query_type": "aggregate"}


def _analyze_whatif(df: pd.DataFrame, metrics: list[str], query_lc: str):
    """Simulate a 'What-If' scenario based on a percentage change."""
    # 1. Extract percentage
    pct_match = re.search(r"(\d+)", query_lc)
    if not pct_match: return None
    pct_val = float(pct_match.group(1)) / 100.0
    
    is_decrease = any(t in query_lc for t in ("decrease", "lower", "drop", "less", "reduce"))
    multiplier = 1 - pct_val if is_decrease else 1 + pct_val
    
    # 2. Identify variables
    # We need at least one metric to change. 
    # If two metrics: 1st is the independent (change), 2nd is dependent (target)
    if len(metrics) < 1: return None
    
    indep = metrics[0]
    dep = metrics[1] if len(metrics) > 1 else metrics[0]
    
    current_indep_total = df[indep].sum()
    sim_indep_total = current_indep_total * multiplier
    
    # Simple simulation: 
    # If they are different, calculate correlation. 
    # If same, just scale the metric.
    if indep == dep:
        current_dep_total = current_indep_total
        sim_dep_total = sim_indep_total
    else:
        current_dep_total = df[dep].sum()
        correlation = df[[indep, dep]].corr().iloc[0, 1]
        # We assume a linear impact weighted by correlation
        # Change in Dep = Change in Indep * Correlation (oversimplified but effective for BI)
        impact_factor = 1 + ((multiplier - 1) * correlation)
        sim_dep_total = current_dep_total * impact_factor

    change_pct = ((sim_dep_total / current_dep_total) - 1) * 100
    
    summary = (
        f"What-If Scenario: {pct_val*100:.0f}% {'decrease' if is_decrease else 'increase'} in {indep}. "
        f"Predicted impact on {dep}: "
        f"{'up' if change_pct > 0 else 'down'} {abs(change_pct):.1f}% "
        f"(from {_fmt(current_dep_total, dep)} to {_fmt(sim_dep_total, dep)})."
    )

    plot_df = pd.DataFrame([
        {"Scenario": "Current", "Value": current_dep_total},
        {"Scenario": "Simulated", "Value": sim_dep_total}
    ])

    fig = px.bar(
        plot_df, x="Scenario", y="Value",
        color="Scenario",
        color_discrete_map={"Current": PRIMARY_SOFT, "Simulated": TERTIARY},
        title=f"Predictive Impact on {dep}"
    )
    fig.update_traces(texttemplate="%{y:,.0f}", textposition="outside")
    _polish(fig)
    fig.update_layout(showlegend=False, xaxis_title="")

    return {
        "result": plot_df, 
        "chart": fig, 
        "summary": summary, 
        "query_type": "whatif"
    }


def _analyze_general(df, metrics, group_col, date_col, query_lc):
    """Catch-all: group by the best dimension, pick the best chart."""
    metric = metrics[0]

    if date_col:
        return _analyze_trend(df, metrics, date_col)

    if group_col:
        grouped = (
            df.groupby(group_col, dropna=False)[metric]
            .mean()
            .sort_values(ascending=False)
            .reset_index()
            .head(12)
        )
        summary = (
            f"Average {metric} by {group_col}. "
            f"Top: {grouped.iloc[0][group_col]} ({_fmt(grouped.iloc[0][metric], metric)}), "
            f"entries: {len(grouped)}."
        )
        fig = px.bar(grouped, x=group_col, y=metric, color=group_col,
                     color_discrete_sequence=PALETTE,
                     title=f"Average {metric} by {group_col}")
        fig.update_traces(texttemplate="%{y:,.0f}", textposition="outside",
                          textfont=dict(size=11, color="#E2E8F0"))
        _polish(fig)
        fig.update_layout(showlegend=False, bargap=0.25)
        return {"result": grouped, "chart": fig, "summary": summary, "query_type": "general"}

    # Numeric-only dataset: just show the distribution
    return _analyze_distribution(df, metrics, group_col)


# ═════════════════════════════════════════════════════════════════════════════
# 5.  Main entry point
# ═════════════════════════════════════════════════════════════════════════════

def run_smart_analysis(query: str, df: pd.DataFrame) -> dict | None:
    """
    Deterministic analysis engine.

    Returns
    -------
    dict with keys:
        result     – DataFrame, Series, or scalar (the computed answer)
        chart      – plotly Figure or None
        summary    – human-readable description of what was computed
        query_type – str identifying the analytical pattern

    Returns None if the query can't be handled deterministically (rare).
    """
    if df is None or df.empty:
        return None

    query_lc = str(query).lower().strip()
    if not query_lc:
        return None

    qtype = _detect_query_type(query_lc)
    numeric_cols = df.select_dtypes(include="number").columns.tolist()
    if not numeric_cols:
        return None

    metrics = _find_metrics(query_lc, df)
    group_col = _find_group_col(query_lc, df)
    date_col = _find_date_col(df)

    logger.info(
        "smart_analysis",
        extra={
            "query_type": qtype,
            "metrics": metrics[:3],
            "group_col": group_col,
            "date_col": date_col,
        },
    )

    try:
        if qtype == "ranking":
            return _analyze_ranking(df, metrics, group_col, query_lc)
        if qtype == "comparison":
            return _analyze_comparison(df, metrics, group_col, query_lc)
        if qtype == "trend":
            return _analyze_trend(df, metrics, date_col) if date_col else _analyze_general(df, metrics, group_col, date_col, query_lc)
        if qtype == "distribution":
            return _analyze_distribution(df, metrics, group_col)
        if qtype == "correlation":
            return _analyze_correlation(df, numeric_cols)
        if qtype == "outlier":
            return _analyze_outlier(df, metrics, group_col)
        if qtype == "forecast":
            return _analyze_forecast(df, metrics, date_col) if date_col else None
        if qtype == "aggregate":
            return _analyze_aggregate(df, metrics, group_col, query_lc)
        if qtype == "whatif":
            return _analyze_whatif(df, metrics, query_lc)
        # general
        return _analyze_general(df, metrics, group_col, date_col, query_lc)
    except Exception as exc:
        logger.warning("smart_analysis failed: %s", exc)
        return None
