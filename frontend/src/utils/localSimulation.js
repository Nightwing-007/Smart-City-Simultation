import { SMART_CITY_ROADS } from '../data/smartCityData';

/**
 * Client-Side Standalone Simulation Engine
 * Runs physics, vehicle interpolation, A* routing, and pollution density
 * when Spring Boot WebSocket is unavailable or offline.
 */

// Helper: Haversine distance in meters
function getDistance(p1, p2) {
  const R = 6371e3;
  const lat1 = (p1[1] * Math.PI) / 180;
  const lat2 = (p2[1] * Math.PI) / 180;
  const dLat = ((p2[1] - p1[1]) * Math.PI) / 180;
  const dLng = ((p2[0] - p1[0]) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

export class LocalCitySimulation {
  constructor(roadsGeoJson = SMART_CITY_ROADS) {
    this.roads = roadsGeoJson;
    this.nodes = [];
    this.adjacency = new Map(); // key -> [{ targetKey, targetPos, distance, roadId }]
    this.vehicles = [];
    this.ambulance = null;
    this.closedRoadId = null;
    this.edgeVehicleCounts = new Map();
    this.scenario = "current";

    this.buildGraph();
    this.initFleet();
  }

  setClosedRoad(roadId) {
    this.closedRoadId = roadId;
    if (this.ambulance) {
      this.reRouteAmbulance();
    }
  }

  setScenario(scenario) {
    this.scenario = scenario;
    const targetCount = scenario === 'traffic' ? 80 : scenario === 'future' ? 35 : 50;
    
    // Adjust fleet size
    while (this.vehicles.length < targetCount) {
      const v = this.createVehicle(`v-${this.vehicles.length}`, false);
      this.assignRoute(v, false);
      this.vehicles.push(v);
    }
    if (this.vehicles.length > targetCount) {
      this.vehicles = this.vehicles.slice(0, targetCount);
    }
  }

  buildGraph() {
    this.nodes = [];
    this.adjacency.clear();

    const addNode = (pos) => {
      const key = `${pos[0].toFixed(5)},${pos[1].toFixed(5)}`;
      if (!this.adjacency.has(key)) {
        this.adjacency.set(key, []);
        this.nodes.push({ key, pos });
      }
      return key;
    };

    this.roads.features.forEach((feature) => {
      const coords = feature.geometry.coordinates;
      const roadId = feature.id || feature.properties.name;

      for (let i = 0; i < coords.length - 1; i++) {
        const uPos = coords[i];
        const vPos = coords[i + 1];
        const uKey = addNode(uPos);
        const vKey = addNode(vPos);
        const dist = getDistance(uPos, vPos);

        this.adjacency.get(uKey).push({
          targetKey: vKey,
          targetPos: vPos,
          distance: dist,
          roadId
        });
        this.adjacency.get(vKey).push({
          targetKey: uKey,
          targetPos: uPos,
          distance: dist,
          roadId
        });
      }
    });
  }

  createVehicle(id, isAmbulance) {
    return {
      id,
      isAmbulance,
      speed: isAmbulance ? 0.00015 : (Math.random() * 0.00006 + 0.00004),
      path: [],
      currentEdgeIndex: 0,
      position: [0, 0],
      progress: 0
    };
  }

  initFleet() {
    this.vehicles = [];
    for (let i = 0; i < 50; i++) {
      const v = this.createVehicle(`v-${i}`, false);
      this.assignRoute(v, false);
      this.vehicles.push(v);
    }
    this.ambulance = this.createVehicle('amb-emergency-1', true);
    this.reRouteAmbulance();
  }

  reRouteAmbulance() {
    if (!this.ambulance) return;
    this.assignRoute(this.ambulance, true);
  }

  assignRoute(vehicle, avoidTraffic) {
    if (this.nodes.length < 2) return;
    const startNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    let endNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    while (endNode.key === startNode.key && this.nodes.length > 1) {
      endNode = this.nodes[Math.floor(Math.random() * this.nodes.length)];
    }

    const path = this.findPathAStar(startNode.key, endNode.key, avoidTraffic);
    if (path.length > 0) {
      vehicle.path = path;
      vehicle.currentEdgeIndex = 0;
      vehicle.progress = 0;
      vehicle.position = [...path[0]];
    }
  }

  findPathAStar(startKey, goalKey, avoidTraffic) {
    const openSet = new Set([startKey]);
    const cameFrom = new Map();
    const gScore = new Map();
    const fScore = new Map();

    const getPos = (key) => {
      const parts = key.split(',').map(Number);
      return [parts[0], parts[1]];
    };

    gScore.set(startKey, 0);
    const goalPos = getPos(goalKey);
    fScore.set(startKey, getDistance(getPos(startKey), goalPos));

    while (openSet.size > 0) {
      let currentKey = null;
      let minF = Infinity;
      for (const key of openSet) {
        const score = fScore.get(key) ?? Infinity;
        if (score < minF) {
          minF = score;
          currentKey = key;
        }
      }

      if (currentKey === goalKey) {
        const fullPath = [goalPos];
        let curr = currentKey;
        while (cameFrom.has(curr)) {
          curr = cameFrom.get(curr);
          fullPath.unshift(getPos(curr));
        }
        return fullPath;
      }

      openSet.delete(currentKey);
      const neighbors = this.adjacency.get(currentKey) || [];

      for (const neighbor of neighbors) {
        // Skip closed road
        if (this.closedRoadId && (neighbor.roadId === this.closedRoadId || neighbor.roadId === `road-${this.closedRoadId}`)) {
          continue;
        }

        let weight = neighbor.distance;
        if (avoidTraffic) {
          const edgeCount = this.edgeVehicleCounts.get(`${currentKey}->${neighbor.targetKey}`) || 0;
          weight *= (1 + edgeCount * 3.5); // Heavy congestion avoidance penalty
        }

        const currentG = gScore.get(currentKey) ?? Infinity;
        const tentativeG = currentG + weight;
        const neighborG = gScore.get(neighbor.targetKey) ?? Infinity;

        if (tentativeG < neighborG) {
          cameFrom.set(neighbor.targetKey, currentKey);
          gScore.set(neighbor.targetKey, tentativeG);
          fScore.set(neighbor.targetKey, tentativeG + getDistance(neighbor.targetPos, goalPos));
          openSet.add(neighbor.targetKey);
        }
      }
    }

    // Fallback: direct line if graph search fails
    return [getPos(startKey), goalPos];
  }

  tick() {
    this.edgeVehicleCounts.clear();
    const allVehicles = [...this.vehicles];
    if (this.ambulance) allVehicles.push(this.ambulance);

    const vehicleData = [];
    const pollutionData = [];

    allVehicles.forEach((v) => {
      if (!v.path || v.path.length < 2 || v.currentEdgeIndex >= v.path.length - 1) {
        this.assignRoute(v, v.isAmbulance);
        return;
      }

      const p1 = v.path[v.currentEdgeIndex];
      const p2 = v.path[v.currentEdgeIndex + 1];

      const edgeKey = `${p1[0].toFixed(5)},${p1[1].toFixed(5)}->${p2[0].toFixed(5)},${p2[1].toFixed(5)}`;
      const currentCount = (this.edgeVehicleCounts.get(edgeKey) || 0) + 1;
      this.edgeVehicleCounts.set(edgeKey, currentCount);

      const totalDist = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      if (totalDist > 0) {
        v.progress += v.speed / totalDist;
      } else {
        v.progress = 1;
      }

      if (v.progress >= 1) {
        v.currentEdgeIndex++;
        v.progress = 0;
        if (v.currentEdgeIndex >= v.path.length - 1) {
          this.assignRoute(v, v.isAmbulance);
        } else {
          v.position = [...v.path[v.currentEdgeIndex]];
        }
      } else {
        v.position = [
          p1[0] + (p2[0] - p1[0]) * v.progress,
          p1[1] + (p2[1] - p1[1]) * v.progress
        ];
      }

      vehicleData.push({
        id: v.id,
        lng: v.position[0],
        lat: v.position[1],
        isAmbulance: v.isAmbulance,
        speed: (v.speed * 250000).toFixed(1)
      });
    });

    // Generate dynamic pollution nodes based on density
    this.edgeVehicleCounts.forEach((count, key) => {
      if (count >= 2) {
        const parts = key.split('->')[0].split(',').map(Number);
        const multiplier = this.scenario === 'traffic' ? 25 : 12;
        pollutionData.push({
          lng: parts[0],
          lat: parts[1],
          weight: Math.min(100, count * multiplier)
        });
      }
    });

    // Extract ambulance path for visualization
    const ambulancePath = this.ambulance && this.ambulance.path ? this.ambulance.path.slice(this.ambulance.currentEdgeIndex) : [];

    return {
      vehicles: vehicleData,
      pollution: pollutionData,
      ambulancePath: ambulancePath.length > 0 ? [[this.ambulance.position[0], this.ambulance.position[1]], ...ambulancePath] : []
    };
  }
}
