# 📊 AI Business Intelligence Assistant

An AI-powered business intelligence tool that lets you **upload datasets and ask questions in plain English**. Get instant data analysis, interactive charts, automated KPIs, revenue forecasting, and professional PDF reports — all powered by **Groq's LLaMA 3.3 70B** model.

![Python](https://img.shields.io/badge/Python-3.10+-blue?logo=python&logoColor=white)
![Streamlit](https://img.shields.io/badge/Streamlit-1.30+-FF4B4B?logo=streamlit&logoColor=white)
![Groq](https://img.shields.io/badge/Groq-LLaMA_3.3_70B-orange?logo=meta&logoColor=white)


---

## ✨ Features

### 🤖 AI-Powered Natural Language Analysis
Ask questions about your data in plain English — the AI generates Python code, executes it securely, and returns results with charts and insights.

> *"Show total revenue by region"* → Data table + bar chart + business insight + follow-up suggestions

### 📊 Interactive Dashboard
- **Data Overview** — Dataset preview, column details, descriptive statistics
- **KPI Cards** — Auto-extracted Key Performance Indicators (Total, Average, Max, Min)
- **Auto-Insights** — Trend detection, top/bottom performers, quarter-over-quarter comparisons

### 🔮 Revenue Forecasting
- Linear trend projection with confidence intervals
- Configurable forecast periods (1–12 months)
- Combined historical + forecast visualization

### 📑 Professional PDF Reports
- **Multi-query reports** — All your analysis queries compiled into one document
- **Branded design** — Cover page, table of contents, styled data tables, charts
- **Blue accent headers, gold query boxes, page numbers, confidential footer**
- **Strategic recommendations** auto-generated from data patterns

### 🔒 Secure Code Execution
AI-generated code runs in a sandboxed environment with:
- 13 forbidden keyword patterns blocked (`import`, `os.`, `subprocess`, `exec`, etc.)
- Import statements auto-stripped before execution
- Only `pandas` and `numpy` available in scope

---

## 🚀 Quick Start

### Prerequisites
- Python 3.10+
- A free [Groq API Key](https://console.groq.com)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Mohammedkaif2003/Mohammedkaif2003-ai_business_intelligence_assistant.git
cd Mohammedkaif2003-ai_business_intelligence_assistant

# 2. Create and activate virtual environment
python -m venv venv
venv\Scripts\Activate.ps1          # Windows PowerShell
# source venv/bin/activate          # Mac/Linux

# 3. Install dependencies
pip install -r requirements.txt

# 4. Set up your API key
# Create a .env file in the project root:
echo GROQ_API_KEY=your_key_here > .env

# 5. Run the application
streamlit run app.py
```

The app opens at **http://localhost:8501** 🎉

---

## 📁 Project Structure

```
├── app.py                        # Main Streamlit application
├── requirements.txt              # Python dependencies
├── .env                          # API key (not committed)
│
├── data/raw/                     # Pre-loaded sample datasets
│   ├── sales_data.csv            # Sales transactions
│   ├── hr_data.csv               # HR employee data
│   └── finance_data.csv          # Financial records
│
├── modules/
│   ├── ai_code_generator.py      # Groq AI → Python code generation
│   ├── code_executor.py          # Sandboxed code execution
│   ├── data_loader.py            # CSV loading & column normalization
│   ├── dataset_analyzer.py       # Schema detection & analysis
│   ├── auto_visualizer.py        # Auto chart generation (bar, line, pie)
│   ├── auto_insights.py          # Automated business insights
│   ├── insight_engine.py         # Query-specific business insights
│   ├── executive_summary.py      # Executive summary bullets
│   ├── kpi_engine.py             # KPI extraction (with HR/Sales specials)
│   ├── forecasting.py            # Linear trend forecasting
│   ├── groq_ai.py                # Follow-up question suggestions
│   └── report_generator.py       # Professional PDF report generator
│
├── PROJECT_DOCUMENTATION.md      # Full technical documentation
└── INITIAL_VS_ENHANCED.md        # Changelog: initial vs enhanced version
```

---

## 🛠️ How It Works

```
User uploads CSV / selects pre-loaded dataset
        │
        ▼
  Column Normalization (data_loader.py)
  Schema Analysis (dataset_analyzer.py)
  Auto-KPIs (kpi_engine.py)
  Auto-Insights (auto_insights.py)
        │
        ▼
  ┌─────────────────────────────────┐
  │  User asks a question in chat   │
  │                                 │
  │  AI Code Generator (Groq API)   │
  │     └→ Python/Pandas code       │
  │                                 │
  │  Sandboxed Executor             │
  │     └→ DataFrame result         │
  │                                 │
  │  Auto-Visualizer → Plotly charts│
  │  Insight Engine  → AI insights  │
  │  Groq AI → Follow-up questions  │
  └─────────────────────────────────┘
        │
        ▼
  Executive Report Generator → Branded PDF
```

---

## 📦 Dependencies

| Package | Purpose |
|---------|---------|
| `streamlit` | Web application framework |
| `pandas` | Data manipulation & analysis |
| `numpy` | Numerical computing |
| `plotly` | Interactive visualizations |
| `matplotlib` | Chart generation for PDFs |
| `groq` | Groq API client (LLaMA 3.3 70B) |
| `reportlab` | Professional PDF generation |
| `python-dotenv` | Environment variable management |
| `scikit-learn` | Machine learning utilities |
| `statsmodels` | Statistical models |
| `seaborn` | Statistical visualization |

---

## 🔧 Configuration

| Setting | Location | Description |
|---------|----------|-------------|
| `GROQ_API_KEY` | `.env` file | Your Groq API key ([get one free](https://console.groq.com)) |
| Model | `ai_code_generator.py` | `llama-3.3-70b-versatile` |
| Temperature | Code gen: `0.1` / Suggestions: `0.3` | Lower = more deterministic |

---

## 📋 Sample Datasets

The app comes with 3 pre-loaded datasets for testing:

| Dataset | Records | Use Case |
|---------|---------|----------|
| **Sales Data** | ~5,000+ rows | Revenue analysis, product performance, regional trends |
| **HR Data** | ~1,470 rows | Employee attrition, department analytics, satisfaction |
| **Finance Data** | ~50 rows | Financial metrics, budget analysis |

---

## 🔐 Security

- **No arbitrary code execution** — AI output is filtered through 13 forbidden patterns
- **Import stripping** — `import` and `from` lines removed before execution
- **Sandboxed scope** — Only `pandas` and `numpy` available
- **API keys** stored in `.env` (never committed via `.gitignore`)

---

## 📄 Documentation

- **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** — Full technical docs: every module, function, data flow, security model
- **[INITIAL_VS_ENHANCED.md](INITIAL_VS_ENHANCED.md)** — Detailed changelog comparing the initial repo to the enhanced version

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/my-feature`)
3. Commit your changes (`git commit -m "Add my feature"`)
4. Push to the branch (`git push origin feature/my-feature`)
5. Open a Pull Request

---



---

<div align="center">
  <b>Built with ❤️ using Streamlit + Groq AI</b>
</div>
