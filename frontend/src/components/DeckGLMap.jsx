import React, { useState, useEffect, useRef, useMemo } from 'react';
import DeckGL from '@deck.gl/react';
import { GeoJsonLayer, ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { HeatmapLayer } from '@deck.gl/aggregation-layers';
import Map from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

import {
  SMART_CITY_ROADS,
  MASTER_PLAN_2030,
  ENERGY_GRID_DATA
} from '../data/smartCityData';
import { LocalCitySimulation } from '../utils/localSimulation';

// Free Carto dark matter basemap style
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json';

const DeckGLMap = ({
  scenario = 'current',
  layersVisible = {
    roads: true,
    vehicles: true,
    heatmap: true,
    masterPlan: false,
    energyGrid: false,
    emergencyPath: true
  },
  selectedRoadId = null,
  viewState,
  onViewStateChange,
  onStatsUpdate,
  onConnectionStatusChange
}) => {
  const [roads, setRoads] = useState(SMART_CITY_ROADS);
  const [vehicles, setVehicles] = useState([]);
  const [pollution, setPollution] = useState([]);
  const [ambulancePath, setAmbulancePath] = useState([]);
  const [hoverInfo, setHoverInfo] = useState(null);

  const localSimRef = useRef(null);
  const isWsConnectedRef = useRef(false);

  // Initialize local fallback simulation
  useEffect(() => {
    localSimRef.current = new LocalCitySimulation(roads);
  }, [roads]);

  // Update local simulation when scenario or closed road changes
  useEffect(() => {
    if (localSimRef.current) {
      localSimRef.current.setScenario(scenario);
      localSimRef.current.setClosedRoad(selectedRoadId);
    }
  }, [scenario, selectedRoadId]);

  // Attempt to fetch dynamic roads from backend / Node API with graceful fallback
  useEffect(() => {
    const fetchRoads = async () => {
      try {
        const res = await fetch('http://localhost:3000/api/roads');
        if (res.ok) {
          const data = await res.json();
          if (data && data.features && data.features.length > 0) {
            setRoads(data);
          }
        }
      } catch {
        // Fallback to rich embedded SMART_CITY_ROADS
      }
    };
    fetchRoads();
  }, []);

  // Dual-mode Simulation Loop: Node API (3000) / Spring Boot (8082) WebSocket + Standalone Fallback
  useEffect(() => {
    let ws = null;
    let localInterval = null;
    let isCleanedUp = false;

    const startLocalSimulation = () => {
      if (isCleanedUp) return;
      if (localInterval) clearInterval(localInterval);
      onConnectionStatusChange?.('standalone');

      localInterval = setInterval(() => {
        if (localSimRef.current) {
          const simData = localSimRef.current.tick();
          setVehicles(simData.vehicles || []);
          setPollution(simData.pollution || []);
          setAmbulancePath(simData.ambulancePath || []);

          // Calculate KPI metrics
          const avgSpeed =
            simData.vehicles.length > 0
              ? (
                  simData.vehicles.reduce((acc, v) => acc + parseFloat(v.speed || 25), 0) /
                  simData.vehicles.length
                ).toFixed(1)
              : '24.0';

          const maxPollution =
            simData.pollution.length > 0
              ? Math.max(...simData.pollution.map((p) => p.weight || p.pollutionIndex || 25))
              : 25;

          onStatsUpdate?.({
            vehicleCount: simData.vehicles.length,
            avgSpeed: `${avgSpeed} mph`,
            aqiIndex: Math.round(maxPollution * 1.3),
            emergencyStatus: simData.ambulancePath && simData.ambulancePath.length > 0 ? 'Active Route' : 'Standby'
          });
        }
      }, 100);
    };

    const handleMessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.vehicles) {
          setVehicles(data.vehicles);
        }
        if (data.pollution) {
          setPollution(data.pollution);
        }
        if (data.ambulancePath) {
          setAmbulancePath(data.ambulancePath);
        } else if (data.ambulance && data.ambulance.path) {
          setAmbulancePath(data.ambulance.path);
        }

        if (data.vehicles && data.vehicles.length > 0) {
          const avgSpeed = (
            data.vehicles.reduce((acc, v) => acc + parseFloat(v.speed || 25), 0) /
            data.vehicles.length
          ).toFixed(1);

          const maxPollution =
            data.pollution && data.pollution.length > 0
              ? Math.max(...data.pollution.map((p) => p.weight || p.pollutionIndex || 25))
              : 25;

          const hasAmbulance =
            data.vehicles.some((v) => v.isAmbulance) || !!data.ambulance;

          onStatsUpdate?.({
            vehicleCount: data.vehicles.length,
            avgSpeed: `${avgSpeed} mph`,
            aqiIndex: Math.round(maxPollution * 1.3),
            emergencyStatus: hasAmbulance ? 'A* En Route' : 'Standby'
          });
        }
      } catch (err) {
        console.error('Failed to parse WebSocket simulation payload:', err);
      }
    };

    const tryConnect = (urls, index = 0) => {
      if (isCleanedUp) return;
      if (index >= urls.length) {
        startLocalSimulation();
        return;
      }

      const url = urls[index];
      try {
        const socket = new WebSocket(url);

        socket.onopen = () => {
          if (isCleanedUp) {
            socket.close();
            return;
          }
          ws = socket;
          isWsConnectedRef.current = true;
          onConnectionStatusChange?.('connected');
          if (localInterval) clearInterval(localInterval);
        };

        socket.onmessage = handleMessage;

        socket.onerror = () => {
          if (!isWsConnectedRef.current) {
            tryConnect(urls, index + 1);
          }
        };

        socket.onclose = () => {
          if (ws === socket) {
            isWsConnectedRef.current = false;
            startLocalSimulation();
          }
        };
      } catch {
        tryConnect(urls, index + 1);
      }
    };

    tryConnect(['ws://localhost:3000', 'ws://localhost:8082/ws/simulation']);

    return () => {
      isCleanedUp = true;
      if (ws) ws.close();
      if (localInterval) clearInterval(localInterval);
    };
  }, [onConnectionStatusChange, onStatsUpdate]);

  // Deck.gl Layers
  const layers = useMemo(() => {
    const layerList = [];

    // 1. Road Network Layer (with closed road highlight)
    if (layersVisible.roads) {
      layerList.push(
        new GeoJsonLayer({
          id: 'roads-network-layer',
          data: roads,
          pickable: true,
          stroked: true,
          filled: false,
          extruded: true,
          lineWidthScale: 1,
          lineWidthMinPixels: 2,
          getLineWidth: (d) => {
            const isClosed =
              selectedRoadId !== null &&
              (d.id === selectedRoadId ||
                d.properties?.id === selectedRoadId ||
                d.properties?.name === selectedRoadId);
            return isClosed ? 8 : 3;
          },
          getLineColor: (d) => {
            const isClosed =
              selectedRoadId !== null &&
              (d.id === selectedRoadId ||
                d.properties?.id === selectedRoadId ||
                d.properties?.name === selectedRoadId);
            if (isClosed) return [255, 30, 60, 255]; // Vivid warning red for closed road
            return d.properties?.color || [79, 172, 254, 200];
          },
          opacity: 0.85,
          onHover: (info) => setHoverInfo(info),
          updateTriggers: {
            getLineWidth: [selectedRoadId],
            getLineColor: [selectedRoadId]
          }
        })
      );
    }

    // 2. 2030 Master Plan Transit & Greenway Corridors
    if (layersVisible.masterPlan) {
      layerList.push(
        new PathLayer({
          id: 'master-plan-corridors',
          data: MASTER_PLAN_2030.transitCorridors,
          pickable: true,
          getPath: (d) => d.path,
          getColor: (d) => d.color,
          getWidth: (d) => d.width,
          widthMinPixels: 3,
          widthMaxPixels: 12,
          capRounded: true,
          jointRounded: true,
          onHover: (info) => setHoverInfo(info)
        }),
        new ScatterplotLayer({
          id: 'master-plan-poles',
          data: MASTER_PLAN_2030.smartPoles,
          pickable: true,
          opacity: 0.9,
          stroked: true,
          filled: true,
          radiusScale: 1,
          radiusMinPixels: 6,
          radiusMaxPixels: 16,
          lineWidthMinPixels: 2,
          getPosition: (d) => [d.coordinates[0], d.coordinates[1]],
          getFillColor: [168, 85, 247, 220],
          getLineColor: [255, 255, 255, 240],
          getRadius: 18,
          onHover: (info) => setHoverInfo(info)
        })
      );
    }

    // 3. Energy Grid: Substations, Power Lines & EV Chargers
    if (layersVisible.energyGrid) {
      layerList.push(
        new PathLayer({
          id: 'energy-grid-powerlines',
          data: ENERGY_GRID_DATA.powerLines,
          pickable: true,
          getPath: (d) => [d.from, d.to],
          getColor: (d) => d.color,
          getWidth: 4,
          widthMinPixels: 2,
          onHover: (info) => setHoverInfo(info)
        }),
        new ScatterplotLayer({
          id: 'energy-grid-substations',
          data: ENERGY_GRID_DATA.substations,
          pickable: true,
          opacity: 0.9,
          stroked: true,
          filled: true,
          radiusMinPixels: 8,
          radiusMaxPixels: 24,
          lineWidthMinPixels: 2,
          getPosition: (d) => [d.coordinates[0], d.coordinates[1]],
          getFillColor: (d) => d.color,
          getLineColor: [255, 255, 255, 255],
          getRadius: 30,
          onHover: (info) => setHoverInfo(info)
        }),
        new ScatterplotLayer({
          id: 'energy-grid-chargers',
          data: ENERGY_GRID_DATA.evChargers,
          pickable: true,
          opacity: 0.85,
          stroked: true,
          filled: true,
          radiusMinPixels: 5,
          radiusMaxPixels: 14,
          lineWidthMinPixels: 1.5,
          getPosition: (d) => [d.coordinates[0], d.coordinates[1]],
          getFillColor: [16, 185, 129, 230],
          getLineColor: [0, 242, 254, 255],
          getRadius: 14,
          onHover: (info) => setHoverInfo(info)
        })
      );
    }

    // 4. Pollution Heatmap Layer
    if (layersVisible.heatmap && pollution.length > 0) {
      layerList.push(
        new HeatmapLayer({
          id: 'pollution-heatmap-layer',
          data: pollution,
          getPosition: (d) => [d.lng, d.lat],
          getWeight: (d) => d.weight,
          radiusPixels: 45,
          intensity: scenario === 'traffic' ? 1.8 : 1.1,
          threshold: 0.08,
          opacity: 0.65,
          colorRange: [
            [33, 102, 172],
            [67, 147, 195],
            [146, 197, 222],
            [253, 219, 199],
            [244, 109, 67],
            [215, 48, 39],
            [165, 0, 38]
          ],
          updateTriggers: {
            getWeight: [pollution]
          }
        })
      );
    }

    // 5. Emergency Response Dynamic A* Route Path
    if (layersVisible.emergencyPath && ambulancePath.length > 1) {
      layerList.push(
        new PathLayer({
          id: 'ambulance-a-star-path',
          data: [{ path: ambulancePath, name: 'Active Emergency Route (A*)' }],
          pickable: false,
          getPath: (d) => d.path,
          getColor: [239, 68, 68, 240], // Radiant emergency red
          getWidth: 5,
          widthMinPixels: 3,
          widthMaxPixels: 10,
          capRounded: true,
          jointRounded: true,
          updateTriggers: {
            getPath: [ambulancePath]
          }
        })
      );
    }

    // 6. Traffic & Fleet Scatterplot Layer
    if (layersVisible.vehicles && vehicles.length > 0) {
      layerList.push(
        new ScatterplotLayer({
          id: 'vehicles-fleet-layer',
          data: vehicles,
          pickable: true,
          opacity: 0.95,
          stroked: true,
          filled: true,
          radiusScale: 1,
          radiusMinPixels: 4,
          radiusMaxPixels: 24,
          lineWidthMinPixels: 1,
          getPosition: (d) => [d.lng, d.lat],
          getFillColor: (d) => (d.isAmbulance ? [239, 68, 68] : [250, 204, 21]),
          getLineColor: (d) => (d.isAmbulance ? [255, 255, 255] : [200, 160, 0]),
          getRadius: (d) => (d.isAmbulance ? 24 : 10),
          onHover: (info) => setHoverInfo(info),
          updateTriggers: {
            getPosition: [vehicles],
            getFillColor: [vehicles],
            getRadius: [vehicles]
          }
        })
      );
    }

    return layerList;
  }, [
    roads,
    vehicles,
    pollution,
    ambulancePath,
    layersVisible,
    selectedRoadId,
    scenario
  ]);

  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh' }}>
      <DeckGL
        viewState={viewState}
        controller={true}
        layers={layers}
        onViewStateChange={({ viewState: nextState }) => onViewStateChange?.(nextState)}
        getCursor={({ isHovering }) => (isHovering ? 'pointer' : 'default')}
      >
        <Map mapStyle={MAP_STYLE} reuseMaps preventStyleDiffing={true} />
      </DeckGL>

      {/* Interactive Tooltip Card */}
      {hoverInfo && hoverInfo.object && (
        <div
          className="map-tooltip"
          style={{
            position: 'absolute',
            left: hoverInfo.x + 12,
            top: hoverInfo.y + 12,
            zIndex: 100
          }}
        >
          {hoverInfo.object.properties?.name && (
            <div>
              <div className="tooltip-title">{hoverInfo.object.properties.name}</div>
              <div className="tooltip-desc">
                Classification: {hoverInfo.object.properties.highway || 'Urban Road'}<br />
                Lanes: {hoverInfo.object.properties.lanes || 2} | Speed Limit: {hoverInfo.object.properties.speedLimit || 25} mph
              </div>
            </div>
          )}

          {hoverInfo.object.name && !hoverInfo.object.properties && (
            <div>
              <div className="tooltip-title">{hoverInfo.object.name}</div>
              <div className="tooltip-desc">
                {hoverInfo.object.capacityMW && (
                  <>Capacity: {hoverInfo.object.capacityMW} MW | Load: {hoverInfo.object.loadPercentage}%<br /></>
                )}
                {hoverInfo.object.ports && (
                  <>EV Ports: {hoverInfo.object.ports} ({hoverInfo.object.available} Available)<br /></>
                )}
                {hoverInfo.object.voltage && <>Type: {hoverInfo.object.voltage}<br /></>}
                {hoverInfo.object.type && <>Classification: {hoverInfo.object.type}</>}
              </div>
            </div>
          )}

          {hoverInfo.object.id && !hoverInfo.object.name && !hoverInfo.object.properties && (
            <div>
              <div className="tooltip-title">
                {hoverInfo.object.isAmbulance ? '🚑 Emergency Unit (Priority)' : `🚗 Fleet Vehicle #${hoverInfo.object.id}`}
              </div>
              <div className="tooltip-desc">
                Speed: {hoverInfo.object.speed || '24'} mph<br />
                Coordinates: {hoverInfo.object.lat?.toFixed(4)}, {hoverInfo.object.lng?.toFixed(4)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DeckGLMap;
