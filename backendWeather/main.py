# main.py
import os
import traceback
from datetime import datetime, timedelta, timezone
from typing import Optional, Dict

import numpy as np
import requests
import joblib
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config.settings import OWM_API_KEY
from utils.weather_utils import city_to_latlon, fetch_openweather, prepare_lag_features

# =====================================================
# Directory Setup
# =====================================================
BASE_DIR = os.path.dirname(__file__)
STATIC_DIR = os.path.join(BASE_DIR, "static")
BG_DIR = os.path.join(STATIC_DIR, "backgrounds")
ICON_DIR = os.path.join(STATIC_DIR, "animated_weather_icon")

os.makedirs(BG_DIR, exist_ok=True)
os.makedirs(ICON_DIR, exist_ok=True)

# =====================================================
# FastAPI Initialization
# =====================================================
app = FastAPI(title="FutureCrop Weather + AQI + ML API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# =====================================================
# Load ML Models
# =====================================================
rain_model = joblib.load("models/rain_model.pkl")
temp_model = joblib.load("models/temp_model.pkl")
hum_model = joblib.load("models/hum_model.pkl")
scaler_X = joblib.load("models/scaler_X.pkl")
le_wind = joblib.load("models/label_encoder_wind.pkl")
le_rain = joblib.load("models/label_encoder_rain.pkl")

# =====================================================
# Background / Icon Mappings
# =====================================================
VIDEO_MAP = {
    "extreme": "bg_extreme.mp4",
    "thunder": "bg_thunder.mp4",
    "snow": "bg_snow.mp4",
    "rain": "bg_rain.mp4",
    "drizzle": "bg_drizzle.mp4",
    "fog": "bg_fog.mp4",
    "mist": "bg_mist.mp4",
    "haze": "bg_haze.mp4",
    "cloud": "bg_cloudy.mp4",
    "clear": "bg_clear.mp4",
    "sunny": "bg_sunny.mp4",
}

ICON_MAP = {
    "clear": "day.svg",
    "sunny": "day.svg",
    "cloud": "cloudy-day-3.svg",
    "scattered": "cloudy-day-3.svg",
    "broken": "cloudy.svg",
    "overcast": "cloudy.svg",
    "rain": "rainy-4.svg",
    "shower": "rainy-5.svg",
    "drizzle": "rainy-2.svg",
    "thunder": "thunder.svg",
    "storm": "thunder.svg",
    "snow": "snowy-3.svg",
    "mist": "weather_sunset.svg",
    "fog": "weather_sunset.svg",
    "haze": "weather_sunset.svg",

    # fallback
    "default": "day.svg"
}


# =====================================================
# Helper Functions
# =====================================================

def select_background(desc: str) -> str:
    d = desc.lower()
    for key in sorted(VIDEO_MAP, key=lambda x: -len(x)):
        if key in d:
            file = VIDEO_MAP[key]
            if os.path.isfile(os.path.join(BG_DIR, file)):
                return f"/static/backgrounds/{file}"
    return "/static/backgrounds/bg_clear.mp4"


def select_icon(desc: str) -> str:
    d = desc.lower()
    for key in sorted(ICON_MAP, key=lambda x: -len(x)):
        if key.replace("-", " ") in d or key in d:
            file = ICON_MAP[key]
            if os.path.isfile(os.path.join(ICON_DIR, file)):
                return f"/static/animated_weather_icon/{file}"
    return f"/static/animated_weather_icon/{ICON_MAP['default']}"


def fetch_aqi(lat: float, lon: float):
    if not OWM_API_KEY:
        return None

    url = "https://api.openweathermap.org/data/2.5/air_pollution"
    params = {"lat": lat, "lon": lon, "appid": OWM_API_KEY}

    try:
        r = requests.get(url, params=params, timeout=10)
        r.raise_for_status()
        d = r.json()["list"][0]
        aqi = d["main"]["aqi"]
        return {
            "index": aqi,
            "status": {1: "good", 2: "fair", 3: "moderate", 4: "poor", 5: "very poor"}[aqi],
            "pm25": d["components"].get("pm2_5"),
            "pm10": d["components"].get("pm10"),
            "o3": d["components"].get("o3"),
        }
    except:
        return None


# =====================================================
# Request Model
# =====================================================
class CityRequest(BaseModel):
    city: str


# =====================================================
# Main Prediction Endpoint
# =====================================================
@app.post("/predict")
def predict(req: CityRequest):
    try:
        city = req.city.strip()

        # 1) Get coordinates
        lat, lon = city_to_latlon(city)

        # 2) Fetch LIVE weather from OpenWeather
        weather = fetch_openweather(lat, lon)

        # 3) Extract timezone info (seconds offset) from weather API
        offset = int(weather.get("timezone", 0))
        obs_dt = weather.get("dt")

        # Convert from UTC → local time safely (no deprecated methods)
        def to_utc(ts):
            return datetime.fromtimestamp(ts, tz=timezone.utc)

        # Sunrise / Sunset
        sunrise_ts = weather.get("sunrise")
        sunset_ts = weather.get("sunset")

        sunrise_local = (
            (to_utc(sunrise_ts) + timedelta(seconds=offset)).strftime("%I:%M %p")
            if sunrise_ts else None
        )

        sunset_local = (
            (to_utc(sunset_ts) + timedelta(seconds=offset)).strftime("%I:%M %p")
            if sunset_ts else None
        )

        # Current local time
        if obs_dt:
            now_local = to_utc(obs_dt) + timedelta(seconds=offset)
        else:
            now_local = datetime.now(timezone.utc) + timedelta(seconds=offset)

        # 4) ML Rain prediction
        try:
            wind_enc = le_wind.transform([weather["WindGustDir"]])[0]
        except:
            wind_enc = 0

        X_rain = np.array([[
            weather["MinTemp"],
            weather["MaxTemp"],
            wind_enc,
            weather["WindGustSpeed"],
            weather["Humidity"],
            weather["Pressure"],
            weather["Temp"],
        ]])

        rain_pred = rain_model.predict(X_rain)[0]
        try:
            rain_label = le_rain.inverse_transform([rain_pred])[0]
        except:
            rain_label = str(rain_pred)

        # 5) ML Forecast for next 5 hours
        lag_vec = prepare_lag_features(weather)
        lag_scaled = scaler_X.transform([lag_vec])

        temp_next = temp_model.predict(lag_scaled)[0].tolist()
        hum_next = hum_model.predict(lag_scaled)[0].tolist()

        # 6) Build timezone-correct forecast list
        forecast = []
        for i in range(5):
            future_t = now_local + timedelta(hours=i + 1)
            forecast.append({
                "hour": future_t.strftime("%I:%M %p"),
                "date": future_t.strftime("%d %b %Y"),
                "day": future_t.strftime("%A"),
                "temperature": float(temp_next[i]),
                "humidity": float(hum_next[i]),
            })

        # 7) AQI
        aqi = fetch_aqi(lat, lon)

        # 8) UI Assets
        desc = weather["description"]
        bg_video = select_background(desc)
        icon = select_icon(desc)

        # 9) Final Response
        return {
            "city": city,
            "country": weather["country"],
            "coords": {"lat": lat, "lon": lon},

            "current": {
                "Temp": weather["Temp"],
                "MinTemp": weather["MinTemp"],
                "MaxTemp": weather["MaxTemp"],
                "Humidity": weather["Humidity"],
                "Pressure": weather["Pressure"],
                "WindGustSpeed": weather["WindGustSpeed"],
                "WindGustDir": weather["WindGustDir"],
                "feels_like": weather["feels_like"],
                "description": desc,
                "sunrise": sunrise_local,
                "sunset": sunset_local,
                "precipitation_mm": weather["rainfall_mm"],
                "rain_intensity": weather["rainfall_category"],
            },

            "RainTomorrow": rain_label,

            "aqi": aqi,

            "current_datetime": {
                "time": now_local.strftime("%I:%M %p"),
                "date": now_local.strftime("%d %b %Y"),
                "day": now_local.strftime("%A"),
            },

            "forecast_next_5_hours": forecast,

            "background_video": bg_video,
            "animated_icon": icon,
        }

    except Exception as e:
        return {"error": str(e), "trace": traceback.format_exc()}
