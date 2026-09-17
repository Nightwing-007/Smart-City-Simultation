const express = require('express');
const { Pool } = require('pg');
const http = require('http');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const { simulateTick } = require('./simulation');

const app = express();
const port = process.env.PORT || 3000;

// Enable CORS for frontend dashboard
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Setup HTTP & WebSocket server
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const pool = new Pool({
  user: process.env.DB_USER || 'admin',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'citytwin',
  password: process.env.DB_PASSWORD || 'admin',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  connectionTimeoutMillis: 2000
});

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'citytwin-node-api', timestamp: new Date().toISOString() });
});

// Spatial Roads Endpoint with PostGIS query & static fallback
app.get('/api/roads', async (req, res) => {
  try {
    const query = `
      SELECT jsonb_build_object(
          'type',     'FeatureCollection',
          'features', COALESCE(jsonb_agg(feature), '[]'::jsonb)
      ) AS geojson
      FROM (
        SELECT jsonb_build_object(
          'type',       'Feature',
          'geometry',   ST_AsGeoJSON(ST_Transform(way, 4326))::jsonb,
          'properties', to_jsonb(inputs) - 'way'
        ) AS feature
        FROM (
          SELECT * FROM planet_osm_line WHERE highway IS NOT NULL LIMIT 5000
        ) inputs
      ) features;
    `;
    const result = await pool.query(query);
    if (result.rows[0]?.geojson?.features?.length > 0) {
      return res.json(result.rows[0].geojson);
    }
  } catch (error) {
    // Database offline or table not ingested yet - gracefully fallback to local spatial roads
  }

  // Fallback to mockRoads.json
  try {
    const fallbackPath = path.join(__dirname, 'frontend', 'src', 'data', 'mockRoads.json');
    if (fs.existsSync(fallbackPath)) {
      const fallbackData = JSON.parse(fs.readFileSync(fallbackPath, 'utf8'));
      return res.json(fallbackData);
    }
  } catch (err) {
    console.error('Error reading fallback roads:', err.message);
  }

  res.json({ type: 'FeatureCollection', features: [] });
});

// WebSocket connection lifecycle
wss.on('connection', (ws) => {
  try {
    const initialData = simulateTick();
    ws.send(JSON.stringify(initialData));
  } catch (err) {
    console.error('Initial WebSocket frame error:', err.message);
  }
});

// Broadcast simulation loop (100ms / 10 FPS)
setInterval(() => {
  try {
    const simData = simulateTick();
    const payload = JSON.stringify(simData);
    wss.clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    });
  } catch (err) {
    console.error('Simulation tick error:', err.message);
  }
}, 100);

server.listen(port, () => {
  console.log(`Node Ingestion & Simulation API running at http://localhost:${port}`);
  console.log(`WebSocket Stream active at ws://localhost:${port}`);
});
