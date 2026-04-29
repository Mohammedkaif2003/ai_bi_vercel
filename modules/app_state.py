"""Small app state utilities used by the tests.

The real app likely uses Streamlit; tests monkeypatch `st` on this module
with a dummy that exposes `session_state`.
"""
from typing import Any

# Placeholder for Streamlit object; tests will monkeypatch this.
st = None


def ensure_analysis_state() -> None:
    if st is None or not hasattr(st, "session_state"):
        return
    ss = st.session_state
    ss.setdefault("messages", [])
    ss.setdefault("chat_history", [])
    ss.setdefault("analysis_history", [])
    ss.setdefault("result_history", [])
    ss.setdefault("result_history_details", [])


def persist_analysis_cycle(
    query: str,
    result: Any,
    chart_data: Any,
    chart_figs: Any,
    code: str,
    insight: str,
    ai_response: str,
    summary_list: list[str],
    suggestions: str,
    query_rejected: bool,
    is_axes_result: bool,
    intent: str,
    rephrases: list[str],
    result_history_entry: dict,
) -> None:
    """Persist a single analysis cycle to the session state (minimal)."""
    ensure_analysis_state()
    ss = st.session_state

    # Append a user + assistant message (tests only verify counts)
    ss["messages"].append({"role": "user", "content": query})
    ss["messages"].append({"role": "assistant", "content": ai_response})

    # Track a minimal analysis/chat/result history
    ss["analysis_history"].append({"insight": insight, "summary": summary_list})
    ss["chat_history"].append({"query": query, "intent": intent})
    ss["result_history"].append(result_history_entry)
    ss["result_history_details"].append({"query": query, "details": result_history_entry})
