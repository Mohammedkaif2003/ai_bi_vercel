"""Dataset activation helper used in tests.

This file provides a tiny `activate_dataset` function that updates
`st.session_state` with the active dataset and a computed schema.
"""
from typing import Any

# Placeholder for Streamlit object; tests will monkeypatch this.
st = None


def _build_basic_schema(df) -> dict:
    return {
        "numeric_columns": df.select_dtypes(include="number").columns.tolist(),
        "categorical_columns": df.select_dtypes(exclude="number").columns.tolist(),
        "datetime_columns": [c for c in df.columns if "date" in c.lower()],
        "column_names": df.columns.tolist(),
    }


def activate_dataset(dataset_key: str, df: Any) -> bool:
    if df is None:
        return False

    if st is None or not hasattr(st, "session_state"):
        return False

    ss = st.session_state

    # If the same dataset is already active and the dataframe matches, do nothing
    if ss.get("active_dataset_key") == dataset_key:
        existing = ss.get("df")
        if existing is not None:
            try:
                if existing.equals(df):
                    return False
            except Exception:
                if existing is df:
                    return False
        else:
            return False

    ss["active_dataset_key"] = dataset_key
    ss["dataset_name"] = dataset_key
    ss["df"] = df

    # Try to use the project's analyzer if available, otherwise build a simple schema
    try:
        from modules.dataset_analyzer import analyze_dataset

        schema = analyze_dataset(df)
    except Exception:
        schema = _build_basic_schema(df)

    ss["schema"] = schema
    return True
