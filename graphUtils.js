// Haversine formula to get distance in meters between two [lng, lat] EPSG:4326 coordinates
function getDistance(coord1, coord2) {
  if (!coord1 || !coord2) return 0;
  const R = 6371e3; // metres
  const φ1 = (coord1[1] * Math.PI) / 180;
  const φ2 = (coord2[1] * Math.PI) / 180;
  const Δφ = ((coord2[1] - coord1[1]) * Math.PI) / 180;
  const Δλ = ((coord2[0] - coord1[0]) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

function getCoordKey(coord) {
  return `${Number(coord[0]).toFixed(6)},${Number(coord[1]).toFixed(6)}`;
}

function getSegmentKey(u, v) {
  const uKey = getCoordKey(u);
  const vKey = getCoordKey(v);
  return uKey < vKey ? `${uKey}<->${vKey}` : `${vKey}<->${uKey}`;
}

// 2D segment-segment intersection helper for road mesh creation
function lineIntersection(p1, p2, p3, p4) {
  const x1 = p1[0], y1 = p1[1], x2 = p2[0], y2 = p2[1];
  const x3 = p3[0], y3 = p3[1], x4 = p4[0], y4 = p4[1];
  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;
  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
  if (t >= 0.001 && t <= 0.999 && u >= 0.001 && u <= 0.999) {
    return {
      pt: [x1 + t * (x2 - x1), y1 + t * (y2 - y1)],
      t,
      u
    };
  }
  return null;
}

/**
 * Builds in-memory graph from raw spatial LineString features
 */
function buildGraphFromFeatures(features) {
  const rawSegments = [];
  if (features && Array.isArray(features)) {
    features.forEach((feature) => {
      const roadId = feature.id || feature.osm_id || feature.name || null;
      let coords = null;
      if (feature.geometry && feature.geometry.type === 'LineString') {
        coords = feature.geometry.coordinates;
      } else if (feature.coordinates) {
        coords = feature.coordinates;
      }

      if (coords && Array.isArray(coords)) {
        for (let i = 0; i < coords.length - 1; i++) {
          rawSegments.push({
            u: coords[i],
            v: coords[i + 1],
            roadId,
            intersections: []
          });
        }
      }
    });
  }

  // Calculate pairwise segment intersections for realistic road mesh
  const maxSegmentIntersectionChecks = Math.min(rawSegments.length, 500);
  for (let i = 0; i < maxSegmentIntersectionChecks; i++) {
    for (let j = i + 1; j < maxSegmentIntersectionChecks; j++) {
      const res = lineIntersection(
        rawSegments[i].u,
        rawSegments[i].v,
        rawSegments[j].u,
        rawSegments[j].v
      );
      if (res) {
        rawSegments[i].intersections.push({ pt: res.pt, t: res.t });
        rawSegments[j].intersections.push({ pt: res.pt, t: res.u });
      }
    }
  }

  const adjacencyList = new Map();
  const nodes = [];
  const nodeMap = new Map();
  const segments = [];
  const segmentMap = new Map();

  const addNode = (pos) => {
    const key = getCoordKey(pos);
    if (!nodeMap.has(key)) {
      nodeMap.set(key, pos);
      nodes.push(pos);
      adjacencyList.set(key, []);
    }
    return key;
  };

  const addEdge = (u, v, roadId = null) => {
    const uKey = addNode(u);
    const vKey = addNode(v);
    if (uKey === vKey) return;

    const segmentKey = getSegmentKey(u, v);
    const weight = getDistance(u, v);

    if (!segmentMap.has(segmentKey)) {
      const segmentInfo = { segmentKey, u, v, uKey, vKey, distance: weight, roadId };
      segmentMap.set(segmentKey, segmentInfo);
      segments.push(segmentInfo);
    }

    adjacencyList.get(uKey).push({
      node: v,
      nodeKey: vKey,
      weight,
      segmentKey,
      roadId
    });

    adjacencyList.get(vKey).push({
      node: u,
      nodeKey: uKey,
      weight,
      segmentKey,
      roadId
    });
  };

  rawSegments.forEach((seg) => {
    seg.intersections.sort((a, b) => a.t - b.t);
    const pts = [seg.u, ...seg.intersections.map((x) => x.pt), seg.v];
    for (let i = 0; i < pts.length - 1; i++) {
      addEdge(pts[i], pts[i + 1], seg.roadId);
    }
  });

  return { adjacencyList, nodes, segments, segmentMap };
}

/**
 * Queries PostGIS directly to load real OpenStreetMap road geometries
 * Transforms PostGIS EPSG:3857 spatial geometries to standard EPSG:4326 lat/lng coordinates
 * @param {import('pg').Pool} pool - PostgreSQL connection pool
 * @returns {Promise<{ adjacencyList: Map, nodes: Array, segments: Array, segmentMap: Map }>}
 */
async function loadGraphFromPostGIS(pool) {
  console.log('[GraphService] Querying spatial road network from PostGIS database...');

  // SQL Query transforming PostGIS Web Mercator (EPSG:3857) to standard WGS84 EPSG:4326 coordinates
  const query = `
    SELECT 
      osm_id,
      name,
      highway,
      ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson
    FROM planet_osm_line
    WHERE highway IS NOT NULL AND way IS NOT NULL
    LIMIT 10000;
  `;

  try {
    const result = await pool.query(query);
    const features = [];

    if (result && result.rows && result.rows.length > 0) {
      for (const row of result.rows) {
        if (!row.geojson) continue;
        const geom = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
        if (geom && geom.type === 'LineString' && Array.isArray(geom.coordinates)) {
          features.push({
            id: row.osm_id ? String(row.osm_id) : undefined,
            name: row.name || row.highway,
            highway: row.highway,
            geometry: geom
          });
        }
      }
    }

    if (features.length === 0) {
      console.warn('[GraphService] Warning: PostGIS table planet_osm_line is empty or unpopulated.');
      console.warn('[GraphService] Run ./ingest.sh or osm2pgsql container to populate OpenStreetMap data.');
      return { adjacencyList: new Map(), nodes: [], segments: [], segmentMap: new Map() };
    }

    const graph = buildGraphFromFeatures(features);
    console.log(`[GraphService] Spatial Graph successfully loaded from PostGIS. Total Nodes: ${graph.nodes.length}, Segments: ${graph.segments.length}`);
    return graph;
  } catch (error) {
    console.error('[GraphService] Error querying PostGIS database:', error.message);
    return { adjacencyList: new Map(), nodes: [], segments: [], segmentMap: new Map() };
  }
}

/**
 * A* Pathfinding algorithm with dynamic edge weights based on traffic density
 * @param {number[]} start - [lng, lat]
 * @param {number[]} goal - [lng, lat]
 * @param {Map} adjacencyList - Graph adjacency map
 * @param {Map|Object} trafficDensity - Map of segmentKey -> vehicleCount
 * @param {Object} options - Additional options like penaltyMultiplier and closedRoadId
 */
function aStar(start, goal, adjacencyList, trafficDensity = null, options = {}) {
  const startKey = getCoordKey(start);
  const goalKey = getCoordKey(goal);
  const penaltyMultiplier = options.penaltyMultiplier ?? 3.0;
  const closedRoadId = options.closedRoadId ?? null;

  if (startKey === goalKey) {
    return [start];
  }

  const openSet = new Set([startKey]);
  const cameFrom = new Map();

  const gScore = new Map();
  gScore.set(startKey, 0);

  const fScore = new Map();
  fScore.set(startKey, getDistance(start, goal));

  const getCoordFromKey = (key) => {
    const parts = key.split(',').map(Number);
    return [parts[0], parts[1]];
  };

  while (openSet.size > 0) {
    let currentStr = null;
    let minF = Infinity;

    for (const nodeStr of openSet) {
      const score = fScore.has(nodeStr) ? fScore.get(nodeStr) : Infinity;
      if (score < minF) {
        minF = score;
        currentStr = nodeStr;
      }
    }

    if (currentStr === goalKey) {
      const path = [goal];
      let curr = currentStr;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr);
        path.unshift(getCoordFromKey(curr));
      }
      return path;
    }

    openSet.delete(currentStr);
    const neighbors = adjacencyList.get(currentStr) || [];

    for (const neighbor of neighbors) {
      const neighborKey = neighbor.nodeKey || getCoordKey(neighbor.node);

      // Avoid closed road if specified
      if (
        closedRoadId &&
        neighbor.roadId &&
        (neighbor.roadId === closedRoadId || `road-${neighbor.roadId}` === closedRoadId)
      ) {
        continue;
      }

      // Base weight is distance in meters
      let edgeWeight = neighbor.weight;

      // Dynamic weight: penalize edges with high traffic density
      if (trafficDensity) {
        let density = 0;
        if (trafficDensity instanceof Map) {
          density =
            trafficDensity.get(neighbor.segmentKey) ||
            trafficDensity.get(`${currentStr}->${neighborKey}`) ||
            0;
        } else if (typeof trafficDensity === 'object') {
          density =
            trafficDensity[neighbor.segmentKey] ||
            trafficDensity[`${currentStr}->${neighborKey}`] ||
            0;
        }
        if (density > 0) {
          edgeWeight *= 1 + density * penaltyMultiplier;
        }
      }

      const tentativeGScore = (gScore.get(currentStr) ?? Infinity) + edgeWeight;
      const currentNeighborGScore = gScore.has(neighborKey) ? gScore.get(neighborKey) : Infinity;

      if (tentativeGScore < currentNeighborGScore) {
        cameFrom.set(neighborKey, currentStr);
        gScore.set(neighborKey, tentativeGScore);
        const hScore = getDistance(neighbor.node, goal);
        fScore.set(neighborKey, tentativeGScore + hScore);
        openSet.add(neighborKey);
      }
    }
  }

  // If A* fails, return direct line between start and goal
  return [start, goal];
}

module.exports = {
  loadGraphFromPostGIS,
  buildGraphFromFeatures,
  aStar,
  getDistance,
  getCoordKey,
  getSegmentKey
};
