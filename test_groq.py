"""Portable smoke tests for the conversational helper.

This replaces the previous machine-specific scratch script so pytest can
collect it anywhere the repository is checked out.
"""

from __future__ import annotations

import pandas as pd

from modules.ai_conversation import sanitize_ai_output, _split_insight_and_code


def test_sanitize_ai_output_removes_markup_and_labels():
    raw = "## Summary\n\n**Revenue** increased by 10%.\n\nKey Findings:\n- One\n- Two\n```python\nprint('x')\n```"

    cleaned = sanitize_ai_output(raw)

    assert "##" not in cleaned
    assert "Key Findings" not in cleaned
    assert "```" not in cleaned
    assert "Summary" in cleaned
    assert "Revenue" in cleaned


def test_split_insight_and_code_extracts_code_block():
    raw = "Insight:\nRevenue improved.\n\nCode:\n```python\ncharts = []\nresult = df\n```"

    prose, code = _split_insight_and_code(raw)

    assert prose == "Revenue improved."
    assert "charts = []" in code
    assert "result = df" in code


def test_pandas_import_is_available_for_helpers():
    df = pd.DataFrame({"Department": ["Sales", "HR"], "Budget": [1000, 500]})

    assert list(df.columns) == ["Department", "Budget"]
