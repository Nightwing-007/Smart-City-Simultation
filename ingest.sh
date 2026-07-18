#!/bin/bash
set -e

echo "Downloading Monaco OSM extract..."
curl.exe -O https://download.geofabrik.de/europe/monaco-latest.osm.pbf

echo "Importing into PostGIS..."
# Connecting via the docker-compose network (smartcity_default) where the db service is accessible as 'db'
MSYS_NO_PATHCONV=1 docker run --rm --network=smartcity_default -v "${PWD}:/osm" iboates/osm2pgsql:latest -c -d postgresql://admin:admin@db:5432/citytwin /osm/monaco-latest.osm.pbf

echo "Import complete."
