import pandas as pd
import re
import json
from typing import List, Dict, Any, Optional
from modules.ai_conversation import narrate_result, GROQ_API_KEY, GOOGLE_API_KEY, genai, types, sanitize_ai_output

def extract_global_kpis(df: pd.DataFrame) -> List[Dict[str, Any]]:
    """Automatically detect and calculate global KPIs for the dataset dashboard."""
    kpis = []
    
    # 1. Row count (always useful)
    kpis.append({
        "label": "Total Records",
        "value": f"{len(df):,}",
        "icon": "database"
    })
    
    # 2. Categorical counts
    cat_cols = df.select_dtypes(include=["object", "category"]).columns
    if len(cat_cols) > 0:
        # Find the most likely "Primary Category" (e.g., Department, Region, Product)
        primary_cat = None
        for col in cat_cols:
            if any(term in col.lower() for term in ["dept", "department", "category", "region", "product", "segment"]):
                primary_cat = col
                break
        if not primary_cat:
            primary_cat = cat_cols[0]
            
        kpis.append({
            "label": f"Total {primary_cat}s",
            "value": f"{df[primary_cat].nunique():,}",
            "icon": "layers"
        })

    # 3. Numeric KPIs (Revenue, Budget, Score, etc.)
    num_cols = df.select_dtypes(include="number").columns
    for col in num_cols:
        col_l = col.lower()
        # Look for "Total" style metrics
        if any(term in col_l for term in ["revenue", "sales", "budget", "cost", "profit", "amount"]):
            total_val = df[col].sum()
            label = "Total " + col.replace("_", " ").title()
            # Formatting
            if total_val >= 1_000_000:
                val_str = f"${total_val/1_000_000:.1f}M"
            elif total_val >= 1_000:
                val_str = f"${total_val/1_000:.1f}K"
            else:
                val_str = f"${total_val:,.2f}"
                
            kpis.append({
                "label": label,
                "value": val_str,
                "icon": "trending-up" if "profit" in col_l or "revenue" in col_l else "dollar-sign"
            })
            
            # Also find the "Highest" for this metric
            if primary_cat:
                top_row = df.groupby(primary_cat)[col].sum().idxmax()
                kpis.append({
                    "label": f"Top {primary_cat}",
                    "value": str(top_row),
                    "subtext": f"Highest {col.title()}",
                    "icon": "award"
                })

        # Look for "Average" style metrics
        elif any(term in col_l for term in ["score", "rating", "performance", "percent", "pct", "avg"]):
            avg_val = df[col].mean()
            label = "Avg " + col.replace("_", " ").title()
            kpis.append({
                "label": label,
                "value": f"{avg_val:.2f}" if avg_val < 100 else f"{avg_val:,.0f}",
                "icon": "bar-chart"
            })

    return kpis[:8] # Limit to 8 cards for layout balance

def generate_section_titles(history: List[Dict[str, Any]]) -> List[str]:
    """Generate professional, contextual titles for each analysis section."""
    titles = []
    
    # We can use a simple mapping or a small LLM call. 
    # For speed and reliability, a keyword-based mapper works well, 
    # but an LLM is better for "Executive Intelligence".
    
    prompt = "Convert the following analytical queries into professional executive-grade section titles (concise, 3-5 words).\n\nQueries:\n"
    for i, entry in enumerate(history):
        prompt += f"{i+1}. {entry.get('query')}\n"
    
    prompt += "\nFormat: List only the titles, one per line."
    
    # Use LLM for title generation
    system_prompt = "You are a Senior Business Editor. Convert raw data queries into professional, concise section titles for an executive report. Example: 'Which region has more sales?' -> 'Regional Revenue Distribution Analysis'."
    
    raw_titles = _call_llm(system_prompt, prompt, max_tokens=200)
    
    if raw_titles:
        lines = [line.strip() for line in raw_titles.split("\n") if line.strip() and not line[0].isdigit() or (len(line) > 2 and line[1:3] == ". ")]
        # Clean up numbered list if model returned it
        titles = [re.sub(r"^\d+\.\s*", "", line) for line in lines]
    
    # Fallback logic if LLM fails or returns wrong count
    if len(titles) < len(history):
        for i in range(len(titles), len(history)):
            q = str(history[i].get("query", ""))
            if "budget" in q.lower(): titles.append("Budget Allocation Analysis")
            elif "revenue" in q.lower(): titles.append("Revenue Distribution Overview")
            elif "trend" in q.lower(): titles.append("Strategic Trend Analysis")
            else: titles.append(f"Analysis: {q[:30]}...")
            
    return titles[:len(history)]

