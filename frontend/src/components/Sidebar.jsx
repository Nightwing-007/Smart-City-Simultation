import React, { useState } from 'react';
import mockRoads from '../data/mockRoads.json';

const Sidebar = () => {
  const [selectedRoad, setSelectedRoad] = useState('');
  const [prediction, setPrediction] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handlePredict = async (roadIndex) => {
    if (roadIndex === '') {
      setPrediction(null);
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`http://localhost:8000/predict?closed_road_id=${roadIndex}`);
      if (!response.ok) {
        throw new Error("Failed to fetch prediction");
      }
      const data = await response.json();
      setPrediction(data);
    } catch (err) {
      console.error(err);
      setError("AI Oracle is currently offline.");
    } finally {
      setLoading(false);
    }
  };

  const onRoadChange = (e) => {
    const val = e.target.value;
    setSelectedRoad(val);
    handlePredict(val);
  };

  return (
    <div className="sidebar">
      <div>
        <h1>Digital Twin Controls</h1>
        <p>Smart City Interactive Dashboard</p>
      </div>

      <div className="control-group">
        <label htmlFor="scenario-select">City Scenario</label>
        <select id="scenario-select" defaultValue="current">
          <option value="current">Current Infrastructure</option>
          <option value="future">2030 Master Plan</option>
          <option value="traffic">Traffic Simulation</option>
          <option value="energy">Energy Grid</option>
        </select>
      </div>

      <div className="control-group" style={{ marginTop: '20px', padding: '15px', background: 'rgba(255,255,255,0.05)', borderRadius: '8px' }}>
        <h3>🔮 AI Oracle: What-If Analysis</h3>
        <p style={{ fontSize: '0.85em', color: '#ccc', marginBottom: '10px' }}>Predict impact of road closures</p>
        
        <label htmlFor="road-select">Simulate Closing Road</label>
        <select id="road-select" value={selectedRoad} onChange={onRoadChange} style={{ marginBottom: '15px', width: '100%', padding: '8px' }}>
          <option value="">-- Select a road to close --</option>
          {mockRoads.features.map((feature, index) => (
            <option key={index} value={index}>
              {feature.properties.name}
            </option>
          ))}
        </select>

        {loading && <div style={{ color: '#00f2fe' }}>Consulting Oracle...</div>}
        
        {error && <div style={{ color: '#ff6b6b' }}>{error}</div>}

        {prediction && !loading && (
          <div style={{ marginTop: '10px', padding: '10px', borderLeft: '3px solid #ff6b6b', background: 'rgba(255, 107, 107, 0.1)' }}>
            <h4 style={{ margin: '0 0 10px 0', color: '#ff6b6b' }}>⚠️ Warning: Cascading Impact</h4>
            <div style={{ fontSize: '0.9em' }}>
              <strong>Pollution Spike:</strong> +{prediction.pollution_spike_percentage}%<br/>
              <strong>Avg Ambulance Delay:</strong> +{prediction.avg_ambulance_delay_seconds}s
            </div>
            <div style={{ fontSize: '0.8em', marginTop: '10px', color: '#999' }}>
              (Based on simulated traffic weight of {prediction.traffic_weight})
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;
