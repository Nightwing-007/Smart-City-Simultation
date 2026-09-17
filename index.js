const express = require('express');
const { Pool } = require('pg');
const http = require('http');
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
});

app.get('/health', (req, res) => {
  res.json({ status: 'UP', service: 'citytwin-node-api' });
});

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
    res.json(result.rows[0]?.geojson || { type: 'FeatureCollection', features: [] });
  } catch (error) {
    console.error('Database query error:', error.message);
    res.status(500).json({ error: 'Database unavailable or table not yet ingested. Run ./ingest.sh' });
  }
});

// Broadcast loop
setInterval(() => {
  try {
    const vehicleData = simulateTick();
    const payload = JSON.stringify(vehicleData);
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
  console.log(`Node Ingestion API running at http://localhost:${port}`);
  console.log(`Database connected to host: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}`);
});
