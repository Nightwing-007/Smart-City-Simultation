import os
import re
import random
import joblib
import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI(title="CityTwin AI Oracle API", version="2.0.0")

# Allow CORS for the frontend React dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

model = None
current_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else "."
model_path = os.path.join(current_dir, "oracle_model.pkl")

@app.on_event("startup")
def load_model():
    global model
    try:
        if os.path.exists(model_path):
            model = joblib.load(model_path)
            print(f"[AI Oracle] Trained Random Forest model loaded successfully from {model_path}.")
        else:
            print(f"[AI Oracle] Notice: {model_path} not found. Running training pipeline...")
            from generate_data import generate_data
            from train_model import train
            generate_data()
            train()
            model = joblib.load(model_path)
    except Exception as e:
        print("[AI Oracle] Could not load or train model:", e)

@app.get("/health")
def health():
    return {
        "status": "UP",
        "service": "citytwin-ai-oracle",
        "model_loaded": model is not None
    }

@app.get("/predict")
def predict_closure(closed_road_id: str = Query(..., description="Real OpenStreetMap road ID (numeric or 'road-XXXX')")):
    global model
    if model is None:
        if os.path.exists(model_path):
            model = joblib.load(model_path)
        else:
            raise HTTPException(status_code=503, detail="AI Oracle model not initialized.")

    # Sanitize input: extract numeric ID from strings like 'road-42435212'
    numeric_id_match = re.search(r'\d+', str(closed_road_id))
    numeric_id = int(numeric_id_match.group()) if numeric_id_match else 42435210

    # Simulated traffic weight for the closure scenario
    traffic_weight = random.uniform(50.0, 100.0)

    # Prepare inference DataFrame
    input_data = pd.DataFrame([{
        "closed_road_id": numeric_id,
        "traffic_weight": traffic_weight
    }])

    try:
        prediction = model.predict(input_data)[0]
        delay_seconds = max(5.0, round(float(prediction[0]), 2))
        pollution_spike = max(2.0, round(float(prediction[1]), 2))

        return {
            "closed_road_id": closed_road_id,
            "osm_id": numeric_id,
            "traffic_weight": round(traffic_weight, 2),
            "avg_ambulance_delay_seconds": delay_seconds,
            "pollution_spike_percentage": pollution_spike,
            "status": "success"
        }
    except Exception as e:
        # Graceful prediction fallback
        synthetic_delay = round(traffic_weight * 0.45 + (numeric_id % 7) * 4.2, 2)
        synthetic_pollution = round(traffic_weight * 0.22 + (numeric_id % 5) * 3.1, 2)
        return {
            "closed_road_id": closed_road_id,
            "osm_id": numeric_id,
            "traffic_weight": round(traffic_weight, 2),
            "avg_ambulance_delay_seconds": synthetic_delay,
            "pollution_spike_percentage": synthetic_pollution,
            "status": "fallback"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
