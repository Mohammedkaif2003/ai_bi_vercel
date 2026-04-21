# Apex Analytics

AI-powered business intelligence assistant built with Streamlit, Pandas, Plotly, and Groq. The app turns uploaded CSV data into KPI cards, quick insights, natural-language analysis, forecasts, and a narrative executive PDF — all behind a session login.

## What This Project Does

`Apex Analytics` is designed for analysts, founders, and business teams who want to explore tabular data without writing SQL or Python for every question.

Core workflows:

- Sign in (hashed-credential demo auth, per-user sidebar badge)
- Upload a CSV or choose a bundled sample dataset
- Review KPIs, statistics, and auto-generated insights
- Ask business questions in plain English
- Get tables, charts, summaries, and follow-up suggestions
- Run a simple revenue or sales forecast
- Export a narrative-style executive PDF report written from the AI's replies

## Why It Stands Out

- Strong dark-mode dashboard UI with polished interactions and a session-persistent tab nav (buttons no longer kick you back to Data Overview)
- Plain-English data analysis powered by Groq-backed code generation
- Vibrant, multi-color auto-generated charts with readable data labels
- Narrative executive PDF — cover page, exec summary, per-question prose, supporting visuals — not a dashboard dump
- Built-in business insight generation, not just raw chart output
- Forecasting and PDF reporting included in the same product flow
- Sample datasets and tests included for quick evaluation

## Feature Overview

### Dashboard

- KPI cards with trend treatment and dataset-aware quick insights
- Dataset preview, column details, descriptive statistics
- Hero chart for the loaded dataset when suitable dimensions are available
- Search, sort, and filter controls for table views

### AI Analyst

- Chat-style interface for dataset questions
- Structured AI responses, summaries, and follow-up prompts
- Auto-generated charts when the result shape supports visualization
- Guardrails to reject irrelevant questions and handle failures cleanly

### Forecasting

- Trend projection from date-like and numeric columns
- Forecast table, confidence bounds, and chart output
- Works best with monthly or date-driven revenue and sales data

### Reports

- Narrative executive briefing exported as PDF (not a dashboard printout)
- Cover page with dataset, analyst, and timestamp metadata
- Executive summary drafted from the AI's own replies
- Per-question sections: original question quote, AI analyst prose, supporting chart, compact reference table
- Bright, print-safe chart palette so bars read clearly on white paper
- Page numbers, proper typography, and confidentiality disclaimer

### Login & Session

- Hashed-credential login gate (SHA-256)
- Default demo users: `admin / admin123` and `analyst / analyst123`
- Sidebar user badge with sign-out
- `users.json` is local-only and git-ignored

## Tech Stack

- Python
- Streamlit
- Pandas
- Plotly
- Groq API
- ReportLab
- NumPy
- scikit-learn
- statsmodels

## Project Structure

```text
.
|-- app.py
|-- auth.py
|-- config.py
|-- requirements.txt
|-- styles.py
|-- ui_components.py
|-- PROJECT_DOCUMENTATION.md
|-- CHANGELOG.md
|-- data/
|   `-- raw/
|       |-- finance_data.csv
|       |-- hr_data.csv
|       `-- sales_data.csv
|-- modules/
|   |-- ai_code_generator.py
|   |-- ai_conversation.py
|   |-- app_secrets.py
|   |-- app_tabs.py
|   |-- app_views.py
|   |-- auto_insights.py
|   |-- auto_visualizer.py
|   |-- code_executor.py
|   |-- data_loader.py
|   |-- dataset_analyzer.py
|   |-- executive_summary.py
|   |-- forecasting.py
|   |-- groq_ai.py
|   |-- insight_engine.py
|   |-- kpi_engine.py
|   |-- query_utils.py
|   |-- report_generator.py
|   `-- text_utils.py
`-- tests/
    |-- test_auto_insights.py
    |-- test_forecasting.py
    |-- test_kpi_engine.py
    `-- test_query_utils.py
```

## Quick Start

### 1. Create a virtual environment

```powershell
python -m venv venv
venv\Scripts\Activate.ps1
```

### 2. Install dependencies

```powershell
pip install -r requirements.txt
```

### 3. Add your Groq API key

Create a `.env` file in the project root:

```env
GROQ_API_KEY=your_groq_key_here
```

### 4. Run the app

```powershell
streamlit run app.py
```

Open `http://localhost:8501` and sign in with one of the demo users:

- `admin / admin123`
- `analyst / analyst123`

## Demo Flow

Recommended walkthrough for a recruiter, teammate, or portfolio review:

1. Sign in (demo credentials above).
2. Load `Sales Data` from the sidebar.
3. Show the KPI row, quick insights panel, and hero chart.
4. Open `AI Analyst` and ask:
   - `Top 5 regions by revenue`
   - `Revenue trend`
   - `Profit by category`
   Click a follow-up suggestion — the nav stays on AI Analyst (session-persistent).
5. Open `Forecasting` and generate a 6-month forecast.
6. Open `Reports` and generate the narrative PDF — download and open it to show the cover page, executive summary, and per-question prose sections.

## Sample Datasets

- `sales_data.csv`: revenue-style business analytics
- `hr_data.csv`: workforce and attrition analytics
- `finance_data.csv`: budget and variance analysis

## Testing

Run the automated tests from the project root:

```powershell
python -m pytest -q
```

Current coverage focuses on:

- KPI generation
- auto-insight generation
- forecasting behavior
- dataset query routing helpers

## Security and Guardrails

- API keys are read from environment variables or `.env`
- AI-generated code is filtered before execution
- Irrelevant questions are rejected before code generation
- Result rendering falls back safely for unsupported outputs

## Known Limitations

- Forecasting is intentionally simple and trend-based, not a full forecasting pipeline
- AI quality depends on dataset cleanliness and question phrasing
- PDF output is optimized for summary reporting, not raw data export
- Code execution is guarded, but this is still a local prototype application

## Recommended Next Improvements

- Split `app.py` into page-level feature modules
- Expand tests around report generation and data loading
- Add screenshots or a GIF demo to the repository
- Add deployment instructions for Streamlit Community Cloud or Render

## Documentation

See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for the full technical walkthrough.
