# backend1/train_contextual.py
import os, re, joblib, warnings
import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error

BASE = os.path.dirname(__file__)
CSV  = os.path.abspath(os.path.join(BASE, "..", "models", "Price_Agriculture_commodities_Week.csv"))
OUT_DIR = os.path.abspath(os.path.join(BASE, "..", "models_ctx"))
os.makedirs(OUT_DIR, exist_ok=True)

def _norm_cols(df: pd.DataFrame) -> pd.DataFrame:
    df.columns = (
        df.columns.str.strip().str.lower().str.replace(r"[^\w]+","_", regex=True)
    )
    # rename known headers
    df = df.rename(columns={
        "arrival_date":"date",
        "min_price":"min_price",
        "max_price":"max_price",
        "modal_price":"modal_price",
    })
    return df

def _safe(s: str) -> str:
    return re.sub(r"[^\w]+","_", str(s)).lower()

def load_and_clean() -> pd.DataFrame:
    print(f"📄 Reading CSV: {CSV}")
    if not os.path.exists(CSV):
        raise FileNotFoundError(CSV)

    df = pd.read_csv(CSV, low_memory=False)
    df = _norm_cols(df)

    # required columns
    needed = {"state","market","commodity","date","modal_price"}
    missing = needed - set(df.columns)
    if missing:
        raise RuntimeError(f"Missing columns: {missing}")

    # parse dates robustly
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        df["date"] = pd.to_datetime(df["date"], errors="coerce", dayfirst=True, format="mixed")

    # cleanup
    df = df.dropna(subset=["date","commodity","market","modal_price"]).copy()
    for c in ["state","district","market","commodity","variety","grade"]:
        if c in df.columns:
            df[c] = df[c].astype(str).str.strip()

    # collapse duplicates → one row per (commodity,state,market,date)
    df = (df.groupby(["commodity","state","market","date"], as_index=False)["modal_price"]
            .mean())

    # keep only vegetables you trained for (optional)
    # veggies = [...]
    # df = df[df["commodity"].str.title().isin(veggies)]

    print("✅ After cleaning:", df.shape, "| dates", df["date"].min(), "→", df["date"].max())
    return df

def build_lag_features(g: pd.DataFrame, lags=(1,2,3,7)) -> pd.DataFrame:
    g = g.sort_values("date").copy()
    for L in lags:
        g[f"lag{L}"] = g["modal_price"].shift(L)
    g["dow"] = g["date"].dt.dayofweek
    g["month"] = g["date"].dt.month
    g = g.dropna(subset=[f"lag{L}" for L in lags]).copy()
    return g

def train_one_commodity(df: pd.DataFrame, commodity: str, min_rows=60):
    dfc = df[df["commodity"].str.strip().str.casefold() == commodity.casefold()].copy()
    if dfc.empty:
        print(f"⚠️ Skip {commodity}: no rows after filter.")
        return

    # build features per market then stack
    parts = []
    for (state, market), g in dfc.groupby(["state","market"]):
        g2 = build_lag_features(g)
        if len(g2) >= min_rows:
            parts.append(g2)
    if not parts:
        print(f"⚠️ Skip {commodity}: After feature eng, no group >= {min_rows} rows.")
        return
    dff = pd.concat(parts, ignore_index=True)

    X = dff[[ "lag1","lag2","lag3","lag7","dow","month" ]].values
    y = dff["modal_price"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=42)

    model = GradientBoostingRegressor(random_state=42)
    model.fit(Xtr, ytr)

    mae = mean_absolute_error(yte, model.predict(Xte))
    rmse = mean_squared_error(yte, model.predict(Xte), squared=False)

    out_path = os.path.join(OUT_DIR, f"model_ctx_{_safe(commodity)}.joblib")
    joblib.dump({
        "model": model,
        "features": ["lag1","lag2","lag3","lag7","dow","month"],
        "target": "modal_price",
        "commodity": commodity,
        "info": {
            "rows": int(len(dff)),
            "groups": int(dff.groupby(["state","market"]).ngroups),
            "mae": float(mae),
            "rmse": float(rmse),
            "date_min": str(dff["date"].min().date()),
            "date_max": str(dff["date"].max().date()),
        }
    }, out_path)
    print(f"💾 Saved {commodity} → {out_path} | MAE={mae:.2f} RMSE={rmse:.2f} rows={len(dff)}")

def main():
    df = load_and_clean()
    # Train for the commodities that exist
    commodities = (df["commodity"].str.title().value_counts().index.tolist())
    print("🧪 Commodities to train:", commodities[:15], "…")
    for c in commodities:
        try:
            print(f"▶️ Training contextual-short model for: {c}")
            train_one_commodity(df, c)
        except Exception as e:
            print(f"⚠️ Skip {c}: {e}")

if __name__ == "__main__":
    main()