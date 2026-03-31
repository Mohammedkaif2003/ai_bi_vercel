import pandas as pd


def normalize_columns(df):

    # Clean column names
    df.columns = (
        df.columns
        .str.strip()
        .str.replace("_", " ")
        .str.replace("-", " ")
        .str.title()
    )

    # Standard column mapping
    mapping = {
        "Sales": "Revenue",
        "Sales Amount": "Revenue",
        "Revenue Amount": "Revenue",
        "Total Sales": "Revenue",

        "Product Name": "Product",
        "Item": "Product",
        "Item Name": "Product",

        "Location": "Region",
        "Area": "Region",

        "Order Date": "Date",
        "Transaction Date": "Date"
    }

    df.rename(columns=mapping, inplace=True)

    # Convert Date column if present
    if "Date" in df.columns:
        try:
            df["Date"] = pd.to_datetime(df["Date"])
        except (TypeError, ValueError):
            pass

    return df


def detect_columns(df):

    column_map = {}

    for col in df.columns:

        name = col.lower()

        if "product" in name or "item" in name:
            column_map["Product"] = col

        elif "region" in name or "location" in name or "area" in name:
            column_map["Region"] = col

        elif "revenue" in name or "sales" in name:
            column_map["Revenue"] = col

        elif "date" in name:
            column_map["Date"] = col

    return column_map
