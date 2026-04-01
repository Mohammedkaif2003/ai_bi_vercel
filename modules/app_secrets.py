import os

import streamlit as st


def get_secret(name: str, default=None):
    value = os.getenv(name)
    if value:
        return value

    try:
        return st.secrets.get(name, default)
    except Exception:
        return default
