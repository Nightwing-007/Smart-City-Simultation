import os
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

def train():
    current_dir = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else "."
    csv_path = os.path.join(current_dir, "training_data.csv")
    model_path = os.path.join(current_dir, "oracle_model.pkl")

    try:
        df = pd.read_csv(csv_path)
    except Exception as e:
        print(f"[AI Oracle] Failed to load {csv_path}: {e}")
        return

    # Features (X) and Targets (y)
    X = df[['closed_road_id', 'traffic_weight']]
    y = df[['avg_ambulance_delay_seconds', 'pollution_spike_percentage']]

    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Train Random Forest Regressor
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)

    score = model.score(X_test, y_test)
    print(f"[AI Oracle] Model trained on real OSM spatial IDs with R^2 score: {score:.4f}")

    joblib.dump(model, model_path)
    print(f"[AI Oracle] Saved trained model to {model_path}")

if __name__ == "__main__":
    train()
