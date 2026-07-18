# Smart City Digital Twin

## About / Abstract
The **Smart City Digital Twin** is an interactive, real-time spatial simulation and predictive analytics platform. It visualizes city infrastructure and live traffic patterns while dynamically modeling the cascading effects of urban congestion. Featuring an intelligent A* emergency response routing engine and a Machine Learning-powered "What-If" Oracle, this platform allows urban planners to simulate road closures and instantly predict the resulting pollution spikes and emergency vehicle delays.

## Architecture

The project is built on a modern microservices architecture, spanning three primary layers:

### 1. Frontend Dashboard (React + deck.gl)
- **Framework**: React via Vite.
- **Mapping**: MapLibre GL for the basemap and `@deck.gl/react` for high-performance WebGL overlay layers.
- **Visualization Layers**:
  - `GeoJsonLayer`: Renders the static city road network.
  - `ScatterplotLayer`: Renders high-frequency moving vehicles and emergency responders.
  - `HeatmapLayer`: Dynamically visualizes pollution intensity based on live traffic density.
- **Integration**: Connects to the Spring Boot backend via native WebSockets and the Python AI Oracle via REST (`fetch`).

### 2. Core Simulation Engine (Java Spring Boot)
- **Framework**: Spring Boot (Java).
- **Responsibilities**:
  - **Graph Ingestion**: Parses spatial road data into a traversable graph.
  - **Traffic Simulation**: A `@Scheduled` background loop actively manages dozens of vehicle entities, smoothly interpolating their positions across edges.
  - **Dynamic A* Routing**: An intelligent pathfinding algorithm specifically engineered for the `Ambulance` entity. It continuously recalculates the shortest path to random emergencies while heavily penalizing highly congested road segments.
  - **Real-Time Broadcast**: Exposes a `TextWebSocketHandler` on port `8082`, streaming the massive entity coordinate array and calculated pollution weights to the frontend every 100ms.

### 3. Predictive AI Oracle (Python + FastAPI)
- **Framework**: FastAPI, scikit-learn, pandas.
- **Responsibilities**: 
  - **Data Pipeline**: Generates synthetic training datasets mimicking thousands of varied road closures and their resulting impact on urban delay and pollution.
  - **Machine Learning**: A trained `RandomForestRegressor` model predicting the complex cascading consequences of bottlenecking specific intersections.
  - **API**: Exposes a lightning-fast `GET /predict` REST endpoint on port `8000` to serve the React frontend's instant "What-If" interactive scenarios.

---

## Setup & Installation

### Prerequisites
- Node.js & npm
- Java (JDK 17 or higher)
- Maven
- Python 3.9+ 

### 1. Frontend Setup
```bash
cd frontend
npm install
npm run dev
# Runs on http://localhost:5173
```

### 2. Spring Boot Simulation Backend
```bash
cd backend
./mvnw clean compile spring-boot:run
# Runs on http://localhost:8082
```

### 3. Python AI Oracle Setup
```bash
cd ai-oracle
# Create a virtual environment
python -m venv venv

# Activate (Windows)
.\venv\Scripts\activate
# Activate (Mac/Linux)
# source venv/bin/activate

# Install dependencies
pip install pandas scikit-learn fastapi uvicorn

# (Optional) Retrain the model
python generate_data.py
python train_model.py

# Start the FastAPI server
uvicorn main:app --port 8000
# Runs on http://localhost:8000
```

## Usage
Once all three services are running:
1. Open your browser and navigate to **`http://localhost:5173`**.
2. Observe the live 3D traffic traversing the map. The red ambulance will actively route around yellow traffic clusters.
3. Observe the blue-to-red `HeatmapLayer` glowing dynamically over congested intersections.
4. On the left **Sidebar**, scroll down to the **🔮 AI Oracle: What-If Analysis** panel.
5. Select a road to simulate a closure. The AI Oracle will instantly return the predicted pollution spike and ambulance delay.
