# config/settings.py
from dotenv import load_dotenv
import os

load_dotenv()  # loads variables from .env

OWM_API_KEY = os.getenv("OWM_API_KEY", "")
# NASA POWER doesn't require a key, but keep variable for future
NASA_API_KEY = os.getenv("NASA_API_KEY", "")
