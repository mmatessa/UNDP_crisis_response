#!/bin/bash
# Fetches real OSM building footprints for the Gaziantep demo area
# (bounding box derived from your actual RAPIDA-export-2026-06-18.json coordinates)
#
# Usage: bash fetch-footprints.sh
# Output: gaziantep-footprints.geojson

set -e

# Bounding box: south, west, north, east (padded ~0.008° around your 10 RAPIDA points)
BBOX="37.0443,37.3684,37.0741,37.3947"

QUERY='[out:json][timeout:60];(way["building"]('"$BBOX"');relation["building"]('"$BBOX"'););out geom;'

echo "Fetching building footprints for Gaziantep demo area..."
echo "Bounding box: $BBOX"

curl -s -X POST "https://overpass-api.de/api/interpreter" \
  --data-urlencode "data=$QUERY" \
  -o overpass-raw.json

echo "Raw Overpass response saved to overpass-raw.json"
echo "Converting to clean GeoJSON..."

node convert-to-geojson.js

echo "Done. Output: gaziantep-footprints.geojson"
