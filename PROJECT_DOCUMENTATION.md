# Nexlytics Project Documentation

## 1. Overview

Nexlytics is a CSV-based business intelligence application. Users can sign in, load a sample dataset or upload their own CSV, inspect KPIs and automated insights, ask plain-English analysis questions, create forecasts, and export executive PDF reports.

The current production path is a Next.js application backed by Python API routes for Vercel. The older Streamlit app remains in the repository for local Python development.

## 2. Runtime Architecture

```text
Browser
  |
  | Next.js pages and React components
  v
pages/index.tsx              Sign-in screen
pages/dashboard.tsx          Main BI workspace
  |
  | lib/api.ts fetch calls
  v
api/*.py                     Python serverless endpoints
  |
  | shared analytics/reporting modules
  v
modules/*.py                 pandas, Plotly, AI narration, forecasting, PDF generation
```

The application follows a compute-first model:

1. Python/pandas computes the analytical result.
2. Python/Plotly selects and builds charts.
3. AI providers narrate already-computed results where useful.
4. Guarded fallback paths handle novel or ambiguous analysis requests.

## 3. Main User Flow

1. User signs in through `pages/index.tsx`.
2. The front end stores the returned token in `sessionStorage`.
3. User opens `pages/dashboard.tsx`.
4. User loads a sample dataset through `/api/datasets` or uploads a CSV through `/api/upload`.
5. The API returns schema, preview rows, KPI cards, insights, and a base64 CSV payload for later analysis.
6. User works through the dashboard tabs:
   - Data Overview
   - AI Analyst
   - Forecasting
   - Reports

## 4. Front End

| Area | Files | Purpose |
|---|---|---|
| Auth page | `pages/index.tsx` | Login form, demo credential disclosure, session setup |
| Dashboard shell | `pages/dashboard.tsx` | Dataset loading, tab navigation, sign-out, high-level state |
| API client | `lib/api.ts` | Typed wrappers around `/api/*` endpoints |
| Types | `lib/types.ts` | Shared TypeScript interfaces |
| KPI display | `components/KPICards.tsx` | Dashboard KPI cards |
| Analyst tab | `components/AIAnalyst.tsx` | Question input, analysis results, Plotly charts |
| Forecasting tab | `components/Forecasting.tsx` | Forecast controls and results |
| Reports tab | `components/Reports.tsx` | PDF report generation |
| Charts | `components/PlotlyChart.tsx` | Plotly rendering wrapper |

## 5. Python API Routes

| Route | File | Methods | Purpose |
|---|---|---|---|
| `/api/auth` | `api/auth.py` | POST | Validate user credentials and return a signed token |
| `/api/datasets` | `api/datasets.py` | GET, POST | List bundled datasets and load a selected dataset |
| `/api/upload` | `api/upload.py` | POST | Decode, validate, and analyze uploaded CSVs |
| `/api/analyze` | `api/analyze.py` | POST | Run plain-English analysis against a dataset |
| `/api/forecast` | `api/forecast.py` | POST | Generate trend forecasts |
| `/api/report` | `api/report.py` | POST | Build an executive PDF report |

Shared serverless helpers live in `api/_utils.py`. They provide CORS handling, JSON responses, token creation/verification, CSV validation, DataFrame serialization, and Plotly serialization.

## 6. Shared Python Modules

| Module | Purpose |
|---|---|
| `modules/smart_analysis.py` | Deterministic pandas analysis for common query patterns |
| `modules/ai_conversation.py` | AI narration and conversational response helpers |
| `modules/ai_code_generator.py` | Guarded LLM code-generation fallback for novel queries |
| `modules/code_executor.py` | Restricted execution environment for generated pandas code |
| `modules/query_utils.py` | Query intent classification, relevance checks, suggestions |
| `modules/auto_visualizer.py` | Plotly chart builders and query-driven chart selection |
| `modules/kpi_engine.py` | Dataset-aware KPI extraction |
| `modules/auto_insights.py` | Automated insight detection |
| `modules/forecasting.py` | Linear trend forecast generation |
| `modules/report_generator.py` | Executive PDF generation |
| `modules/dataset_analyzer.py` | Schema and column profiling |
| `modules/data_loader.py` | CSV loading and column normalization |

