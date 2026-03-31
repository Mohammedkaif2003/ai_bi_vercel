import os
import streamlit as st
from dotenv import load_dotenv
import pandas as pd
from modules.app_secrets import get_secret

load_dotenv()
import re
from html import unescape

def sanitize_ai_output(text: str) -> str:
    if not text:
        return ""

    # Convert HTML entities
    text = unescape(str(text))

    # Remove ALL HTML tags
    text = re.sub(r'</?[^>]+>', '', text)

    # Remove weird leftover formatting
    text = text.replace("```", "")

    return text.strip()
GROQ_API_KEY = get_secret("GROQ_API_KEY")
GOOGLE_API_KEY = get_secret("GOOGLE_API_KEY")

# ═══════════════════════════════════════════════════
#  SENIOR DATA ANALYST SYSTEM PROMPT
# ═══════════════════════════════════════════════════

ANALYST_SYSTEM_PROMPT = """You are a Senior Business Intelligence Analyst.

You MUST strictly follow the output format below.

----------------------------------------
OUTPUT FORMAT (MANDATORY)
----------------------------------------

EXECUTIVE INSIGHT:
- Point 1
- Point 2

KEY FINDINGS:
- Point 1
- Point 2

BUSINESS IMPACT:
- Point 1
- Point 2

LIMITATIONS:
- Only if necessary (1–2 points)

RECOMMENDATIONS:
- Only if supported by data

----------------------------------------
STRICT RULES
----------------------------------------

- ALWAYS include ALL sections
- NEVER skip any section
- Use ONLY bullet points
- DO NOT write paragraphs
- DO NOT change section names
- DO NOT add extra sections
- Keep it concise and data-driven

IMPORTANT:
- Do NOT return HTML tags (no <div>, <span>, etc.)
- Return only clean plain text or markdown
- Use bullet points instead of HTML formatting
"""

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
First rows:
{result.head(8).to_string(index=False)}
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


def generate_conversational_response(query, result, insight="", df=None):
    """
    Generate a professional, rigorous AI response using Google Gemini
    (primary) with Groq LLaMA as fallback.
    """

    # 🔹 Build data summary (with optional dataset context)
    data_summary = _build_data_context(result, insight)

    # 🔹 Add dataset preview if available (FIX)
    if df is not None:
        try:
            df_preview = df.head(10).to_string()
            data_summary += f"\n\nFull Dataset Preview:\n{df_preview}"
        except Exception:
            pass

    prompt = f"""The user asked: "{query}"

Here is the analysis result:
{data_summary}

Analyze this data using your senior analyst framework. Be specific to THIS data — no generic responses."""

    # 🔹 Try Google Gemini first
    if GOOGLE_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GOOGLE_API_KEY)
            model = genai.GenerativeModel(
                "gemini-2.0-flash",
                system_instruction=ANALYST_SYSTEM_PROMPT
            )
            response = model.generate_content(
                prompt,
                generation_config=genai.types.GenerationConfig(
                    temperature=0.3,
                    max_output_tokens=350
                )
            )
            if response and response.text:
                return sanitize_ai_output(response.text)
        except Exception:
            pass  # fallback

    # 🔹 Fallback: Groq
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": ANALYST_SYSTEM_PROMPT},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.3,
                max_tokens=600
            )
            return sanitize_ai_output(response.choices[0].message.content)
        except Exception:
            pass

    return """EXECUTIVE INSIGHT
    - Unable to generate AI response for this query.

    KEY FINDINGS
    - The system could not process the result properly.

    BUSINESS IMPACT
    - No actionable insights available.

    LIMITATIONS
    - This may be due to insufficient data or unclear query.

    RECOMMENDATIONS
    - Try rephrasing your question or selecting specific columns."""
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
    if GOOGLE_API_KEY:
        try:
            import google.generativeai as genai
            genai.configure(api_key=GOOGLE_API_KEY)
            model = genai.GenerativeModel("gemini-2.0-flash")
            response = model.generate_content(prompt)
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
