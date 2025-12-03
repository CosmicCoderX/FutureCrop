# backend1/simulate_history.py
import os, sqlite3, random, math, joblib, re
from datetime import datetime, timedelta

BASE = os.path.dirname(__file__)
DB   = os.path.join(BASE, "data", "prices.db")
MODELS_DIR = os.path.abspath(os.path.join(BASE, "..", "models"))

def safe(s): return re.sub(r"[^\w]+", "_", s).lower()

def required_window():
    """Get the maximum feature length across available commodity models (fallback 28)."""
    need_max = 0
    if not os.path.isdir(MODELS_DIR):
        return 28
    for f in os.listdir(MODELS_DIR):
        if not f.startswith("model_") or not f.endswith(".joblib"):
            continue
        try:
            bundle = joblib.load(os.path.join(MODELS_DIR, f))
            if isinstance(bundle, dict):
                model = bundle.get("model", bundle)
                need  = len(bundle.get("features", [])) or getattr(model, "n_features_in_", 28)
            else:
                model = bundle
                need  = getattr(model, "n_features_in_", 28)
            need_max = max(need_max, int(need))
        except Exception:
            pass
    return need_max or 28

def ensure_is_synth_column(con):
    """Add is_synth column if missing."""
    cur = con.execute("PRAGMA table_info(prices)")
    cols = [r[1] for r in cur.fetchall()]
    if "is_synth" not in cols:
        con.execute("ALTER TABLE prices ADD COLUMN is_synth INTEGER DEFAULT 0")
        con.commit()

def fetch_groups(con):
    q = """SELECT commodity, state, market, COUNT(*) as n, MAX(date) as max_date
           FROM prices GROUP BY commodity, state, market"""
    return con.execute(q).fetchall()

def fetch_ref_row(con, commodity, state, market, ref_date):
    q = """SELECT state, district, market, commodity, variety, grade,
                  date, min_price, max_price, modal_price
           FROM prices
           WHERE commodity=? AND state=? AND market=? AND date=?
           LIMIT 1"""
    row = con.execute(q, (commodity, state, market, ref_date)).fetchone()
    if row: return row
    # Fallback: pick any row for the combo (we'll base stats on it)
    q2 = """SELECT state, district, market, commodity, variety, grade,
                   date, min_price, max_price, modal_price
            FROM prices
            WHERE commodity=? AND state=? AND market=?
            ORDER BY date DESC LIMIT 1"""
    return con.execute(q2, (commodity, state, market)).fetchone()

def clamp(x, lo, hi):
    return max(lo, min(hi, x))

def synth_series(base_price, days, noise=0.04):
    """Random-walk backwards; returns list of prices for d=1..days before ref."""
    vals = []
    p = float(base_price)
    for _ in range(days):
        drift = random.uniform(-noise, noise)
        p = max(1.0, p * (1.0 + drift))
        vals.append(round(p, 2))
    return vals

def insert_row(con, r):
    con.execute(
        """INSERT INTO prices(state,district,market,commodity,variety,grade,
                              date,min_price,max_price,modal_price,is_synth)
           VALUES(?,?,?,?,?,?,?,?,?,?,1)""",
        r
    )

def main():
    need = required_window()
    print(f"👉 Required window (max across models): {need}")

    con = sqlite3.connect(DB)
    ensure_is_synth_column(con)

    groups = fetch_groups(con)
    total_inserted = 0

    for commodity, state, market, n, max_date in groups:
        # If we already have enough history, skip
        if int(n) >= need:
            continue

        # Use the latest date as the reference
        ref_date = max_date
        # Fetch a reference row to copy categorical fields & baseline prices
        ref = fetch_ref_row(con, commodity, state, market, ref_date)
        if not ref:
            continue

        (st, dist, mkt, comm, variety, grade,
         date_str, min_p, max_p, modal_p) = ref

        # How many more days we need to reach 'need'
        want = need - int(n)
        base = float(modal_p) if modal_p is not None else float(max(min_p or 0, 1))
        series = synth_series(base_price=base, days=want, noise=0.04)

        # Insert days strictly BEFORE the earliest existing date if possible,
        # but we’ll go before ref_date for simplicity
        ref_dt = datetime.strptime(ref_date[:10], "%Y-%m-%d") if "-" in ref_date else datetime.strptime(ref_date, "%d-%m-%Y")
        inserted_here = 0

        for d, price in enumerate(series, start=1):
            day = (ref_dt - timedelta(days=d)).strftime("%Y-%m-%d")
            # Create min/max around modal with ±10%
            mn = round(price * 0.9, 2)
            mx = round(price * 1.1, 2)
            row = (st, dist, mkt, comm, variety, grade, day, mn, mx, price)
            try:
                insert_row(con, row)
                inserted_here += 1
            except sqlite3.IntegrityError:
                # ignore duplicates
                pass

        if inserted_here:
            print(f"[+]{commodity} | {market}, {state}: added {inserted_here} synthetic days")
            total_inserted += inserted_here

    con.commit()
    con.close()
    print(f"✅ Done. Inserted total synthetic rows: {total_inserted}")
    print("To remove later:  DELETE FROM prices WHERE is_synth=1; VACUUM;")

if __name__ == "__main__":
    main()