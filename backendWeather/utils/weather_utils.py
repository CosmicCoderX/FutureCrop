# utils/weather_utils.py
import requests
import numpy as np
from config.settings import OWM_API_KEY

USER_AGENT = "FutureCrop-Backend/1.0"


def city_to_latlon(city_name: str):
    url = "https://nominatim.openstreetmap.org/search"
    params = {"q": city_name, "format": "json", "limit": 1}
    r = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=10)
    r.raise_for_status()
    data = r.json()
    if not data:
        raise ValueError(f"City not found: {city_name}")
    return float(data[0]["lat"]), float(data[0]["lon"])


def deg_to_compass(deg):
    try:
        deg = float(deg)
    except:
        return "N"
    dirs = [
        "N",
        "NNE",
        "NE",
        "ENE",
        "E",
        "ESE",
        "SE",
        "SSE",
        "S",
        "SSW",
        "SW",
        "WSW",
        "W",
        "WNW",
        "NW",
        "NNW",
    ]
    ix = int((deg / 22.5) + 0.5) % 16
    return dirs[ix]


def classify_rainfall_intensity(mm_hr):
    """
    Classifies rainfall intensity by mm/hr.
    """
    if mm_hr is None:
        return "No Rain"

    try:
        mm = float(mm_hr)
    except:
        return "No Rain"

    if mm <= 0:
        return "No Rain"
    elif mm <= 2.5:
        return "Light Rain"
    elif mm <= 7.5:
        return "Moderate Rain"
    elif mm <= 50:
        return "Heavy Rain"
    else:
        return "Violent Rain"


def fetch_openweather(lat, lon, api_key=OWM_API_KEY):
    """
    Fetch LIVE weather from OpenWeather including rainfall intensity.
    """
    url = "https://api.openweathermap.org/data/2.5/weather"
    params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}

    r = requests.get(url, params=params, headers={"User-Agent": USER_AGENT}, timeout=10)
    r.raise_for_status()

    d = r.json()

    # rainfall info (free tier)
    rain_1h = None
    if "rain" in d:
        rain_1h = d["rain"].get("1h") or d["rain"].get("3h")

    return {
        "Temp": d["main"]["temp"],
        "MinTemp": d["main"]["temp_min"],
        "MaxTemp": d["main"]["temp_max"],
        "Humidity": d["main"]["humidity"],
        "Pressure": d["main"]["pressure"],
        "WindGustSpeed": d["wind"].get("speed", 0),
        "WindGustDir": deg_to_compass(d["wind"].get("deg", 0)),
        "feels_like": d["main"]["feels_like"],
        "description": d["weather"][0]["description"],
        "country": d["sys"]["country"],
        # UTC timestamps (seconds)
        "sunrise": d["sys"].get("sunrise"),
        "sunset": d["sys"].get("sunset"),
        # timezone offset in seconds (as provided by /weather)
        "timezone": d.get("timezone", 0),
        # current observation dt (UTC seconds)
        "dt": d.get("dt"),
        "rainfall_mm": rain_1h,
        "rainfall_category": classify_rainfall_intensity(rain_1h),
    }


def prepare_lag_features(weather: dict):
    """
    Prepare lag features for 5-step forecasting.
    """
    temp = weather.get("Temp", 0.0)
    hum = weather.get("Humidity", 0.0)
    pressure = weather.get("Pressure", 0.0)

    temp_lags = [float(temp)] * 6
    hum_lags = [float(hum)] * 6
    pressure_lags = [float(pressure)] * 6

    return np.array(temp_lags + hum_lags + pressure_lags, dtype=float)
