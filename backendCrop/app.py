from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pickle
import numpy as np
import pandas as pd
import os
import logging
from pathlib import Path
from typing import List, Dict, Any
from fastapi.middleware.cors import CORSMiddleware

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(title="AgriSense API", version="1.0.0")

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, specify your frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configuration
MODEL_PATH = Path(__file__).parent / "model.pkl"
SCALER_PATH = Path(__file__).parent / "scaler.pkl"
DATA_PATH = Path(__file__).parent / "Crop_recommendation.csv"
PORT = int(os.environ.get('PORT', 8000))
DEBUG = os.environ.get('DEBUG', 'False').lower() == 'true'

# Pydantic models
class PredictionInput(BaseModel):
    N: float = Field(..., ge=0, le=200, description="Nitrogen content")
    P: float = Field(..., ge=0, le=200, description="Phosphorus content")
    K: float = Field(..., ge=0, le=200, description="Potassium content")
    temperature: float = Field(..., ge=-10, le=50, description="Temperature in °C")
    humidity: float = Field(..., ge=0, le=100, description="Humidity percentage")
    ph: float = Field(..., ge=0, le=14, description="Soil pH")
    rainfall: float = Field(..., ge=0, le=500, description="Rainfall in mm")

class Recommendation(BaseModel):
    crop: str
    confidence: float

class PredictionResponse(BaseModel):
    status: str
    recommendations: List[Recommendation]

class HealthResponse(BaseModel):
    status: str
    model_loaded: bool
    scaler_loaded: bool
    data_loaded: bool

def load_model_file(file_path: Path, file_type: str):
    """Load model or scaler file with proper error handling"""
    try:
        if not file_path.exists():
            raise FileNotFoundError(f"{file_type} file not found: {file_path}")

        with open(file_path, "rb") as f:
            model = pickle.load(f)

        logger.info(f"Successfully loaded {file_type} from {file_path}")
        return model

    except Exception as e:
        logger.error(f"Error loading {file_type} from {file_path}: {str(e)}")
        raise

# Load model and scaler with error handling
try:
    model = load_model_file(MODEL_PATH, "model")
    scaler = load_model_file(SCALER_PATH, "scaler")
    data = pd.read_csv(DATA_PATH)
    logger.info("All files loaded successfully")
except Exception as e:
    logger.error(f"Failed to initialize application: {str(e)}")
    model = None
    scaler = None
    data = None

@app.post("/predict", response_model=PredictionResponse)
async def predict(input_data: PredictionInput):
    try:
        # Validate model and scaler are loaded
        if model is None or scaler is None:
            raise HTTPException(
                status_code=500,
                detail="Model or scaler not loaded. Please check server logs."
            )

        # Prepare features
        features = np.array([[input_data.N, input_data.P, input_data.K,
                            input_data.temperature, input_data.humidity,
                            input_data.ph, input_data.rainfall]])
        features_scaled = scaler.transform(features)

        # Predict probabilities
        probs = model.predict_proba(features_scaled)[0]
        classes = model.classes_

        # Get top 3 crops
        top_indices = np.argsort(probs)[-3:][::-1]
        top_crops = classes[top_indices]
        top_probs = probs[top_indices]

        # Build response
        recommendations = []
        for crop, prob in zip(top_crops, top_probs):
            recommendations.append(Recommendation(
                crop=crop,
                confidence=round(float(prob) * 100, 2)
            ))

        logger.info(f"Prediction successful: {[r.dict() for r in recommendations]}")
        return PredictionResponse(status="success", recommendations=recommendations)

    except ValueError as e:
        logger.warning(f"Input validation error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@app.get("/health", response_model=HealthResponse)
async def health():
    """Health check endpoint"""
    return HealthResponse(
        status="healthy",
        model_loaded=model is not None,
        scaler_loaded=scaler is not None,
        data_loaded=data is not None
    )

# Home route (keeping original for backward compatibility)
@app.get("/")
async def home():
    return {"message": "AgriSense API is running 🚀"}

if __name__ == "__main__":
    import uvicorn
    logger.info(f"Starting AgriSense API on port {PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT, reload=DEBUG)