def deduplicate_and_synthesize(history: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Identify redundant analyses and generate synthesized executive content.
    Returns: {
        "clean_history": list,
        "executive_summary": str,
        "strategic_conclusion": str
    }
    """
    if not history:
        return {"clean_history": [], "executive_summary": "", "strategic_conclusion": ""}

    # 1. Deduplication logic
    # We ask the LLM to identify indices of redundant items
    pruning_prompt = "Review the following analytical queries and identify any that are highly redundant or repeat the same insight.\n\nQueries:\n"
    for i, entry in enumerate(history):
        pruning_prompt += f"[{i}] {entry.get('query')}\n"
    
    pruning_prompt += "\nList the indices [i] of entries to REMOVE because they are redundant. If all are unique, return 'NONE'. Format: [1, 3, 5]"
    
    indices_to_remove_str = _call_llm("You are an Intelligence Auditor. Your job is to ensure a report has no repetitive content.", pruning_prompt, max_tokens=50)
    
    indices_to_remove = []
    if indices_to_remove_str and "NONE" not in indices_to_remove_str.upper():
        try:
            indices_to_remove = [int(idx) for idx in re.findall(r"\d+", indices_to_remove_str)]
        except:
            pass
            
    clean_history = [entry for i, entry in enumerate(history) if i not in indices_to_remove]
    
    # 2. Synthesis Logic
    summary_prompt = "Synthesize a high-level strategic executive summary from these findings. Combine related themes, highlight major patterns, and mention any notable risks or opportunities. Avoid raw metric dumping.\n\nFindings:\n"
    for entry in clean_history:
        summary_prompt += f"- {entry.get('query')}: {entry.get('ai_response') or entry.get('insight')}\n"
    
    exec_summary = _call_llm(
        "You are a Senior Strategy Consultant. Write a smooth, professional executive briefing (2-3 paragraphs) that synthesizes analytical findings into strategic intelligence.",
        summary_prompt,
        max_tokens=500
    )
    
    conclusion_prompt = "Based on the findings above, write a Strategic Conclusion and Recommendation section for the final page of the report. Focus on overall business health and next steps.\n\nFindings:\n"
    for entry in clean_history:
        conclusion_prompt += f"- {entry.get('query')}: {entry.get('ai_response') or entry.get('insight')}\n"

    strat_conclusion = _call_llm(
        "You are an AI Business Consultant. Provide a high-impact strategic conclusion and forward-looking recommendations based on the provided analysis.",
        conclusion_prompt,
        max_tokens=400
    )

    return {
        "clean_history": clean_history,
        "executive_summary": sanitize_ai_output(exec_summary),
        "strategic_conclusion": sanitize_ai_output(strat_conclusion)
    }

def semantic_column_mapper(query: str, columns: List[str]) -> Dict[str, str]:
    """
    Use LLM to map user's natural language terms to the actual column names.
    Returns: { "user_term": "actual_column_name" }
    """
    if not columns:
        return {}
        
    system_prompt = (
        "You are a Data Architect. Map the user's query terms to the most likely column names from the provided list. "
        "If a term clearly refers to a column (e.g., 'earnings' -> 'revenue'), return the mapping in JSON. "
        "Only return a JSON object like: {\"term\": \"column_name\"}. If no clear match, return {}."
    )
    user_prompt = f"Query: \"{query}\"\nAvailable Columns: {columns}"
    
    raw_json = _call_llm(system_prompt, user_prompt, max_tokens=100)
    try:
        # Sanitize potential markdown blocks
        clean_json = re.sub(r"```json|```", "", raw_json).strip()
        return json.loads(clean_json)
    except:
        return {}

def find_join_strategy(datasets_info: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Synthesize a join strategy for multiple datasets.
    datasets_info: [ { "name": "sales.csv", "columns": [...] }, ... ]
    """
    system_prompt = (
        "You are a Database Engineer. Analyze the schemas of multiple datasets and suggest how they should be joined. "
        "Identify common keys (e.g., 'id', 'date', 'region'). "
        "Return a JSON object: { \"can_join\": bool, \"join_on\": \"column_name\", \"strategy\": \"description\" }"
    )
    user_prompt = f"Datasets: {json.dumps(datasets_info)}"
    
    raw_json = _call_llm(system_prompt, user_prompt, max_tokens=200)
    try:
        clean_json = re.sub(r"```json|```", "", raw_json).strip()
        return json.loads(clean_json)
    except:
        return {"can_join": False, "error": "Could not determine join strategy"}

def _call_llm(system_prompt: str, user_prompt: str, max_tokens: int = 500) -> str:
    """Internal helper for LLM calls with fallback."""
    # Try Groq first
    if GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.3-70b-versatile",
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                temperature=0.1, # Lower temperature for mapping tasks
                max_tokens=max_tokens
            )
            return response.choices[0].message.content
        except Exception as e:
            print(f"[Groq Intelligence Error]: {e}")

    # Fallback to Gemini
    if GOOGLE_API_KEY and genai is not None:
        try:
            client = genai.Client(api_key=GOOGLE_API_KEY)
            response = client.models.generate_content(
                model="gemini-2.0-flash",
                contents=user_prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_prompt,
                    temperature=0.1,
                    max_output_tokens=max_tokens
                )
            )
            return response.text
        except Exception as e:
            print(f"[Gemini Intelligence Error]: {e}")
            
    return ""
