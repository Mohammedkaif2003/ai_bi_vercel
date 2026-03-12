from groq import Groq
import os
import streamlit as st
from dotenv import load_dotenv

load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY") or st.secrets["GROQ_API_KEY"]


def suggest_business_questions(query, df, schema):

    client = Groq(api_key=GROQ_API_KEY)

    dataset_info = f"""
Dataset Overview
Rows: {schema['rows']}
Columns: {schema['columns']}

Column Names:
{schema['column_names']}

Numeric Columns:
{schema['numeric_columns']}

Categorical Columns:
{schema['categorical_columns']}
"""

    prompt = f"""
You are a business intelligence expert.

A user just asked this question about the dataset:

"{query}"

Dataset Information:
{dataset_info}

Suggest 5 useful follow-up business questions executives might ask next.

Rules:
- Focus on trends
- Focus on performance comparisons
- Focus on rankings
- Focus on future predictions
- Return only the questions as bullet points
"""

    try:
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3
        )

        return response.choices[0].message.content

    except Exception as e:
        return f"AI suggestion failed: {str(e)}"