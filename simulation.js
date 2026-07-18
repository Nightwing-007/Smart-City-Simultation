const { buildGraph, aStar, getDistance } = require('./graphUtils');

const { adjacencyList, nodes } = buildGraph();

class Vehicle {
  constructor(id) {
    this.id = id;
    // Speed: ~10-20 units. Since tick is 100ms (10 times/sec)
    // 20 m/s is 72 km/h. Let's make speedPerTick 2-4 meters per tick.
    this.speedPerTick = Math.random() * 2 + 2; 
    this.path = [];
    this.currentEdgeIndex = 0;
    this.position = null;
    this.assignNewRoute();
  }

  assignNewRoute() {
    const startNode = nodes[Math.floor(Math.random() * nodes.length)];
    let endNode = nodes[Math.floor(Math.random() * nodes.length)];
    while(startNode.join(',') === endNode.join(',') && nodes.length > 1) {
      endNode = nodes[Math.floor(Math.random() * nodes.length)];
    }
    
    this.path = aStar(startNode, endNode, adjacencyList);
    this.currentEdgeIndex = 0;
    if (this.path.length > 0) {
      this.position = [...this.path[0]];
    }
  }

  tick() {
    if (this.path.length <= 1 || this.currentEdgeIndex >= this.path.length - 1) {
      this.assignNewRoute();
      return;
    }

    let p1 = this.path[this.currentEdgeIndex];
    let p2 = this.path[this.currentEdgeIndex + 1];

    const dist = getDistance(this.position, p2);
    
    if (dist <= this.speedPerTick) {
      // Reached the next node
      this.position = [...p2];
      this.currentEdgeIndex++;
    } else {
      // Interpolate along the edge
      const ratio = this.speedPerTick / dist;
      this.position[0] += (p2[0] - this.position[0]) * ratio;
      this.position[1] += (p2[1] - this.position[1]) * ratio;
    }
  }
}

const vehicles = Array.from({ length: 50 }, (_, i) => new Vehicle(i));

function simulateTick() {
  vehicles.forEach(v => v.tick());
  return vehicles.map(v => ({
    id: v.id,
    lng: v.position[0],
    lat: v.position[1]
  }));
}

module.exports = { simulateTick };
