const express = require('express');
const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');
const { initSimulation, reloadSimulationGraph, simulateTick, getNodes } = require('./simulation');

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

// PostgreSQL connection pool (resolves container hostname 'db' in Docker network)
const pool = new Pool({
  user: process.env.POSTGRES_USER || process.env.DB_USER || 'admin',
  host: process.env.POSTGRES_HOST || process.env.DB_HOST || 'localhost',
  database: process.env.POSTGRES_DB || process.env.DB_NAME || 'citytwin',
  password: process.env.POSTGRES_PASSWORD || process.env.DB_PASSWORD || 'admin',
  port: parseInt(process.env.POSTGRES_PORT || process.env.DB_PORT || '5432', 10),
  connectionTimeoutMillis: 5000
});

// Health check endpoint
app.get('/health', (req, res) => {
  const nodeCount = getNodes ? getNodes().length : 0;
  res.json({
    status: 'UP',
    service: 'citytwin-node-api',
    graphNodes: nodeCount,
    dbHost: process.env.DB_HOST || 'localhost',
    timestamp: new Date().toISOString()
  });
});

// Real PostGIS Spatial Road Network Endpoint (Transforms EPSG:3857 to standard WGS84 EPSG:4326)
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
          'id',         COALESCE(osm_id::text, 'road-' || ctid::text),
          'geometry',   ST_AsGeoJSON(ST_Transform(way, 4326))::jsonb,
          'properties', jsonb_build_object(
            'id', COALESCE(osm_id::text, 'road-' || ctid::text),
            'name', COALESCE(name, highway),
            'highway', highway
          )
        ) AS feature
        FROM (
          SELECT * FROM planet_osm_line WHERE highway IS NOT NULL AND way IS NOT NULL LIMIT 5000
        ) inputs
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] });
  } catch (error) {
    console.error('[PostGIS Roads Query Error]:', error.message);
    res.status(500).json({
      error: 'PostGIS database unavailable or spatial table planet_osm_line not yet ingested. Run ./ingest.sh'
    });
  }
});

// Endpoint to reload graph after new OSM ingestion
app.post('/api/reload', async (req, res) => {
  try {
    await reloadSimulationGraph(pool);
    res.json({
      success: true,
      message: 'Spatial graph successfully reloaded from PostGIS database.',
      nodesCount: getNodes().length
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// WebSocket initial frame
wss.on('connection', (ws) => {
  try {
    const initialData = simulateTick();
    ws.send(JSON.stringify(initialData));
  } catch (err) {
    console.error('Initial WebSocket frame error:', err.message);
  }
});

// 100ms Broadcast Loop
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

// Initialize simulation from PostGIS and start server
async function start() {
  try {
    await initSimulation(pool);
  } catch (err) {
    console.warn('[Warning] Could not initialize graph from PostGIS immediately (DB may still be booting). Will retry on request.');
  }

  server.listen(port, () => {
    console.log(`Node Ingestion & Simulation API running at http://localhost:${port}`);
    console.log(`WebSocket Stream active at ws://localhost:${port}`);
    console.log(`Connected to PostGIS host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
  });
}

start();
