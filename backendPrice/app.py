# backend1/app.py
import logging
import os, re, sqlite3, joblib, numpy as np, pandas as pd
from datetime import datetime
from typing import List, Optional, Tuple

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# ---------- Paths ----------
BASE_DIR   = os.path.dirname(__file__)
DB_PATH    = os.path.join(BASE_DIR, "data", "prices.db")
MODELS_DIR = os.path.join(BASE_DIR, "models")

# ---------- Logging ----------
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------- App ----------
app = FastAPI(title="Future Crop AI", version="2.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten for prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------- Helpers ----------
def _connect() -> sqlite3.Connection:
    if not os.path.exists(DB_PATH):
        raise HTTPException(500, "prices.db not found. Run load_to_db.py first.")
    return sqlite3.connect(DB_PATH)

def _safe_name(s: str) -> str:
    return re.sub(r"[^\w]+", "_", (s or "").strip()).lower()

def _model_path(commodity: str) -> str:
    return os.path.join(MODELS_DIR, f"model_{_safe_name(commodity)}.joblib")

def _list_models_from_dir() -> List[str]:
    if not os.path.isdir(MODELS_DIR):
        return []
    out = []
    for fn in os.listdir(MODELS_DIR):
        if fn.startswith("model_") and fn.endswith(".joblib"):
            name = fn[len("model_"):-len(".joblib")]
            out.append(name.replace("_", " ").title())
    return sorted(out)

def _list_models_from_db() -> List[str]:
    con = _connect()
    rows = [r[0] for r in con.execute("SELECT DISTINCT commodity FROM prices ORDER BY commodity").fetchall()]
    con.close()
    return rows

def _load_model_and_need(commodity: str):
    """Load joblib and infer required feature window length."""
    path = _model_path(commodity)
    if not os.path.exists(path):
        raise HTTPException(404, f"No model found for '{commodity}'. ({path})")
    bundle = joblib.load(path)
    if isinstance(bundle, dict):
        model = bundle.get("model", bundle)
        need  = int(len(bundle.get("features", [])) or getattr(model, "n_features_in_", 28))
    else:
        model = bundle
        need  = int(getattr(model, "n_features_in_", 28))
    return model, need

def _fetch_modal_series(commodity: str, state: str, market: str,
                        upto_iso: Optional[str], need: int) -> List[float]:
    """
    Fetch most recent modal_price values (ascending by date) for the context,
    limited to `need` items (or fewer if DB has less).
    """
    con = _connect()
    params = [commodity, state, market]
    if upto_iso:
        q = """SELECT date, modal_price FROM prices
               WHERE LOWER(TRIM(commodity)) = LOWER(TRIM(?))
                 AND LOWER(TRIM(state))     = LOWER(TRIM(?))
                 AND LOWER(TRIM(market))    = LOWER(TRIM(?))
                 AND DATE(date) < DATE(?)
               ORDER BY DATE(date) DESC LIMIT ?"""
        params += [upto_iso, need]
    else:
        q = """SELECT date, modal_price FROM prices
               WHERE LOWER(TRIM(commodity)) = LOWER(TRIM(?))
                 AND LOWER(TRIM(state))     = LOWER(TRIM(?))
                 AND LOWER(TRIM(market))    = LOWER(TRIM(?))
               ORDER BY DATE(date) DESC LIMIT ?"""
        params += [need]

    df = pd.read_sql(q, con, params=params, parse_dates=["date"])
    con.close()
    if df.empty:
        return []
    series = df.sort_values("date")["modal_price"].astype(float).tolist()
    return series[-need:] if len(series) >= need else series

def _ensure_length(series: List[float], need: int,
                   min_required: int = 3, strategy: str = "edge") -> Optional[List[float]]:
    """
    Ensure length EXACTLY `need`. If too short but >= min_required, pad on the left.
    strategy: 'edge' (oldest value), 'mean' (series mean), 'trend' (simple back extrapolation).
    """
    s = list(series or [])
    n = len(s)
    if n >= need:
        return s[-need:]
    if n < min_required:
        return None
    pad_len = need - n
    if strategy == "mean":
        fill = [float(sum(s) / n)] * pad_len
    elif strategy == "trend" and n >= 2:
        slope = s[-1] - s[-2]
        fill = [s[0] - slope * i for i in range(pad_len, 0, -1)]
    else:
        fill = [s[0]] * pad_len
    return fill + s

# ---------- Schemas ----------
class PredictCtxIn(BaseModel):
    commodity: str
    state: str
    market: str
    date: Optional[str] = None  # YYYY-MM-DD

class PredictOut(BaseModel):
    commodity: str
    state: str
    market: str
    used_points: int
    window_size: int
    padded: bool
    predicted_next_price: float

# ---------- Routes ----------
@app.get("/welcome")
def welcome(request: Request):
    logger.info(f"Request received: {request.method} {request.url.path}")
    return {"message": "Welcome to the Future Crop AI API!"}

@app.get("/health")
def health():
    return {"ok": True, "db": os.path.exists(DB_PATH), "models_dir": os.path.isdir(MODELS_DIR)}

@app.get("/models")
def models():
    # Prefer directory (reflects actual trained models). Fallback to DB list.
    m_dir = _list_models_from_dir()
    if m_dir:
        return {"models": m_dir, "count": len(m_dir), "source": "models_dir"}
    m_db = _list_models_from_db()
    return {"models": m_db, "count": len(m_db), "source": "db"}

@app.get("/states")
def list_states(commodity: str = Query(..., min_length=1)):
    con = _connect()
    q = """
        SELECT DISTINCT state
        FROM prices
        WHERE LOWER(TRIM(commodity)) = LOWER(TRIM(?))
        ORDER BY state
    """
    rows = [r[0] for r in con.execute(q, (commodity,)).fetchall()]
    con.close()
    return {"commodity": commodity, "states": rows}

@app.get("/markets")
def list_markets(
    commodity: str = Query(..., min_length=1),
    state: str = Query(..., min_length=1),
):
    con = _connect()
    q = """
        SELECT DISTINCT market
        FROM prices
        WHERE LOWER(TRIM(commodity)) = LOWER(TRIM(?))
          AND LOWER(TRIM(state))     = LOWER(TRIM(?))
        ORDER BY market
    """
    rows = [r[0] for r in con.execute(q, (commodity, state)).fetchall()]
    con.close()
    return {"commodity": commodity, "state": state, "markets": rows}

@app.get("/series_by_context")
def series_by_context(
    commodity: str = Query(..., min_length=1),
    state: str     = Query(..., min_length=1),
    market: str    = Query(..., min_length=1),
    date: Optional[str] = None,
    limit: int = 30
):
    """Return recent date/price history for charting (ascending by date)."""
    con = _connect()
    if date:
        q = """SELECT DATE(date), modal_price FROM prices
               WHERE LOWER(TRIM(commodity))=LOWER(TRIM(?))
                 AND LOWER(TRIM(state))    =LOWER(TRIM(?))
                 AND LOWER(TRIM(market))   =LOWER(TRIM(?))
                 AND DATE(date) < DATE(?)
               ORDER BY DATE(date) DESC LIMIT ?"""
        params = (commodity, state, market, date, limit)
    else:
        q = """SELECT DATE(date), modal_price FROM prices
               WHERE LOWER(TRIM(commodity))=LOWER(TRIM(?))
                 AND LOWER(TRIM(state))    =LOWER(TRIM(?))
                 AND LOWER(TRIM(market))   =LOWER(TRIM(?))
               ORDER BY DATE(date) DESC LIMIT ?"""
        params = (commodity, state, market, limit)
    rows = con.execute(q, params).fetchall()
    con.close()
    rows = rows[::-1]  # ascending
    return {
        "commodity": commodity, "state": state, "market": market,
        "dates": [r[0] for r in rows],
        "prices": [float(r[1]) for r in rows],
    }

@app.post("/predict_by_context", response_model=PredictOut)
def predict_by_context(inp: PredictCtxIn):
    # parse date if provided
    cutoff_iso = None
    if inp.date:
        try:
            cutoff_iso = datetime.strptime(inp.date, "%Y-%m-%d").date().isoformat()
        except ValueError:
            raise HTTPException(422, "Invalid 'date'. Use YYYY-MM-DD.")

    # load model & window size
    model, need = _load_model_and_need(inp.commodity)

    # fetch history
    series = _fetch_modal_series(inp.commodity, inp.state, inp.market, cutoff_iso, need)
    if not series:
        raise HTTPException(422, f"No price history for {inp.commodity} in {inp.market}, {inp.state}.")

    # pad if short
    min_required = int(os.environ.get("MIN_REQUIRED", "3"))
    strategy     = os.environ.get("PAD_STRATEGY", "edge")  # edge|mean|trend
    padded = False
    fixed = _ensure_length(series, need, min_required=min_required, strategy=strategy)
    if fixed is None:
        have = len(series)
        raise HTTPException(422, f"Not enough history for {inp.commodity} in {inp.market}, {inp.state}. "
                                 f"Have {have}, need {need} (min_required={min_required}).")
    if len(series) < need:
        padded = True

    X = np.array(fixed, dtype=float).reshape(1, -1)
    try:
        yhat = float(model.predict(X)[0])
    except Exception as e:
        raise HTTPException(500, f"Model predict failed: {e}")

    return PredictOut(
        commodity=inp.commodity,
        state=inp.state,
        market=inp.market,
        used_points=len(series),
        window_size=need,
        padded=padded,
        predicted_next_price=round(yhat, 2),
    )

# --------- Dev tip ----------
# uvicorn command to run:
#   python -m uvicorn app:app --reload --port 8010
