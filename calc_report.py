import csv

file_path = "c:/INTER(Genesis)/ai_chatbat_cam_anaylz/data/raw/sales_data.csv"

with open(file_path, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

cols = reader.fieldnames
print("=== DATA VALIDATION ===")
print("Columns:", cols)
print("Rows:", len(rows))

missing_vals = {c: 0 for c in cols}
for row in rows:
    for c in cols:
        if not row[c].strip():
            missing_vals[c] += 1
print("Missing values:", missing_vals)

cat_rev = {}
prod_rev = {}

for row in rows:
    cat = row["category"]
    prod = row["product"]
    rev = float(row["revenue"])
    cat_rev[cat] = cat_rev.get(cat, 0) + rev
    prod_rev[prod] = prod_rev.get(prod, 0) + rev

total_rev = sum(cat_rev.values())
print("\n=== CATEGORY ANALYSIS (REVENUE) ===")
sorted_cat = sorted(cat_rev.items(), key=lambda x: x[1], reverse=True)
for cat, rev in sorted_cat:
    print(f"{cat}: ${rev:,.2f} ({(rev/total_rev)*100:.2f}%)")

print("\n=== TOP 10% PRODUCTS ===")
prod_items = list(prod_rev.values())
prod_items.sort()
# compute 90th percentile manually
idx = int(0.90 * len(prod_items))
threshold = prod_items[idx]
print(f"90th Percentile Threshold: ${threshold:,.2f}")
sorted_prod = sorted(prod_rev.items(), key=lambda x: x[1], reverse=True)
for prod, rev in sorted_prod:
    if rev >= threshold:
        print(f"{prod}: ${rev:,.2f}")
