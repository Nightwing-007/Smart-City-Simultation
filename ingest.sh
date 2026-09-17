#!/bin/bash
set -e

# Load environment variables from .env if present
if [ -f .env ]; then
    export $(grep -v '^#' .env | xargs)
fi

DB_USER=${POSTGRES_USER:-"admin"}
DB_PASS=${POSTGRES_PASSWORD:-"admin"}
DB_NAME=${POSTGRES_DB:-"citytwin"}
DB_HOST=${POSTGRES_HOST:-"db"}
DB_PORT=${POSTGRES_PORT:-"5432"}

CITY=${1:-"monaco"}
echo "=========================================================="
echo " Smart City Digital Twin - PostGIS OSM Spatial Ingestion  "
echo " Target City / Extract: $CITY                             "
echo " Database Target: $DB_USER@$DB_HOST:$DB_PORT/$DB_NAME     "
echo "=========================================================="

if [ "$CITY" == "newyork" ] || [ "$CITY" == "nyc" ]; then
    OSM_FILE="NewYork.osm.pbf"
    URL="https://download.bbbike.org/osm/bbbike/NewYork/NewYork.osm.pbf"
else
    OSM_FILE="monaco-latest.osm.pbf"
    URL="https://download.geofabrik.de/europe/monaco-latest.osm.pbf"
fi

if [ ! -f "$OSM_FILE" ]; then
    echo "Downloading spatial extract from $URL..."
    if command -v curl &> /dev/null; then
        curl -L -o "$OSM_FILE" "$URL"
    elif command -v curl.exe &> /dev/null; then
        curl.exe -L -o "$OSM_FILE" "$URL"
    else
        echo "Error: curl is required to download the dataset."
        exit 1
    fi
else
    echo "Using existing local extract: $OSM_FILE"
fi

echo "Importing $OSM_FILE into PostGIS (citytwin-db) via smartcity-net..."
MSYS_NO_PATHCONV=1 docker run --rm \
    --network=smartcity-net \
    -v "${PWD}:/osm" \
    iboates/osm2pgsql:latest \
    -c -d "postgresql://${DB_USER}:${DB_PASS}@${DB_HOST}:${DB_PORT}/${DB_NAME}" \
    /osm/"$OSM_FILE"

echo "Ingestion completed successfully."
echo "Restarting Node.js simulation API to rebuild spatial in-memory graph from PostGIS..."
docker compose restart node-api || docker-compose restart node-api

echo "=========================================================="
echo " Ready! Open http://localhost in your browser.            "
echo "=========================================================="
