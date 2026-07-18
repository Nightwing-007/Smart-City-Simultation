from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import joblib
import pandas as pd
import random

app = FastAPI()

# Allow CORS for the frontend React app
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load the trained model on startup
model = None

@app.on_event("startup")
def load_model():
    global model
    try:
        model = joblib.load("oracle_model.pkl")
        print("Model loaded successfully.")
    except Exception as e:
        print("Could not load model. Did you run train_model.py?", e)

@app.get("/predict")
def predict_closure(closed_road_id: int):
    if model is None:
        raise HTTPException(status_code=503, detail="Model not loaded")
    
    # We use a random simulated traffic weight between 10.0 and 100.0 to see what would happen right now
    traffic_weight = random.uniform(50.0, 100.0)
    
    # Prepare input dataframe
    input_data = pd.DataFrame([{
        "closed_road_id": closed_road_id,
        "traffic_weight": traffic_weight
    }])
    
    # Predict
    prediction = model.predict(input_data)[0]
    
    # prediction[0] = avg_ambulance_delay_seconds
    # prediction[1] = pollution_spike_percentage
    return {
        "closed_road_id": closed_road_id,
        "traffic_weight": round(traffic_weight, 2),
        "avg_ambulance_delay_seconds": round(prediction[0], 2),
        "pollution_spike_percentage": round(prediction[1], 2)
    }

# Run via: uvicorn main:app --port 8000
