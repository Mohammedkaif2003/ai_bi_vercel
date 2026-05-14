import os
import re
from typing import Any
from html import unescape
from dotenv import load_dotenv
import pandas as pd
from modules.app_secrets import get_secret

# Try to import the modern Google AI SDK, but fall back gracefully
try:
    from google import genai
    from google.genai import types
except ImportError:
    genai = None  # type: ignore
    types = None  # type: ignore

load_dotenv()

_BULLET_PREFIX = re.compile(r"^\s*([-*•·]|\d+[.)])\s+")
_BOLD_HEADER = re.compile(r"\*\*(.+?)\*\*")
_HEADING_LINE = re.compile(r"^\s*#{1,6}\s+", flags=re.MULTILINE)
_KNOWN_SCAFFOLD = re.compile(
    r"^\s*(executive insight|key findings|business impact|"
    r"limitations|recommendations|summary|takeaways?|insights?|"
    r"analysis)\s*:\s*$",
    flags=re.IGNORECASE | re.MULTILINE,
)


def sanitize_ai_output(text: str) -> str:
    """Force the model's reply into professional prose: strip HTML, code fences,
    and well-known section labels, but preserve markdown bolding and bullets
    since the frontend supports them."""
    if not text:
        return ""

    # Convert HTML entities and strip tags / fences.
    text = unescape(str(text))
    text = re.sub(r"</?[^>]+>", "", text)
    text = text.replace("```", "")

    # Drop markdown headings and known scaffolding labels entirely.
    text = _HEADING_LINE.sub("", text)
    text = _KNOWN_SCAFFOLD.sub("", text)

    # Join lines but preserve bullet points and lists
    cleaned_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue
        cleaned_lines.append(line)

    return "\n\n".join(cleaned_lines)
GROQ_API_KEY = get_secret("GROQ_API_KEY")
GOOGLE_API_KEY = get_secret("GOOGLE_API_KEY")

# ═══════════════════════════════════════════════════
#  SENIOR DATA ANALYST SYSTEM PROMPT
# ═══════════════════════════════════════════════════

ANALYST_SYSTEM_PROMPT = """You are a Senior Business Intelligence Analyst.
Your primary directive is **STRICT NUMERICAL GROUNDING**. 

Answer in professional, analytical prose. You MAY use bolding (**word**) and bullet points to highlight key metrics or findings.

CRITICAL TRUTH RULES:
- The data provided in 'Data returned', 'First rows', and 'Statistical summary' is your ONLY source of truth.
- NEVER invent trends, categories, or numbers not explicitly present in the provided snippet.
- Cross-check your prose against the data before responding. If the graph shows 10 items, but the snippet only shows 8, acknowledge only what is in the snippet.
- If a calculation is provided (e.g. Sum, Average), use it exactly.

ABSOLUTE FORMAT RULES:
- Use 1-2 short paragraphs or a structured list of 3-5 bullets.
- Never use markdown headings (# / ## / ###).
- Never use section labels like "Key Findings:", "Summary:", etc.
- Just start with the answer. No "Based on the data..." filler.

CONTENT RULES:
- Reference specific numbers and categories.
- Keep the whole answer under ~120 words.
"""

REFLECTOR_SYSTEM_PROMPT = """You are a Data Logic Assistant. The user asked a question about a dataset, but the specific columns or metrics they mentioned weren't found.
Analyze the user's query and the available column list. 
If the query is ambiguous, suggest 2-3 likely columns and explain briefly why.
Example: "I couldn't find 'revenue', but I see 'Total_Sales' and 'Invoiced_Amount'. Which should I use?"
Keep it helpful, professional, and concise (under 40 words)."""

def _build_data_context(result, insight=""):
    """Build a rich data summary for the AI to analyze."""
    data_summary = ""
    if isinstance(result, pd.DataFrame):
        stats = ""
        numeric_cols = result.select_dtypes(include="number").columns
        if len(numeric_cols) > 0:
            desc = result[numeric_cols].describe().to_string()
            stats = f"\nStatistical summary:\n{desc}"

        data_summary = f"""Data returned: DataFrame with {result.shape[0]} rows and {result.shape[1]} columns.
Columns: {', '.join(str(c) for c in result.columns)}
Data Snippet (up to 50 rows):
{result.head(50).to_string(index=False)}
{stats}
"""
    elif isinstance(result, pd.Series):
        data_summary = f"""Data returned: Series with {len(result)} values.
Name: {result.name}
{result.head(15).to_string()}
"""
    elif isinstance(result, str):
        data_summary = f"Result: {result[:800]}"
    else:
        data_summary = f"Result: {str(result)[:800]}"

    if insight:
        data_summary += f"\nPreliminary insight: {insight}"

    return data_summary


