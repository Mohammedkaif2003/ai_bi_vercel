"""Minimal performance timing helpers used by tests.

This module provides a tiny shim around a `st.session_state` store. Tests
monkeypatch the module-level `st` object with a dummy that has a
`session_state` dict.
"""
import time
import uuid

# Streamlit placeholder - tests will monkeypatch this module attribute.
st = None

# Keep a small history by default; tests expect trimming behavior.
MAX_TIMING_HISTORY = 10


def _ensure_perf_state() -> None:
    if st is None or not hasattr(st, "session_state"):
        return
    ss = st.session_state
    ss.setdefault("perf_timings", {})
    ss.setdefault("perf_timings_history", {})
    ss.setdefault("perf_timing_events", [])
    ss.setdefault("perf_session_id", str(uuid.uuid4()))


def record_timing(metric: str, value_ms: float) -> None:
    """Record a timing value (rounded) and keep an event log."""
    _ensure_perf_state()
    ss = st.session_state
    rounded = round(float(value_ms), 2)

    ss["perf_timings"][metric] = rounded

    history = ss["perf_timings_history"].get(metric, [])
    history.append(rounded)
    if len(history) > MAX_TIMING_HISTORY:
        history = history[-MAX_TIMING_HISTORY:]
    ss["perf_timings_history"][metric] = history

    event = {
        "session_id": ss.get("perf_session_id"),
        "dataset_name": ss.get("dataset_name"),
        "metric": metric,
        "timestamp": time.time(),
        "value_ms": rounded,
    }
    ss["perf_timing_events"].append(event)


def clear_timings() -> None:
    if st is None or not hasattr(st, "session_state"):
        return
    ss = st.session_state
    ss["perf_timings"] = {}
    ss["perf_timings_history"] = {}
    ss["perf_timing_events"] = []
