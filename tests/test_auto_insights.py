import pandas as pd

from modules.auto_insights import generate_auto_insights


def test_generate_auto_insights_basic():
    df = pd.DataFrame(
        {
            "Region": ["North", "South", "North", "East"],
            "Revenue": [100, 200, 50, 75],
            "Quarter": ["Q1", "Q1", "Q2", "Q2"],
        }
    )

    insights = generate_auto_insights(df)

    # Should generate at least a couple of insights
    assert len(insights) >= 2
    # Should mention the top contributor somewhere
    assert any("contributes" in s for s in insights)


def test_generate_auto_insights_empty_dataframe():
    df = pd.DataFrame(columns=["Region", "Revenue"])
    assert generate_auto_insights(df) == []

