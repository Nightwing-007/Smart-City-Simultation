const { buildGraph, aStar, getDistance, getSegmentKey, getCoordKey } = require('./graphUtils');

const { adjacencyList, nodes, segments, segmentMap } = buildGraph();

class Vehicle {
  constructor(id, isAmbulance = false) {
    this.id = id;
    this.isAmbulance = isAmbulance;
    // Speed: regular vehicles 2.0-3.5 m/tick, ambulance ~5.0 m/tick
    this.speedPerTick = isAmbulance ? 5.0 : Math.random() * 1.5 + 2.0;
    this.path = [];
    this.currentEdgeIndex = 0;
    this.position = null;
    this.assignNewRoute();
  }

  assignNewRoute(densityMap = null) {
    if (!nodes || nodes.length < 2) return;

    let startNode;
    if (this.position) {
      // Find closest node to current position
      let closest = nodes[0];
      let minDist = getDistance(this.position, closest);
      for (let i = 1; i < nodes.length; i++) {
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
      // Node reached
      this.position = [...p2];
      this.currentEdgeIndex++;
      if (this.currentEdgeIndex >= this.path.length - 1) {
        this.assignNewRoute(densityMap);
      }
    } else {
      // Interpolate along segment
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

// Fleet initialization
const vehicles = Array.from({ length: 50 }, (_, i) => new Vehicle(`v-${i}`, false));
const ambulance = new Ambulance('ambulance-1');

// Segment traffic density map
const trafficDensity = new Map();

/**
 * Pollution calculation function.
 * Calculates scaling pollution index for every road segment where active vehicles exceed the threshold.
 * @param {Map} densityMap - Map of segmentKey -> active vehicle count
 * @param {number} threshold - Minimum vehicles on segment to trigger pollution index (default: 2)
 * @returns {Array} List of pollution intensity objects
 */
function calculatePollution(densityMap, threshold = 2) {
  const pollutionHotspots = [];

  for (const [segmentKey, count] of densityMap.entries()) {
    if (count >= threshold) {
      const seg = segmentMap.get(segmentKey);
      if (seg) {
        // Compute midpoint of the segment as the hotspot coordinate
        const midLng = (seg.u[0] + seg.v[0]) / 2;
        const midLat = (seg.u[1] + seg.v[1]) / 2;

        // Scaling pollution index (proportional to congestion density)
        // Scaling factor: e.g. 20 index points per vehicle above threshold, max 100
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
  // 1. Calculate current traffic density across all network segments
  trafficDensity.clear();

  const allEntities = [...vehicles, ambulance];

  // Count active vehicles on each segment
  allEntities.forEach((v) => {
    const segKey = v.getCurrentSegmentKey();
    if (segKey) {
      const count = (trafficDensity.get(segKey) || 0) + 1;
      trafficDensity.set(segKey, count);
    }
  });

  // 2. Advance all regular vehicles & ambulance
  vehicles.forEach((v) => v.tick(trafficDensity));
  ambulance.tick(trafficDensity);

  // 3. Compute pollution layer based on traffic density
  const pollution = calculatePollution(trafficDensity, 2);

  // 4. Format vehicle positions for broadcast
  const vehicleData = vehicles.map((v) => ({
    id: v.id,
    lng: v.position ? Number(v.position[0].toFixed(6)) : 0,
    lat: v.position ? Number(v.position[1].toFixed(6)) : 0,
    isAmbulance: false,
    speed: (v.speedPerTick * 7.2).toFixed(1) // converted to ~mph/kmh scale
  }));

  // Add ambulance entity
  const ambulanceData = {
    id: ambulance.id,
    lng: ambulance.position ? Number(ambulance.position[0].toFixed(6)) : 0,
    lat: ambulance.position ? Number(ambulance.position[1].toFixed(6)) : 0,
    isAmbulance: true,
    speed: (ambulance.speedPerTick * 7.2).toFixed(1),
    destination: ambulance.destination
  };

  vehicleData.push(ambulanceData);

  const ambulancePath = ambulance.getRemainingPath();

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
  simulateTick,
  calculatePollution,
  Vehicle,
  Ambulance,
  vehicles,
  ambulance,
  trafficDensity
};
