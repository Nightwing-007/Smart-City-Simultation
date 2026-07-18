import React, { useState, useEffect } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import mockRoads from '../data/mockRoads.json';

const INITIAL_VIEW_STATE = {
  longitude: -73.985130,
  latitude: 40.758896,
  zoom: 14,
  pitch: 45,
  bearing: 0
};

// Use a free Carto basemap style
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const DeckGLMap = () => {
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [vehicles, setVehicles] = useState([]);
  const [pollution, setPollution] = useState([]);

  useEffect(() => {
    // Connect to Spring Boot WebSocket
    const ws = new WebSocket('ws://localhost:8082/ws/simulation');

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.vehicles) {
          setVehicles(data.vehicles);
        }
        if (data.pollution) {
          setPollution(data.pollution);
        }
      } catch (err) {
        console.error("Failed to parse simulation data", err);
      }
    };

    ws.onopen = () => {
      console.log('Connected to Spring Boot Simulation WebSocket');
    };

    return () => {
      ws.close();
    };
  }, []);

  const layers = [
    new GeoJsonLayer({
      id: 'roads-layer',
      data: mockRoads,
      pickable: true,
      stroked: false,
      filled: false,
      extruded: true,
      lineWidthScale: 20,
      lineWidthMinPixels: 2,
      getLineColor: d => d.properties.color || [255, 255, 255],
      getLineWidth: 1,
      getElevation: 30,
      opacity: 0.8
    }),
    new HeatmapLayer({
      id: 'pollution-heatmap',
      data: pollution,
      getPosition: d => [d.lng, d.lat],
      getWeight: d => d.weight,
      radiusPixels: 40,
      intensity: 1,
      threshold: 0.1,
      opacity: 0.6,
      colorRange: [
        [33, 102, 172],
        [67, 147, 195],
        [146, 197, 222],
        [214, 96, 77],
        [178, 24, 43],
        [103, 0, 31]
      ],
      updateTriggers: {
        getWeight: [pollution]
      }
    }),
    new ScatterplotLayer({
      id: 'vehicles-layer',
      data: vehicles,
      pickable: false,
      opacity: 1,
      stroked: false,
      filled: true,
      radiusScale: 1,
      radiusMinPixels: 4,
      radiusMaxPixels: 20,
      lineWidthMinPixels: 0,
      getPosition: d => [d.lng, d.lat],
      // Ambulance is red, others are yellow
      getFillColor: d => d.isAmbulance ? [255, 0, 0] : [255, 255, 0], 
      // Ambulance is larger
      getRadius: d => d.isAmbulance ? 20 : 10,
      updateTriggers: {
        getPosition: [vehicles],
        getFillColor: [vehicles],
        getRadius: [vehicles]
      }
    })
  ];

  return (
    <DeckGL
      initialViewState={INITIAL_VIEW_STATE}
      controller={true}
      layers={layers}
      onViewStateChange={({ viewState }) => setViewState(viewState)}
    >
      <Map
        mapStyle={MAP_STYLE}
        reuseMaps
        preventStyleDiffing={true}
      />
    </DeckGL>
  );
};

export default DeckGLMap;
