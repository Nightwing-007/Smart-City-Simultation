const fs = require('fs');
const path = require('path');

// Haversine formula to get distance in meters between two [lng, lat] coordinates
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

// 2D segment-segment intersection helper
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

function buildGraph(customData = null) {
  let data = customData;
  if (!data) {
    const dataPath = path.join(__dirname, 'frontend', 'src', 'data', 'mockRoads.json');
    if (fs.existsSync(dataPath)) {
      data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
    } else {
      data = { type: 'FeatureCollection', features: [] };
    }
  }

  const rawSegments = [];
  if (data && data.features) {
    data.features.forEach((feature) => {
      const roadId = feature.id || feature.properties?.id || feature.properties?.name || null;
      if (feature.geometry && feature.geometry.type === 'LineString') {
        const coords = feature.geometry.coordinates;
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

  // Find all pairwise segment intersections
  for (let i = 0; i < rawSegments.length; i++) {
    for (let j = i + 1; j < rawSegments.length; j++) {
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
  buildGraph,
  aStar,
  getDistance,
  getCoordKey,
  getSegmentKey
};