ANALYST_CONCISE_PROMPT = """You are a Senior Data Analyst and Data Visualization Engineer.

You receive a pandas DataFrame named `df` and a user question.
Your job is to:
1. Answer the question with specific numbers and insights (3-5 sentences).
2. Generate a Plotly chart that best visualises the answer.

ANALYSIS RULES:
- Reference actual column names and real values from the data.
- Identify trends, patterns, anomalies, or comparisons.
- Be direct — no filler phrases like "Based on the data" or "Here is the analysis".

VISUALIZATION RULES:
- ALWAYS generate a chart when the data has a visual angle.
- Use plotly.express (already imported as `px`) — do NOT import anything.
- Choose the best chart type automatically:
    Line chart for time series, bar chart for category comparisons,
    scatter for relationships, box for distributions, heatmap for intensity.
- Label axes clearly and add a descriptive title.
- Store the figure(s) in: charts = [fig]
- Optionally store a computed DataFrame in: result = ...

CODE RULES:
- Do NOT write `import` statements — px, pd, np are pre-loaded.
- Do NOT redefine `df`.
- Do NOT use print().
- Always define `charts = []` at the top of your code block.
- Always define `result = ...` somewhere in the code.

OUTPUT FORMAT (STRICT — follow exactly):

Insight:
<your 3-5 sentence analytical answer>

Code:
```python
charts = []
result = df.groupby('Category')['Value'].sum().reset_index()
fig = px.bar(result, x='Category', y='Value', title='Value by Category')
charts = [fig]
```
"""

# ── Helpers for splitting insight from code in the concise response ──────

_CODE_BLOCK_RE = re.compile(r"```(?:python)?\s*\n?(.*?)```", re.DOTALL)


def _split_insight_and_code(raw_text: str) -> tuple[str, str]:
    """Split an AI response that may contain a fenced code block into
    (insight_prose, chart_code).  If no code block is found, chart_code
    is returned as an empty string."""
    if not raw_text:
        return "", ""

    code_match = _CODE_BLOCK_RE.search(raw_text)
    if not code_match:
        return raw_text.strip(), ""

    chart_code = code_match.group(1).strip()
    # Everything outside the code fence is the insight prose
    prose = _CODE_BLOCK_RE.sub("", raw_text).strip()
    # Strip the "Insight:" / "Code:" labels the prompt asks for
    prose = re.sub(r"(?i)^\s*(insight|code)\s*:\s*", "", prose, flags=re.MULTILINE).strip()
    return prose, chart_code


def generate_conversational_response(query, result, insight="", df=None, concise: bool = False, reflection: bool = False):
    """Generate a professional AI response using Google Gemini (primary)
    with Groq LLaMA as fallback.

    Returns
    -------
    - When ``concise=False``: a plain sanitized string (narrative prose).
    - When ``concise=True``: a dict ``{"text": str, "chart_code": str}``
      where *text* is the sanitized insight paragraph and *chart_code*
      is executable Python (may be empty if the model didn't produce one).
    """

    # Build data summary (with optional dataset context)
    data_summary = _build_data_context(result, insight)

    # Add dataset preview if available (limited to avoid token overflow)
    if df is not None:
        try:
            df_preview = df.head(20).to_string()
            data_summary += f"\n\nGlobal Dataset Preview (First 20 rows):\n{df_preview}"
        except Exception:
            pass

    prompt = f"""The user asked: "{query}"

Here is the analysis result:
{data_summary}

Analyze this data using your senior analyst framework. Be specific to THIS data — no generic responses."""

    # Choose the system prompt depending on concise flag
    if reflection:
        system_prompt = REFLECTOR_SYSTEM_PROMPT
    else:
        system_prompt = ANALYST_CONCISE_PROMPT if concise else ANALYST_SYSTEM_PROMPT
        
    # Allow more tokens when the model is expected to produce code + insight
    max_tokens_gemini = 800 if (concise and not reflection) else 350
    max_tokens_groq = 1000 if (concise and not reflection) else 600

    raw_response = None

    # Prefer Groq first (user's preferred LLM). If it fails or is rate-limited,
    # fall back to Google Gemini so the AI response keeps working.
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=max_tokens_groq
            )
            # Defensive: ensure response has content
            if response and getattr(response, "choices", None):
                candidate = response.choices[0].message.content
                if candidate:
                    raw_response = candidate
        except Exception as e:
            print(f"[Groq Error]: {e}")

    # If Groq didn't produce a response, try Google Gemini as a fallback
    if raw_response is None and GOOGLE_API_KEY and genai is not None:
        try:
            client = genai.Client(api_key=GOOGLE_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.3,
                    max_output_tokens=max_tokens_gemini
                )
            )
            if response and response.text:
                raw_response = response.text
        except Exception as e:
            print(f"[Gemini Error]: {e}")
            pass

    if raw_response is None:
        fallback_text = (
            "I couldn't generate an AI response for this query right now — the "
            "language model didn't return a usable answer. Try rephrasing the "
            "question, or pointing it at a specific column or time range in the "
            "dataset."
        )
        return {"text": fallback_text, "chart_code": ""} if concise else fallback_text

    # ── Post-process depending on mode ────────────────────────────────
    if concise:
        prose, chart_code = _split_insight_and_code(raw_response)
        return {"text": sanitize_ai_output(prose), "chart_code": chart_code}
    else:
        return sanitize_ai_output(raw_response)


