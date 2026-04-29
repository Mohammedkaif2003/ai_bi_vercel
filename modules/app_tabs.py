"""Small helpers for generating dynamic prompts used by tests."""
from typing import Any
import re


# Public functions used in tests
def _format_dataset_label(dataset_name: str | None) -> str:
    if not dataset_name:
        return "this dataset"
    label = re.sub(r"\.[^.]+$", "", str(dataset_name))
    label = re.sub(r"[_-]+", " ", label).strip()
    return label.title()


def _generate_dynamic_query_suggestions(df: Any, schema: dict, dataset_name: str | None = None) -> list[str]:
    label = _format_dataset_label(dataset_name)
    prompts = [
        f"Show a short summary of {label}.",
        f"What are the top 3 insights about {label}?",
        f"Compare the main categories in {label}.",
    ]
    return prompts
