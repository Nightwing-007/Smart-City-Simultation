import React, { useState, useCallback } from 'react';
import DeckGLMap from './components/DeckGLMap';
import Sidebar from './components/Sidebar';
import { SCENARIO_CONFIGS } from './data/smartCityData';
import './index.css';

const INITIAL_VIEW_STATE = {
  longitude: -73.9835,
  latitude: 40.7585,
  zoom: 14.5,
  pitch: 45,
  bearing: -15
};

function App() {
  const [scenario, setScenario] = useState('current');
  const [viewState, setViewState] = useState(INITIAL_VIEW_STATE);
  const [selectedRoadId, setSelectedRoadId] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState('standalone'); // 'connected' | 'standalone'
  const [stats, setStats] = useState({
    vehicleCount: 51,
    avgSpeed: '24.2 mph',
    aqiIndex: 48,
    emergencyStatus: 'A* En Route'
  });

  const [layersVisible, setLayersVisible] = useState({
    roads: true,
    vehicles: true,
    heatmap: true,
    masterPlan: false,
    energyGrid: false,
    emergencyPath: true
  });

  // Handle Scenario Switch
  const handleScenarioChange = useCallback((newScenario) => {
    setScenario(newScenario);
    const config = SCENARIO_CONFIGS[newScenario];
    if (config) {
      if (config.layerDefaults) {
        setLayersVisible((prev) => ({
          ...prev,
          ...config.layerDefaults
        }));
      }
      if (config.camera) {
        setViewState((prev) => ({
          ...prev,
          ...config.camera,
          transitionDuration: 1000
        }));
      }
    }
  }, []);

  // Handle Layer Toggle
  const handleToggleLayer = useCallback((layerKey) => {
    setLayersVisible((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey]
    }));
  }, []);

  // Handle Camera Presets
  const handleCameraPreset = useCallback((targetPreset) => {
    setViewState((prev) => ({
      ...prev,
      ...targetPreset,
      transitionDuration: 1200
    }));
  }, []);

  return (
    <div className="app-container">
      <DeckGLMap
        scenario={scenario}
        layersVisible={layersVisible}
        selectedRoadId={selectedRoadId}
        viewState={viewState}
        onViewStateChange={setViewState}
        onStatsUpdate={setStats}
        onConnectionStatusChange={setConnectionStatus}
      />
      <Sidebar
        scenario={scenario}
        onScenarioChange={handleScenarioChange}
        layersVisible={layersVisible}
        onToggleLayer={handleToggleLayer}
        selectedRoadId={selectedRoadId}
        onSelectRoad={setSelectedRoadId}
        onCameraPreset={handleCameraPreset}
        stats={stats}
        connectionStatus={connectionStatus}
      />
    </div>
  );
}

export default App;