The Streamlit-specific modules, such as `modules/app_tabs.py`, `modules/app_views.py`, and `modules/app_state.py`, support `app.py`.

## 7. Analysis Pipeline

```text
User question
  |
  v
Validate dataset relevance
  |
  v
Try deterministic smart analysis
  |
  | success
  v
Return computed result + Plotly chart + AI narration

  |
  | fallback path
  v
Try simple query detection
  |
  | fallback path
  v
Generate guarded pandas code
  |
  v
Execute in restricted environment
  |
  v
Return result, chart, and prose response
```

The preferred path is deterministic and does not require the model to invent calculations. AI is used to explain results, suggest follow-up questions, or handle analysis patterns outside the deterministic engine.

## 8. Environment Variables

| Variable | Required | Purpose |
|---|---:|---|
| `GROQ_API_KEY` | One AI key required | Groq narration and analysis support |
| `GOOGLE_API_KEY` | Optional | Google Generative AI fallback/support |
| `AUTH_SECRET` | Production | Token signing secret |
| `ALLOWED_ORIGINS` | Optional | Comma-separated CORS allowlist |
| `ALLOW_DEMO_USERS` | Optional | Enable or disable built-in demo users |
| `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS` | Optional | Show or hide demo credentials in the UI |
| `ADMIN_USERNAME` | Optional | Custom default admin username |
| `ADMIN_PASSWORD` | Optional | Custom default admin password |
| `ADMIN_DISPLAY_NAME` | Optional | Custom default admin display name |
| `AUTH_USERS_JSON` | Optional | Full user map with password hashes |
| `MAX_BODY_BYTES` | Optional | Request body limit |
| `MAX_CSV_BYTES` | Optional | CSV upload byte limit |
| `MAX_CSV_ROWS` | Optional | CSV row limit |
| `MAX_CSV_COLUMNS` | Optional | CSV column limit |
| `AUTH_TOKEN_TTL_SECONDS` | Optional | Token lifetime |

Use `.env.local` for local Next.js/Vercel development and configure production values in the Vercel dashboard.

## 9. Local Development

Install dependencies:

```powershell
npm install
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Run the full local stack:

```powershell
vercel dev
```

Run only the Next.js front end:

```powershell
npm run dev
```

Run the legacy Streamlit app:

```powershell
pip install -r requirements-streamlit.txt
streamlit run app.py
```

## 10. Testing and Verification

Run Python tests:

```powershell
python -m pytest -q
```

Run the Next.js production build:

```powershell
npm run build
```

## 11. Security Model

- API tokens are signed with `AUTH_SECRET`.
- Production requires an explicit `AUTH_SECRET`.
- Uploaded CSVs are decoded and checked against body, byte, row, and column limits.
- Most analytical questions use deterministic pandas logic.
- Generated code is reserved for fallback use and is scanned for unsafe keywords before execution.
- Serverless functions return JSON errors instead of raw exceptions.
- Real credentials and provider keys should stay out of version control.

## 12. Deployment Notes

Vercel uses:

- `package.json` for the Next.js build.
- `vercel.json` for framework/function configuration.
- `requirements.txt` for Python serverless dependencies.
- Environment variables from Project Settings.

Recommended production settings:

```env
AUTH_SECRET=<long-random-secret>
ALLOW_DEMO_USERS=false
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false
ALLOWED_ORIGINS=https://your-production-domain.example
```

## 13. Demo Script

1. Sign in with a demo or configured user.
2. Load `sales_data.csv` from the sample dataset selector.
3. Review KPI cards and automatic insights.
4. Ask: `What are the top regions by revenue?`
5. Ask: `Show revenue trend over time.`
6. Open Forecasting and generate a six-period forecast.
7. Open Reports and export the analysis history as a PDF.

## 14. Version Note

This document reflects the Next.js + Vercel architecture as of April 2026. The Streamlit app remains available as a legacy local workflow.
