import pandas as pd

from modules.kpi_engine import generate_kpis


def test_generate_kpis_numeric_only():
    df = pd.DataFrame(
        {
            "MetricA": [10, 20, 30],
            "MetricB": [5, 5, 10],
        }
    )

    kpis = generate_kpis(df)

    # Should return at least one KPI and no more than 5
    assert 1 <= len(kpis) <= 5
    first = kpis[0]
    assert first["metric"] in df.columns or "Revenue" in first["metric"]
    assert "total" in first


def test_generate_kpis_sales_like_dataset():
    df = pd.DataFrame(
        {
            "Region": ["A", "B", "A"],
            "Revenue": [100.0, 50.0, 150.0],
            "Profit": [40.0, 10.0, 50.0],
            "MarginPct": [40.0, 20.0, 33.0],
        }
    )

    kpis = generate_kpis(df)

    metrics = [k["metric"] for k in kpis]

    assert "Total Revenue" in metrics
    assert "Total Profit" in metrics
    assert "Profit Margin (%)" in metrics


def test_generate_kpis_returns_empty_when_no_numeric_columns():
    df = pd.DataFrame(
        {
            "Region": ["A", "B"],
            "Category": ["X", "Y"],
        }
    )

    assert generate_kpis(df) == []

