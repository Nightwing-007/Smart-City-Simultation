#!/bin/bash
set -e

CITY=${1:-"monaco"}
echo "=========================================================="
echo " Smart City Digital Twin - PostGIS OSM Spatial Ingestion  "
echo " Target City / Extract: $CITY                             "
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
    -c -d postgresql://admin:admin@db:5432/citytwin \
    /osm/"$OSM_FILE"

echo "Ingestion completed successfully."
echo "Restarting Node.js and Spring Boot simulation engines to build in-memory graphs from PostGIS..."
docker compose restart node-api backend-sim || docker-compose restart node-api backend-sim

echo "=========================================================="
echo " Ready! Open http://localhost in your browser.            "
echo "=========================================================="
