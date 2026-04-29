"""Quick prompt generation helpers used by tests."""
from typing import Any
import re


def _format_dataset_label(dataset_name: str | None) -> str:
    if not dataset_name:
        return "this dataset"
    label = re.sub(r"\.[^.]+$", "", str(dataset_name))
    label = re.sub(r"[_-]+", " ", label).strip()
    return label.title()


def _generate_quick_prompts(df: Any, schema: dict, dataset_name: str | None = None) -> list[str]:
    label = _format_dataset_label(dataset_name)
    prompts = [
        f"Top insights for {label}",
        f"Show monthly trend in {label}",
        f"Which category in {label} contributes most to the total?",
    ]
    return prompts
