const express = require('express');
const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');
const { simulateTick } = require('./simulation');

const app = express();
const port = 3000;
const wsPort = 8080;

// Setup HTTP server for Express
const server = http.createServer(app);

// Setup WebSocket server on a separate port or same server. Let's do same server.
const wss = new WebSocket.Server({ server });

const pool = new Pool({
  user: 'admin',
  host: 'localhost',
  database: 'citytwin',
  password: 'admin',
  port: 5432,
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
          SELECT * FROM planet_osm_line WHERE highway IS NOT NULL
        ) inputs
      ) features;
    `;
    const result = await pool.query(query);
    res.json(result.rows[0].geojson);
  } catch (error) {
    console.error('Database query error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

// Broadcast loop
setInterval(() => {
  const vehicleData = simulateTick();
  const payload = JSON.stringify(vehicleData);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  });
}, 100);

server.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  console.log(`WebSocket server attached`);
});
