const { loadGraphFromPostGIS, aStar, getDistance, getSegmentKey, getCoordKey } = require('./graphUtils');

let adjacencyList = new Map();
let nodes = [];
let segments = [];
let segmentMap = new Map();

class Vehicle {
  constructor(id, isAmbulance = false) {
    this.id = id;
    this.isAmbulance = isAmbulance;
    // Speed: regular vehicles 2.0-3.5 m/tick, ambulance ~5.0 m/tick
    this.speedPerTick = isAmbulance ? 5.0 : Math.random() * 1.5 + 2.0;
    this.path = [];
    this.currentEdgeIndex = 0;
    this.position = null;
    this.destination = null;
    if (nodes.length >= 2) {
      this.assignNewRoute();
    }
  }

  assignNewRoute(densityMap = null) {
    if (!nodes || nodes.length < 2) return;

    let startNode;
    if (this.position) {
      let closest = nodes[0];
      let minDist = getDistance(this.position, closest);
      const searchLimit = Math.min(nodes.length, 200);
      for (let i = 1; i < searchLimit; i++) {
        const d = getDistance(this.position, nodes[i]);
        if (d < minDist) {
          minDist = d;
          closest = nodes[i];
        }
      }
      startNode = closest;
    } else {
      startNode = nodes[Math.floor(Math.random() * nodes.length)];
    }

    let endNode = nodes[Math.floor(Math.random() * nodes.length)];
    let attempts = 0;
    while (getCoordKey(startNode) === getCoordKey(endNode) && nodes.length > 1 && attempts < 10) {
      endNode = nodes[Math.floor(Math.random() * nodes.length)];
      attempts++;
    }

    this.destination = endNode;
    this.path = aStar(startNode, endNode, adjacencyList, densityMap, {
      penaltyMultiplier: this.isAmbulance ? 3.5 : 1.5
    });

    this.currentEdgeIndex = 0;
    if (this.path && this.path.length > 0) {
      this.position = [...this.path[0]];
    }
  }

  getCurrentSegmentKey() {
    if (!this.path || this.path.length <= 1 || this.currentEdgeIndex >= this.path.length - 1) {
      return null;
    }
    const p1 = this.path[this.currentEdgeIndex];
    const p2 = this.path[this.currentEdgeIndex + 1];
    return getSegmentKey(p1, p2);
  }

  tick(densityMap = null) {
    if (!this.path || this.path.length <= 1 || this.currentEdgeIndex >= this.path.length - 1) {
      this.assignNewRoute(densityMap);
      return;
    }

    const p1 = this.path[this.currentEdgeIndex];
    const p2 = this.path[this.currentEdgeIndex + 1];
    const dist = getDistance(this.position, p2);

    if (dist <= this.speedPerTick) {
      this.position = [...p2];
      this.currentEdgeIndex++;
      if (this.currentEdgeIndex >= this.path.length - 1) {
        this.assignNewRoute(densityMap);
      }
    } else {
      const ratio = this.speedPerTick / dist;
      this.position[0] += (p2[0] - this.position[0]) * ratio;
      this.position[1] += (p2[1] - this.position[1]) * ratio;
    }
  }

  getRemainingPath() {
    if (!this.path || this.path.length === 0) {
      return this.position ? [this.position] : [];
    }
    const remaining = this.path.slice(this.currentEdgeIndex + 1);
    if (this.position) {
      return [[this.position[0], this.position[1]], ...remaining];
    }
    return remaining;
  }
}

class Ambulance extends Vehicle {
  constructor(id = 'ambulance-1') {
    super(id, true);
  }
}

let vehicles = [];
let ambulance = null;
const trafficDensity = new Map();

/**
 * Initializes simulation engine with spatial graph from PostGIS
 */
async function initSimulation(pool) {
  const graph = await loadGraphFromPostGIS(pool);
  adjacencyList = graph.adjacencyList;
  nodes = graph.nodes;
  segments = graph.segments;
  segmentMap = graph.segmentMap;

  if (nodes.length > 0) {
    vehicles = Array.from({ length: 50 }, (_, i) => new Vehicle(`v-${i}`, false));
    ambulance = new Ambulance('ambulance-1');
  }
}

/**
 * Reloads simulation graph from PostGIS tables
 */
async function reloadSimulationGraph(pool) {
  await initSimulation(pool);
}

/**
 * Pollution calculation function.
 * Calculates scaling pollution index for every road segment where active vehicles exceed the threshold.
 */
function calculatePollution(densityMap, threshold = 2) {
  const pollutionHotspots = [];

  for (const [segmentKey, count] of densityMap.entries()) {
    if (count >= threshold) {
      const seg = segmentMap.get(segmentKey);
      if (seg) {
        const midLng = (seg.u[0] + seg.v[0]) / 2;
        const midLat = (seg.u[1] + seg.v[1]) / 2;
        const pollutionIndex = Math.min(100, Math.round(count * 18));

        pollutionHotspots.push({
          lng: Number(midLng.toFixed(6)),
          lat: Number(midLat.toFixed(6)),
          weight: pollutionIndex,
          pollutionIndex,
          activeVehicles: count,
          segmentKey
        });
      }
    }
  }

  return pollutionHotspots;
}

function simulateTick() {
  if (nodes.length === 0 || vehicles.length === 0) {
    return {
      vehicles: [],
      ambulance: null,
      ambulancePath: [],
      pollution: [],
      activeCongestedSegments: 0,
      timestamp: Date.now()
    };
  }

  // 1. Calculate current traffic density across all network segments
  trafficDensity.clear();
  const allEntities = [...vehicles];
  if (ambulance) allEntities.push(ambulance);

  allEntities.forEach((v) => {
    const segKey = v.getCurrentSegmentKey();
    if (segKey) {
      const count = (trafficDensity.get(segKey) || 0) + 1;
      trafficDensity.set(segKey, count);
    }
  });

  // 2. Advance all regular vehicles & ambulance
  vehicles.forEach((v) => v.tick(trafficDensity));
  if (ambulance) ambulance.tick(trafficDensity);

  // 3. Compute pollution layer based on traffic density
  const pollution = calculatePollution(trafficDensity, 2);

  // 4. Format vehicle positions for broadcast
  const vehicleData = vehicles.map((v) => ({
    id: v.id,
    lng: v.position ? Number(v.position[0].toFixed(6)) : 0,
    lat: v.position ? Number(v.position[1].toFixed(6)) : 0,
    isAmbulance: false,
    speed: (v.speedPerTick * 7.2).toFixed(1)
  }));

  let ambulanceData = null;
  let ambulancePath = [];

  if (ambulance && ambulance.position) {
    ambulanceData = {
      id: ambulance.id,
      lng: Number(ambulance.position[0].toFixed(6)),
      lat: Number(ambulance.position[1].toFixed(6)),
      isAmbulance: true,
      speed: (ambulance.speedPerTick * 7.2).toFixed(1),
      destination: ambulance.destination
    };
    vehicleData.push(ambulanceData);
    ambulancePath = ambulance.getRemainingPath();
  }

  return {
    vehicles: vehicleData,
    ambulance: ambulanceData,
    ambulancePath,
    pollution,
    activeCongestedSegments: pollution.length,
    timestamp: Date.now()
  };
}

module.exports = {
  initSimulation,
  reloadSimulationGraph,
  simulateTick,
  calculatePollution,
  Vehicle,
  Ambulance,
  getVehicles: () => vehicles,
  getAmbulance: () => ambulance,
  getNodes: () => nodes,
  trafficDensity
};
