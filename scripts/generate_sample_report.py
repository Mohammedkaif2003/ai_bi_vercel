import sys
import os
import pandas as pd

# Ensure the package root is on sys.path so `modules` can be imported when running this script
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from modules.report_generator import generate_pdf
from modules.auto_visualizer import auto_visualize
from modules.data_loader import normalize_columns

# Load sample dataset
path = 'data/raw/sales_data.csv'
df = pd.read_csv(path)
df = normalize_columns(df)

# Build a sample analysis: Top 5 regions by revenue
if 'region' in df.columns and 'revenue' in df.columns:
    top_regions = df.groupby('region', as_index=False)['revenue'].sum().sort_values('revenue', ascending=False).head(5)
else:
    top_regions = df.head(10)

charts = auto_visualize(top_regions)

analysis_history = [
    {
        'query': 'Top 5 regions by revenue',
        'insight': 'Top regions by total revenue are shown. Focus attention on top performers and concentration risk.',
        'result': top_regions,
        'ai_response': 'Top 5 regions by revenue: concise list provided.',
        'charts': charts,
        'code': '',
        'summary': [
            'Top regions account for the majority of revenue.',
            'Consider diversification if one region exceeds 40% share.'
        ]
    }
]

print('Generating PDF...')
file_path = generate_pdf(analysis_history=analysis_history)
print('Generated:', file_path)
