from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, Image
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib import colors
from reportlab.platypus import TableStyle
from reportlab.lib.units import inch
from datetime import datetime
import pandas as pd
import matplotlib.pyplot as plt
import os


def generate_pdf(query, summary_text, dataframe=None, charts=None):

    file_path = "AI_Executive_Report.pdf"

    doc = SimpleDocTemplate(file_path)
    elements = []

    styles = getSampleStyleSheet()
    title_style = styles["Heading1"]
    heading_style = styles["Heading2"]
    normal_style = styles["BodyText"]

    # ------------------------------------------------
    # HEADER
    # ------------------------------------------------

    elements.append(Paragraph("AI Business Intelligence Report", title_style))
    elements.append(Spacer(1, 8))

    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M")

    elements.append(Paragraph(f"Generated on: {timestamp}", normal_style))
    elements.append(Spacer(1, 20))

    # ------------------------------------------------
    # USER QUERY
    # ------------------------------------------------

    elements.append(Paragraph("User Query", heading_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(str(query), normal_style))
    elements.append(Spacer(1, 20))

    # ------------------------------------------------
    # AI INSIGHT
    # ------------------------------------------------

    elements.append(Paragraph("AI Business Insight", heading_style))
    elements.append(Spacer(1, 6))
    elements.append(Paragraph(str(summary_text), normal_style))
    elements.append(Spacer(1, 20))

    chart_files = []

    # ------------------------------------------------
    # VISUAL ANALYSIS
    # ------------------------------------------------

    if isinstance(dataframe, (pd.DataFrame, pd.Series)):

        try:

            df_chart = dataframe

            if isinstance(df_chart, pd.Series):
                df_chart = df_chart.reset_index()

            df_chart = df_chart.reset_index(drop=False)

            numeric_cols = df_chart.select_dtypes(include="number").columns

            if len(numeric_cols) > 0 and df_chart.shape[1] >= 2:

                elements.append(Paragraph("Visual Analysis", heading_style))
                elements.append(Spacer(1, 10))

                for col in numeric_cols[:2]:

                    chart_path = f"chart_{col}.png"

                    plt.figure(figsize=(6,4))
                    plt.bar(df_chart.iloc[:,0], df_chart[col])

                    plt.title(f"{col} by {df_chart.columns[0]}")
                    plt.xticks(rotation=45)

                    plt.tight_layout()
                    plt.savefig(chart_path)
                    plt.close()

                    chart_files.append(chart_path)

                    elements.append(Image(chart_path, width=6*inch, height=3*inch))
                    elements.append(Spacer(1, 12))

        except:
            pass

    # ------------------------------------------------
    # DATA TABLE
    # ------------------------------------------------

    if dataframe is not None:

        elements.append(Paragraph("Data Analysis Table", heading_style))
        elements.append(Spacer(1, 10))

        if isinstance(dataframe, pd.Series):
            dataframe = dataframe.reset_index()

        if isinstance(dataframe, pd.DataFrame):

            dataframe = dataframe.reset_index().head(20)

            table_data = [dataframe.columns.tolist()] + dataframe.values.tolist()

        else:

            table_data = [["Result"], [str(dataframe)]]

        table = Table(table_data)

        table.setStyle(
            TableStyle([
                ("BACKGROUND",(0,0),(-1,0),colors.darkblue),
                ("TEXTCOLOR",(0,0),(-1,0),colors.white),
                ("GRID",(0,0),(-1,-1),0.5,colors.grey),
                ("ALIGN",(0,0),(-1,-1),"CENTER"),
                ("FONTNAME",(0,0),(-1,0),"Helvetica-Bold")
            ])
        )

        elements.append(table)

    # ------------------------------------------------
    # BUILD PDF
    # ------------------------------------------------

    doc.build(elements)

    # ------------------------------------------------
    # CLEANUP TEMP CHARTS
    # ------------------------------------------------

    for file in chart_files:
        if os.path.exists(file):
            os.remove(file)

    return file_path