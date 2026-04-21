# Changelog

All notable changes to Apex Analytics are documented in this file.

The format loosely follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added
- **Login gate** (`auth.py`): SHA-256 hashed credentials stored in a local, git-ignored `users.json`. Ships with two demo users (`admin / admin123`, `analyst / analyst123`). Sidebar user badge with sign-out.
- **Narrative executive PDF** (`modules/report_generator.py`): cover page with dataset metadata, executive summary assembled from the AI's own replies, per-question prose sections with a quoted question, AI response, supporting visual, and compact reference table. Page numbers, accent rules, and a confidentiality footer.
- **Session-persistent tab navigation** (`app.py`, `styles.py`): replaces `st.tabs` with a radio-based nav keyed into `st.session_state["active_tab"]`. Clicking buttons inside a tab — follow-up suggestions, "try asking" chips, Generate PDF — no longer kicks the user back to Data Overview on rerun.
- **Live analysis indicator** (`modules/app_tabs.py`, `styles.py`): self-contained hero card with a green pulse dot plus animated typing dots. Replaces the previous structure where the Clear Chat button was being absorbed into the flex container.
- **CHANGELOG.md** (this file).

### Changed
- **Chart palette** (`modules/auto_visualizer.py`): bar charts now use a discrete multi-color palette (`SERIES_PALETTE`) with one distinct color per bar instead of a continuous scale that collapsed to a single color when values were equal. Histograms use a solid indigo with white bar outlines.
- **Chart card rendering** (`ui_components.py`): `render_chart_card` now renders a `copy.deepcopy` of the figure so the dark-theme mutations (paper bg, font color, etc.) do not follow the chart into `session_state` or the PDF generator. Fixes the case where the PDF showed solid-black bars.
- **PDF chart export** (`modules/report_generator.py`): `_plotly_to_bytes` deep-copies the figure and force-resets every trace's color to a bright, print-safe palette (`_EXPORT_PALETTE`). Applies a clean light-theme layout, axis styling, and text colors. Each trace type (bar, scatter, line, pie, histogram) is handled explicitly so label text and slice colors read correctly on paper.
- **`.gitignore`**: expanded to exclude `users.json`, `AI_Executive_Report.pdf`, `.streamlit/secrets.toml`, editor/IDE state, log files, and OneDrive/sync clutter.
- **README.md**: updated for the login gate, narrative PDF, session-persistent nav, and new project structure.

### Fixed
- Buttons in AI Analyst and Reports tabs resetting the active tab to Data Overview on rerun.
- Graphs in the exported PDF rendering as solid black due to dark-theme residue being carried into the export.
- AI Analyst charts looking monotone when the underlying data had several equal values (continuous color scale collapsed to a single shade).
- "Live analysis ready" status layout being broken because the surrounding `chat-shell` div was left open and swallowed the Clear Chat button into the flex row.
