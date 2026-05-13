# Nexlytics

Nexlytics is a premium, AI-powered Business Intelligence platform designed for high-performance CSV exploration. It features cinematic data analysis, executive command centers, and high-fidelity trend forecasting, all wrapped in a sophisticated 'Nexlytics Indigo' design system.

The repository currently includes:

- A production-oriented Next.js front end with Python serverless API routes for Vercel.
- **Cinematic Analysis**: Experience 'Intelligence Focus'—a side-by-side analytical stage for deep data synthesis.
- **Executive Command Center**: A persistent, drag-and-drop hub for your most critical cross-dataset insights.
- **High-Fidelity Forecasting**: Generate trend projections with statistical confidence scores and executive data grids.
- **Indigo Design System**: A premium, high-performance UI featuring glassmorphism, cinematic typography, and dynamic motion.
- **Professional Reporting**: Export narrated executive PDF reports from your active analysis session or global history.
- **Automated Intelligence**: Instant KPI extraction, data quality health scores, and trend detection.
- **Deterministic Precision**: Uses pandas/Plotly for primary analysis, with AI used for authoritative narration and synthesis.

## Tech Stack

- Next.js 16, React 18, TypeScript, Tailwind CSS
- Python serverless functions under `api/`
- Pandas, NumPy, Plotly
- Groq and optional Google Generative AI integrations
- ReportLab for PDF generation
- Streamlit legacy app support

## Project Structure

```text
.
|-- pages/                    # Next.js pages
|   |-- index.tsx             # Sign-in page
|   `-- dashboard.tsx         # Main BI dashboard
|-- components/               # React dashboard components
|-- hooks/                    # Client-side state and chat hooks
|-- lib/                      # Front-end API client and shared types
|-- api/                      # Python API routes for Vercel
|   |-- datasets.py
|   |-- upload.py
|   |-- analyze.py
|   |-- forecast.py
|   `-- report.py
|-- modules/                  # Shared Python analytics/reporting logic
|-- data/raw/                 # Sample CSV datasets
|-- tests/                    # Python tests
|-- requirements.txt          # Python dependencies for Vercel/API routes
|-- package.json              # Next.js dependencies and scripts
|-- vercel.json               # Vercel configuration
`-- PROJECT_DOCUMENTATION.md  # Detailed technical documentation
```

## Environment Variables

Copy `.env.example` to `.env.local` for the Next.js/Vercel workflow:

```powershell
Copy-Item .env.example .env.local
```

At minimum, set one AI provider key:

```env
GROQ_API_KEY=your_groq_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
AUTH_SECRET=change-this-to-a-long-random-value
```

Useful optional settings:

```env
ALLOW_DEMO_USERS=true
NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=true
ALLOWED_ORIGINS=http://localhost:3000
```

For production, configure these variables in Vercel under Project Settings -> Environment Variables. Do not commit real secrets.

## Quick Start: Next.js + Python APIs

Install Node dependencies:

```powershell
npm install
```

Install Python dependencies:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

Run the full local Vercel environment:

```powershell
npm i -g vercel
vercel dev
```

Open the local URL shown by Vercel, usually `http://localhost:3000`.

Demo credentials are available when demo users are enabled:

- `admin / admin123`
- `analyst / analyst123`

You can also run only the Next.js front end:

```powershell
npm run dev
```

Use `vercel dev` when you need the Python API routes under `/api`.

## Deploy to Vercel

1. Push the repository to GitHub.
2. Import the project in Vercel.
3. Add the required environment variables.
4. Deploy.

The included `vercel.json` declares the Next.js framework and configures Python API route execution.

You can also deploy from the CLI:

```powershell
vercel --prod
```

## Sample Datasets

Bundled datasets live in `data/raw/`:

- `sales_data.csv`
- `hr_data.csv`
- `finance_data.csv`

These are useful for demos and local testing without uploading your own data.

## Demo Script

For a quick walkthrough:

1. Sign in with `admin / admin123` or another configured user.
2. Load the Sales sample dataset.
3. Review the KPI cards, schema summary, preview rows, and automatic insights.
4. Open AI Analyst and ask: `What are the top regions by revenue?`
5. Ask: `Show revenue trend over time.`
6. Open Forecasting and generate a six-period forecast.
7. Open Reports and export the analysis history as a PDF.

## Testing

Run the Python test suite:

```powershell
python -m pytest -q
```

Run the Next.js production build:

```powershell
npm run build
```

## Security Notes

- Secrets should live in `.env.local`, `.env`, or Vercel environment variables.
- `AUTH_SECRET` should be a long random value in production.
- Disable demo users in production with `ALLOW_DEMO_USERS=false`.
- Hide demo credentials in production with `NEXT_PUBLIC_SHOW_DEMO_CREDENTIALS=false`.
- Uploaded CSVs are validated with size, row, and column limits from the environment configuration.

## Documentation

See [PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md) for deeper architecture notes and implementation details.
