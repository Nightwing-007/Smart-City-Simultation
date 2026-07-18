import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.model_selection import train_test_split
import joblib

def train():
    # Load dataset
    try:
        df = pd.read_csv("training_data.csv")
    except Exception as e:
        print("Failed to load training_data.csv:", e)
        return
    
    # Features (X) and Targets (y)
    X = df[['closed_road_id', 'traffic_weight']]
    y = df[['avg_ambulance_delay_seconds', 'pollution_spike_percentage']]
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    # Train Random Forest Regressor
    model = RandomForestRegressor(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    # Evaluate
    score = model.score(X_test, y_test)
    print(f"Model trained with R^2 score: {score:.4f}")
    
    # Save the model
    joblib.dump(model, "oracle_model.pkl")
    print("Saved model to oracle_model.pkl")

if __name__ == "__main__":
    train()
