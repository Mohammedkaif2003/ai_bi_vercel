import os

file_path = "c:\\Users\\Shaik\\Downloads\\ai_bi_vercel\\api\\datasets.py"
dirname1 = os.path.dirname(os.path.abspath(file_path))
dirname2 = os.path.dirname(dirname1)
data_dir = os.path.join(dirname2, "data", "raw")

print(f"File: {file_path}")
print(f"Dirname 1: {dirname1}")
print(f"Dirname 2: {dirname2}")
print(f"Data Dir: {data_dir}")
print(f"Exists: {os.path.exists(data_dir)}")
if os.path.exists(data_dir):
    print(f"Contents: {os.listdir(data_dir)}")
