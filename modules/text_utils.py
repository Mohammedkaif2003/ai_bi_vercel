import re
from html import unescape


def clean_text(text: str) -> str:
    if not text:
        return ""

    text = unescape(str(text))
    text = re.sub(r"</?[^>]+>", "", text)
    text = re.sub(r"<div\s+style=\"?", "", text, flags=re.IGNORECASE)
    lines = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if stripped in {'">', '"}', "</div>", "<div style=\"", "<div style="}:
            continue
        if stripped.lower().startswith("div style="):
            continue
        if re.match(r"^(background|padding|border-radius|max-width|font-size|line-height|color|border)\s*:", stripped):
            continue
        lines.append(stripped)
    text = "\n".join(lines)
    text = re.sub(r"\n\s*\n", "\n\n", text)

    return text.strip()


def structure_response(text: str) -> dict:
    sections = {
        "EXECUTIVE INSIGHT": [],
        "KEY FINDINGS": [],
        "BUSINESS IMPACT": [],
        "LIMITATIONS": [],
        "RECOMMENDATIONS": [],
    }

    current_section = None

    for line in text.split("\n"):
        line = line.strip()

        if not line:
            continue

        upper = line.upper().replace(":", "")

        if upper in sections:
            current_section = upper
            continue

        if line.startswith("-") and current_section:
            sections[current_section].append(line[1:].strip())

    return sections
