# backend1/load_to_db.py
import os
import sqlite3
import pandas as pd

# -----------------------------
# Paths
# -----------------------------
BASE = os.path.dirname(__file__)
DB_PATH = os.path.join(BASE, "data", "prices.db")

# Default CSV: PRICE_PREDICTION/models/Price_Agriculture_commodities_Week.csv
DEFAULT_CSV = os.path.abspath(
    os.path.join(BASE, "..", "models", "Price_Agriculture_commodities_Week.csv")
)

# Allow override via env var if you move the file
CSV_PATH = os.environ.get("CROP_CSV", DEFAULT_CSV)

print("📂 Reading CSV from:", CSV_PATH)
if not os.path.exists(CSV_PATH):
    raise FileNotFoundError(
        f"CSV not found at: {CSV_PATH}\n"
        "Tip: place the file at PRICE_PREDICTION/models/Price_Agriculture_commodities_Week.csv\n"
        "or set env var CROP_CSV=/full/path/to/file.csv"
    )

os.makedirs(os.path.join(BASE, "data"), exist_ok=True)

# -----------------------------
# Load CSV (robust)
# -----------------------------
try:
    df = pd.read_csv(CSV_PATH, low_memory=False)
except UnicodeDecodeError:
    # Fallback encoding sometimes needed on Windows-origin CSVs
    df = pd.read_csv(CSV_PATH, low_memory=False, encoding="latin-1")

print(f"🧾 Loaded raw CSV shape: {df.shape}")

# -----------------------------
# Normalize column names
# -----------------------------
df.columns = (
    df.columns
      .str.strip()
      .str.lower()
      .str.replace(r"[^\w]+", "_", regex=True)
)

# Rename to stable canonical names (only if present)
df.rename(
    columns={
        "arrival_date": "date",
        "min_price": "min_price",
        "max_price": "max_price",
        "modal_price": "modal_price",
    },
    inplace=True,
)

# -----------------------------
# Ensure required columns exist
# -----------------------------
required = ["date", "commodity", "market", "modal_price"]
missing_req = [c for c in required if c not in df.columns]
if missing_req:
    raise ValueError(f"Missing required columns in CSV: {missing_req}")

# -----------------------------
# Type fixes
# -----------------------------
# Parse date; dataset uses day-first format (e.g., 27-07-2023)
df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True)

# Keep only useful columns if they exist
keep_cols = ["state", "district", "market", "commodity",
             "variety", "grade", "date", "min_price", "max_price", "modal_price"]
keep_cols = [c for c in keep_cols if c in df.columns]
df = df[keep_cols]

# Drop rows with no date / commodity / market / modal_price
df = df.dropna(subset=[c for c in ["date", "commodity", "market", "modal_price"] if c in df.columns])

# Cast strings
for c in ["state", "district", "market", "commodity", "variety", "grade"]:
    if c in df.columns:
        df[c] = df[c].astype(str).str.strip()

# Numeric casts (safe)
for c in ["min_price", "max_price", "modal_price"]:
    if c in df.columns:
        df[c] = pd.to_numeric(df[c], errors="coerce")

# Drop rows where target is missing after casting
df = df.dropna(subset=["modal_price"])

# Final clean
df = df.sort_values("date").reset_index(drop=True)
print(f"✅ Cleaned shape: {df.shape}")

# -----------------------------
# Write to SQLite
# -----------------------------
con = sqlite3.connect(DB_PATH)
df.to_sql("prices", con, if_exists="replace", index=False)
# Helpful composite index for fast lookups
con.execute(
    "CREATE INDEX IF NOT EXISTS ix_prices_key "
    "ON prices(commodity, state, market, date)"
)
con.commit()
con.close()

print(f"💾 Loaded {len(df):,} rows into {DB_PATH}")
print("🎉 Done.")