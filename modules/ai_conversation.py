from groq import Groq
import os
import streamlit as st
from dotenv import load_dotenv
import pandas as pd

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or st.secrets["GROQ_API_KEY"]


def generate_conversational_response(query, result, insight=""):
    """
    Generate a natural, conversational AI response that explains
    the analysis results in plain English — like a real data analyst
    would talk to a business executive.
    """

    client = Groq(api_key=GROQ_API_KEY)

    # Build a concise data summary for the AI
    data_summary = ""
    if isinstance(result, pd.DataFrame):
        data_summary = f"""
Data returned: DataFrame with {result.shape[0]} rows and {result.shape[1]} columns.
Columns: {', '.join(str(c) for c in result.columns)}
First 5 rows:
{result.head(5).to_string(index=False)}
"""
    elif isinstance(result, pd.Series):
        data_summary = f"""
Data returned: Series with {len(result)} values.
{result.head(10).to_string()}
"""
    elif isinstance(result, str):
        data_summary = f"Result: {result[:500]}"
    else:
        data_summary = f"Result: {str(result)[:500]}"

    prompt = f"""You are a friendly, professional AI business analyst having a conversation with a user.

The user asked: "{query}"

Here is the analysis result:
{data_summary}

Additional insight: {insight if insight else 'None available'}

YOUR TASK:
Write a SHORT, conversational response (3-5 sentences max) that:
1. Directly answers their question in plain English
2. Highlights the most important finding or number
3. Adds one brief business observation or recommendation
4. Sounds natural and helpful — like a colleague explaining results over coffee

RULES:
- Do NOT repeat the raw data or show tables
- Do NOT use technical jargon (no "DataFrame", "groupby", "aggregation")
- Do NOT say "Based on the data..." or "According to the analysis..."
- Just speak naturally and get to the point
- Use emoji sparingly (1-2 max)
- Keep it under 100 words
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a friendly business data analyst. Be concise, insightful, and conversational."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.4,
            max_tokens=200
        )

        return response.choices[0].message.content.strip()

    except Exception as e:
        return ""


def generate_greeting(dataset_name="", row_count=0, col_count=0):
    """Generate a friendly greeting when the user first loads a dataset."""

    if row_count > 0:
        return (
            f"👋 I've loaded your **{dataset_name}** dataset — "
            f"**{row_count:,} rows** and **{col_count} columns**. "
            f"Ask me anything about it! For example, try asking about "
            f"revenue trends, top performers, or category breakdowns."
        )
    return "👋 Upload a dataset and I'll help you analyze it!"


def generate_error_response(query, error_text):
    """Generate a helpful response when the analysis fails."""

    client = Groq(api_key=GROQ_API_KEY)

    prompt = f"""The user asked: "{query}"
But the analysis code failed with error: "{error_text}"

Write a SHORT, friendly message (2-3 sentences) that:
1. Acknowledges the question
2. Explains simply what went wrong (no technical jargon)  
3. Suggests how to rephrase the question

Keep it helpful and conversational. Under 60 words."""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
            max_tokens=150
        )
        return response.choices[0].message.content.strip()
    except:
        return (
            f"I had some trouble analyzing that one. Could you try "
            f"rephrasing your question? For example, try asking about "
            f"specific columns or simpler aggregations."
        )
