const fs = require('fs');
const path = require('path');

// Haversine formula to get distance in meters between two [lng, lat] coordinates
function getDistance(coord1, coord2) {
  const R = 6371e3; // metres
  const φ1 = coord1[1] * Math.PI/180;
  const φ2 = coord2[1] * Math.PI/180;
  const Δφ = (coord2[1]-coord1[1]) * Math.PI/180;
  const Δλ = (coord2[0]-coord1[0]) * Math.PI/180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c;
}

function buildGraph() {
  const dataPath = path.join(__dirname, 'frontend', 'src', 'data', 'mockRoads.json');
  const data = JSON.parse(fs.readFileSync(dataPath, 'utf8'));

  const adjacencyList = new Map();
  const nodes = [];

  const addEdge = (u, v, weight) => {
    const uKey = u.join(',');
    const vKey = v.join(',');

    if (!adjacencyList.has(uKey)) adjacencyList.set(uKey, []);
    if (!adjacencyList.has(vKey)) adjacencyList.set(vKey, []);

    adjacencyList.get(uKey).push({ node: v, weight });
    adjacencyList.get(vKey).push({ node: u, weight }); // undirected graph for two-way streets

    if (!nodes.some(n => n.join(',') === uKey)) nodes.push(u);
    if (!nodes.some(n => n.join(',') === vKey)) nodes.push(v);
  };

  data.features.forEach(feature => {
    if (feature.geometry.type === 'LineString') {
      const coords = feature.geometry.coordinates;
      for (let i = 0; i < coords.length - 1; i++) {
        const u = coords[i];
        const v = coords[i + 1];
        const dist = getDistance(u, v);
        addEdge(u, v, dist);
      }
    }
  });

  return { adjacencyList, nodes };
}

function aStar(start, goal, adjacencyList) {
  const openSet = new Set([start.join(',')]);
  const cameFrom = new Map();
  
  const gScore = new Map();
  gScore.set(start.join(','), 0);

  const fScore = new Map();
  fScore.set(start.join(','), getDistance(start, goal));

  while (openSet.size > 0) {
    let currentStr = null;
    let minF = Infinity;

    for (const nodeStr of openSet) {
      const score = fScore.get(nodeStr) || Infinity;
      if (score < minF) {
        minF = score;
        currentStr = nodeStr;
      }
    }

    if (currentStr === goal.join(',')) {
      const path = [goal];
      let curr = currentStr;
      while (cameFrom.has(curr)) {
        curr = cameFrom.get(curr);
        // ensure we push numbers, not strings
        path.unshift(curr.split(',').map(Number));
      }
      return path;
    }

    openSet.delete(currentStr);
    const currentCoord = currentStr.split(',').map(Number);

    const neighbors = adjacencyList.get(currentStr) || [];
    for (const neighbor of neighbors) {
      const neighborStr = neighbor.node.join(',');
      const tentativeGScore = gScore.get(currentStr) + neighbor.weight;

      const currentNeighborGScore = gScore.has(neighborStr) ? gScore.get(neighborStr) : Infinity;

      if (tentativeGScore < currentNeighborGScore) {
        cameFrom.set(neighborStr, currentStr);
        gScore.set(neighborStr, tentativeGScore);
        fScore.set(neighborStr, tentativeGScore + getDistance(neighbor.node, goal));
        openSet.add(neighborStr);
      }
    }
  }

  return []; // No path found
}

module.exports = { buildGraph, aStar, getDistance };
