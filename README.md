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

## Setup & Installation (Docker Ecosystem)

The entire ecosystem is orchestrated using Docker Compose. All services run in isolated containers communicating via a shared internal bridge network (`smartcity-net`), including a live PostGIS instance holding spatial map data.

### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) & [Docker Compose](https://docs.docker.com/compose/install/)

### 1. Launch the Cluster
Navigate to the root directory where the `docker-compose.yml` is located and run:
```bash
docker-compose up -d --build
```
This builds and launches all 5 core containers:
- `citytwin-frontend` (Nginx, port 80)
- `citytwin-backend-sim` (Java 17, port 8082)
- `citytwin-ai-oracle` (Python 3.10, port 8000)
- `citytwin-node-api` (Legacy ingestion API, port 3000)
- `citytwin-db` (PostGIS Database, port 5432)

### 2. Ingest Real City Data
The PostGIS container (`citytwin-db`) will boot up empty. You must populate it with OpenStreetMap data using the provided shell script:
```bash
./ingest.sh
```
*Note: This script requires `curl` and utilizes the `iboates/osm2pgsql` docker image to parse a `.pbf` map file into `planet_osm_line` tables directly into the `citytwin-db` container.*

### 3. Restart the Simulation
Because the Spring Boot Java service builds the traversable A* graph memory on application startup (`@PostConstruct`), you need to restart the backend container after data ingestion completes so it can query the populated PostGIS tables:
```bash
docker-compose restart backend-sim
```

## Usage
Once the stack is running and the map data is loaded:
1. Open your browser and navigate to **`http://localhost`**.
2. Observe the live 3D traffic traversing the map. The red ambulance will actively route around yellow traffic clusters.
3. Observe the blue-to-red `HeatmapLayer` glowing dynamically over congested intersections.
4. On the left **Sidebar**, scroll down to the **🔮 AI Oracle: What-If Analysis** panel.
5. Select a road to simulate a closure. The AI Oracle will instantly return the predicted pollution spike and ambulance delay computed natively via the Machine Learning model.