# ═════════════════════════════════════════════════════════════════════════════
# Narration-only mode (used by smart_analysis pipeline)
# ═════════════════════════════════════════════════════════════════════════════

_NARRATE_SYSTEM = """You are a Senior Business Intelligence Analyst.
You receive a user query and the computed results of an analysis.
Your job is to provide a perfected, structured answer that directly addresses the user's query first.

STRUCTURE:
1. THE DIRECT ANSWER: The very first sentence MUST be the direct, quantified answer to the user's question (e.g., "The top 5 departments by budget are..." or "The total budget is $X").
2. SUPPORTING INSIGHTS: After the direct answer, provide 2-3 sentences of deeper context, such as the second-highest values, surprising trends, or notable outliers found in the data.

PRINCIPLES:
- PRECISION: Use exact numbers, column names, and categories from the provided data.
- MATHEMATICAL RIGOR: Never contradict the data direction. An increase is an increase.
- PROFESSIONALISM: Use analytical prose with bolding (**word**) for key metrics.

STRICT CONSTRAINTS:
- Keep the response under 120 words.
- No filler phrases like "To answer your question" or "Looking at the data". Just the answer.
- No markdown headings (#) or section labels."""


def narrate_result(query: str, result: Any, computed_summary: str) -> str:
    """Ask the LLM to narrate a pre-computed analysis in natural prose.
    
    We provide the model with both the raw result and the descriptive 
    summary for maximum context and accuracy.
    """
    data_context = _build_data_context(result, computed_summary)
    
    prompt = f"""User Query: "{query}"

Computed Context:
{data_context}

Explain these results to a business colleague in 3-5 sentences, ensuring you directly answer the user's question using the specific numbers provided."""

    # Try Groq first (user's preferred LLM)
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": _NARRATE_SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.1,
                max_tokens=300,
            )
            raw = response.choices[0].message.content
            if raw:
                return sanitize_ai_output(raw)
        except Exception:
            pass

    # Fallback: Google Gemini
    if GOOGLE_API_KEY and genai is not None:
        try:
            client = genai.Client(api_key=GOOGLE_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=_NARRATE_SYSTEM,
                    temperature=0.1,
                    max_output_tokens=300,
                ),
            )
            if response and response.text:
                return sanitize_ai_output(response.text)
        except Exception:
            pass

    # If both LLMs fail, the computed summary is already human-readable
    return computed_summary

def generate_greeting(dataset_name="", row_count=0, col_count=0):
    """Generate a professional greeting when the user first loads a dataset."""

    if row_count > 0:
        return (
            f"📊 **Dataset loaded: {dataset_name}** — "
            f"**{row_count:,} rows** × **{col_count} columns**. "
            f"Ready for analysis. Ask me about trends, distributions, "
            f"top performers, comparisons, or forecasts."
        )
    return "📊 Upload a dataset and I'll provide professional-grade analysis."


def generate_error_response(query, error_text):
    """Generate a helpful response when the analysis fails."""

    prompt = f"""The user asked: "{query}"
But the analysis code failed with error: "{error_text[:300]}"

Write a SHORT, professional message (2-3 sentences) that:
1. Acknowledges the question
2. Explains simply what went wrong (no technical jargon)
3. Suggests how to rephrase the question

Keep it helpful and direct. Under 60 words."""

    # Try Gemini first
    if GOOGLE_API_KEY and genai is not None:
        try:
            client = genai.Client(api_key=GOOGLE_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=prompt
            )
            if response and response.text:
                return response.text.strip()
        except Exception:
            pass

    # Fallback: Groq
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[{"role": "user", "content": prompt}],
                temperature=0.3,
                max_tokens=150
            )
            return response.choices[0].message.content.strip()
        except Exception:
            pass
    return (
        f"I had some trouble analyzing that. Could you try "
        f"rephrasing your question? For example, try asking about "
        f"specific columns or simpler aggregations."
    )
