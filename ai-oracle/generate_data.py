import json
import random
import pandas as pd
import os

def generate_data():
    # Load mockRoads.json (Check local first for Docker, then relative path)
    mock_roads_path = "mockRoads.json"
    if not os.path.exists(mock_roads_path):
        mock_roads_path = os.path.join("..", "frontend", "src", "data", "mockRoads.json")
    with open(mock_roads_path, "r") as f:
        data = json.load(f)
    
    roads = data.get("features", [])
    
    records = []
    
    for idx, road in enumerate(roads):
        name = road.get("properties", {}).get("name", f"Road-{idx}")
        
        # Simulate 400 different scenarios for each road closure
        for _ in range(400):
            # Base traffic density (0 to 100)
            traffic_weight = random.uniform(10.0, 100.0)
            
            # Synthetic calculation based on road type and traffic weight
            highway_type = road.get("properties", {}).get("highway", "unknown")
            base_multiplier = 1.0
            if highway_type == "primary":
                base_multiplier = 2.5
            elif highway_type == "secondary":
                base_multiplier = 1.5
            
            # Predict some metrics
            pollution_spike = (traffic_weight * base_multiplier * random.uniform(0.1, 0.3))
            delay_seconds = (traffic_weight * base_multiplier * random.uniform(2.0, 5.0))
            
            records.append({
                "closed_road_id": idx,
                "closed_road_name": name,
                "traffic_weight": traffic_weight,
                "pollution_spike_percentage": pollution_spike,
                "avg_ambulance_delay_seconds": delay_seconds
            })
            
    df = pd.DataFrame(records)
    df.to_csv("training_data.csv", index=False)
    print(f"Generated {len(df)} rows of synthetic training data.")

if __name__ == "__main__":
    generate_data()
