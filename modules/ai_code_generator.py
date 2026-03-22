import streamlit as st
from groq import Groq
import os
api_key = os.getenv("GROQ_API_KEY") or st.secrets["GROQ_API_KEY"]
@st.cache_data(show_spinner=False)
def generate_analysis_code(api_key, query, df, dataset_context):

    client = Groq(api_key=api_key)

    columns = ", ".join(df.columns)

    prompt = f"""
You are an expert Python data analyst.

You are analyzing a pandas dataframe named df.

DATASET CONTEXT
---------------
{dataset_context}

AVAILABLE COLUMNS
-----------------
{columns}

USER QUESTION
-------------
{query}

RULES
-----
1. Write ONLY valid Python pandas code.
2. Use dataframe name: df
3. Store the final output in a variable named result
4. Do NOT print anything
5. Do NOT import libraries
6. Do NOT explain anything
7. Only use the columns listed above
8. Ensure the code always returns a pandas result if possible
9. IMPORTANT: If using nlargest() on a DataFrame, you MUST specify the 'columns' argument (e.g., nlargest(n=3, columns='Revenue')). If using it on a Series, just pass the n value.
10. If the question asks for predictions or forecasts over time, use the np.polyfit function since we have numpy imported as np, rather than complex ML libraries.
11. NEVER use .hist(), .plot(), .show(), plt, or any matplotlib/seaborn visualization code. You do NOT have access to matplotlib. If asked to explain or describe charts/graphs, use .describe(), .value_counts(), or .agg() to provide the underlying data instead.
12. If the question is vague or asks to "explain" something, provide a statistical summary using .describe() or group-level aggregations rather than trying to create visual output.

EXAMPLE FORMAT
--------------
result = df.groupby("column").sum()
"""

    try:

        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.1
        )

        code = response.choices[0].message.content

        # Remove markdown blocks
        code = code.replace("```python", "").replace("```", "").strip()

        # Remove explanations and imports if AI adds them
        lines = code.split("\n")
        code_lines = []
        for line in lines:
            stripped_line = line.strip()
            
            # Skip conversational text
            if stripped_line.lower().startswith(("here", "sure", "this code", "hope this")):
                continue
                
            # Skip import lines to prevent triggering the security block
            if stripped_line.startswith("import ") or stripped_line.startswith("from "):
                continue
                
            code_lines.append(line)

        code = "\n".join(code_lines)

        # Safety fallback
        if "result" not in code:
            code = f"result = df.head()"

        return code

    except Exception as e:

        # Always return valid code to avoid execution crash
        return f"result = 'AI code generation failed: {str(e)}'"