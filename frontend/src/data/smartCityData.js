/**
 * Smart City Digital Twin - Enriched Spatial Data & Scenario Configurations
 * Center: Midtown Manhattan, NYC (40.7580, -73.9855)
 */

export const SMART_CITY_ROADS = {
  type: "FeatureCollection",
  features: [
    // Avenues (North-South)
    {
      type: "Feature",
      id: "road-8th-ave",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9905, 40.7530],
          [-73.9890, 40.7565],
          [-73.9875, 40.7600],
          [-73.9860, 40.7635],
          [-73.9845, 40.7670]
        ]
      },
      properties: {
        id: "road-8th-ave",
        name: "8th Avenue (Arterial North)",
        highway: "primary",
        lanes: 4,
        speedLimit: 30,
        color: [79, 172, 254],
        baseCongestion: 1.2
      }
    },
    {
      type: "Feature",
      id: "road-broadway",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9880, 40.7535],
          [-73.9865, 40.7560],
          [-73.9851, 40.7589],
          [-73.9835, 40.7620],
          [-73.9818, 40.7655]
        ]
      },
      properties: {
        id: "road-broadway",
        name: "Broadway Boulevard",
        highway: "primary",
        lanes: 3,
        speedLimit: 25,
        color: [0, 242, 254],
        baseCongestion: 1.5
      }
    },
    {
      type: "Feature",
      id: "road-7th-ave",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9870, 40.7525],
          [-73.9855, 40.7560],
          [-73.9840, 40.7595],
          [-73.9825, 40.7630],
          [-73.9810, 40.7665]
        ]
      },
      properties: {
        id: "road-7th-ave",
        name: "7th Avenue (Fashion Ave)",
        highway: "primary",
        lanes: 4,
        speedLimit: 30,
        color: [79, 172, 254],
        baseCongestion: 1.4
      }
    },
    {
      type: "Feature",
      id: "road-6th-ave",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9835, 40.7515],
          [-73.9820, 40.7550],
          [-73.9805, 40.7585],
          [-73.9790, 40.7620],
          [-73.9775, 40.7655]
        ]
      },
      properties: {
        id: "road-6th-ave",
        name: "Avenue of the Americas (6th Ave)",
        highway: "primary",
        lanes: 4,
        speedLimit: 30,
        color: [79, 172, 254],
        baseCongestion: 1.3
      }
    },
    {
      type: "Feature",
      id: "road-5th-ave",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9800, 40.7505],
          [-73.9785, 40.7540],
          [-73.9770, 40.7575],
          [-73.9755, 40.7610],
          [-73.9740, 40.7645]
        ]
      },
      properties: {
        id: "road-5th-ave",
        name: "5th Avenue (Prestige Corridor)",
        highway: "primary",
        lanes: 4,
        speedLimit: 25,
        color: [0, 242, 254],
        baseCongestion: 1.6
      }
    },
    {
      type: "Feature",
      id: "road-park-ave",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9765, 40.7495],
          [-73.9750, 40.7530],
          [-73.9735, 40.7565],
          [-73.9720, 40.7600],
          [-73.9705, 40.7635]
        ]
      },
      properties: {
        id: "road-park-ave",
        name: "Park Avenue Expressway",
        highway: "trunk",
        lanes: 6,
        speedLimit: 35,
        color: [64, 150, 255],
        baseCongestion: 1.1
      }
    },

    // Cross Streets (East-West)
    {
      type: "Feature",
      id: "road-40th-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9915, 40.7545],
          [-73.9865, 40.7530],
          [-73.9815, 40.7515],
          [-73.9765, 40.7500],
          [-73.9715, 40.7485]
        ]
      },
      properties: {
        id: "road-40th-st",
        name: "W 40th Street",
        highway: "secondary",
        lanes: 2,
        speedLimit: 20,
        color: [140, 190, 255],
        baseCongestion: 0.9
      }
    },
    {
      type: "Feature",
      id: "road-42nd-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9930, 40.7570],
          [-73.9875, 40.7555],
          [-73.9825, 40.7540],
          [-73.9775, 40.7525],
          [-73.9725, 40.7510]
        ]
      },
      properties: {
        id: "road-42nd-st",
        name: "42nd Street (Transit Hub / Times Sq)",
        highway: "primary",
        lanes: 4,
        speedLimit: 25,
        color: [255, 100, 150],
        baseCongestion: 1.8
      }
    },
    {
      type: "Feature",
      id: "road-44th-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9910, 40.7590],
          [-73.9855, 40.7575],
          [-73.9805, 40.7560],
          [-73.9755, 40.7545],
          [-73.9705, 40.7530]
        ]
      },
      properties: {
        id: "road-44th-st",
        name: "W 44th Street (Theatre District)",
        highway: "secondary",
        lanes: 2,
        speedLimit: 20,
        color: [140, 190, 255],
        baseCongestion: 1.1
      }
    },
    {
      type: "Feature",
      id: "road-46th-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9890, 40.7610],
          [-73.9835, 40.7595],
          [-73.9785, 40.7580],
          [-73.9735, 40.7565],
          [-73.9685, 40.7550]
        ]
      },
      properties: {
        id: "road-46th-st",
        name: "W 46th Street (Restaurant Row)",
        highway: "tertiary",
        lanes: 2,
        speedLimit: 20,
        color: [180, 150, 255],
        baseCongestion: 1.0
      }
    },
    {
      type: "Feature",
      id: "road-48th-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9870, 40.7630],
          [-73.9815, 40.7615],
          [-73.9765, 40.7600],
          [-73.9715, 40.7585],
          [-73.9665, 40.7570]
        ]
      },
      properties: {
        id: "road-48th-st",
        name: "W 48th Street (Rockefeller Plaza)",
        highway: "secondary",
        lanes: 2,
        speedLimit: 20,
        color: [140, 190, 255],
        baseCongestion: 1.2
      }
    },
    {
      type: "Feature",
      id: "road-50th-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9850, 40.7650],
          [-73.9795, 40.7635],
          [-73.9745, 40.7620],
          [-73.9695, 40.7605],
          [-73.9645, 40.7590]
        ]
      },
      properties: {
        id: "road-50th-st",
        name: "W 50th Street (Radio City Concourse)",
        highway: "primary",
        lanes: 3,
        speedLimit: 25,
        color: [79, 172, 254],
        baseCongestion: 1.3
      }
    },
    {
      type: "Feature",
      id: "road-52nd-st",
      geometry: {
        type: "LineString",
        coordinates: [
          [-73.9830, 40.7670],
          [-73.9775, 40.7655],
          [-73.9725, 40.7640],
          [-73.9675, 40.7625],
          [-73.9625, 40.7610]
        ]
      },
      properties: {
        id: "road-52nd-st",
        name: "W 52nd Street (Jazz Corridor)",
        highway: "tertiary",
        lanes: 2,
        speedLimit: 20,
        color: [180, 150, 255],
        baseCongestion: 0.8
      }
    }
  ]
};

// 2030 Master Plan: Autonomous Rapid Transit, Drone Sky-Corridors & Eco-Greenways
export const MASTER_PLAN_2030 = {
  transitCorridors: [
    {
      id: "hyper-loop-1",
      name: "Autonomous High-Speed Loop A",
      type: "hyperloop",
      path: [
        [-73.9930, 40.7570],
        [-73.9851, 40.7589],
        [-73.9770, 40.7575],
        [-73.9705, 40.7635],
        [-73.9818, 40.7655],
        [-73.9905, 40.7530]
      ],
      color: [168, 85, 247, 220],
      width: 6
    },
    {
      id: "eco-greenway-broadway",
      name: "Broadway Zero-Emission Green Promenade",
      type: "greenway",
      path: [
        [-73.9880, 40.7535],
        [-73.9865, 40.7560],
        [-73.9851, 40.7589],
        [-73.9835, 40.7620],
        [-73.9818, 40.7655]
      ],
      color: [16, 185, 129, 230],
      width: 8
    },
    {
      id: "drone-express-skyway",
      name: "Skyway Logistics Drone Lane (Elevated 80m)",
      type: "drone_skyway",
      path: [
        [-73.9915, 40.7545],
        [-73.9815, 40.7515],
        [-73.9740, 40.7645],
        [-73.9845, 40.7670]
      ],
      color: [244, 63, 94, 200],
      width: 4
    }
  ],
  smartPoles: [
    { id: "pole-1", name: "Times Square 5G Multi-Sensor Tower", coordinates: [-73.9851, 40.7589], type: "sensor_hub" },
    { id: "pole-2", name: "Grand Central Air Quality LiDAR", coordinates: [-73.9775, 40.7525], type: "sensor_hub" },
    { id: "pole-3", name: "Rockefeller Autonomous Transit Dock", coordinates: [-73.9785, 40.7580], type: "ev_hub" },
    { id: "pole-4", name: "Columbus South Drone Landing Pad", coordinates: [-73.9818, 40.7655], type: "drone_pad" }
  ]
};

// Energy Grid & Smart Utilities: Micro-grids, Sub-stations, and EV Fast Chargers
export const ENERGY_GRID_DATA = {
  substations: [
    {
      id: "sub-1",
      name: "Midtown Core Substation (138kV)",
      coordinates: [-73.9825, 40.7540],
      capacityMW: 450,
      loadPercentage: 74,
      status: "optimal",
      color: [59, 130, 246]
    },
    {
      id: "sub-2",
      name: "Hudson Yard Edge Grid Substation",
      coordinates: [-73.9915, 40.7545],
      capacityMW: 380,
      loadPercentage: 88,
      status: "high_demand",
      color: [245, 158, 11]
    },
    {
      id: "sub-3",
      name: "Plaza District Smart Substation",
      coordinates: [-73.9740, 40.7645],
      capacityMW: 520,
      loadPercentage: 62,
      status: "optimal",
      color: [16, 185, 129]
    },
    {
      id: "sub-4",
      name: "Bryant Park Solar Energy Storage Hub",
      coordinates: [-73.9835, 40.7535],
      capacityMW: 210,
      loadPercentage: 45,
      status: "charging",
      color: [147, 51, 234]
    }
  ],
  evChargers: [
    { id: "ev-1", name: "42nd St Mega-Watt EV Fleet Depot", coordinates: [-73.9875, 40.7555], ports: 24, available: 6 },
    { id: "ev-2", name: "7th Ave Rapid Supercharger Hub", coordinates: [-73.9840, 40.7595], ports: 16, available: 3 },
    { id: "ev-3", name: "Park Ave Executive EV Station", coordinates: [-73.9735, 40.7565], ports: 12, available: 8 },
    { id: "ev-4", name: "50th St Radio City Charger Vault", coordinates: [-73.9795, 40.7635], ports: 20, available: 11 },
    { id: "ev-5", name: "8th Ave Urban Transit Chargers", coordinates: [-73.9875, 40.7600], ports: 18, available: 5 }
  ],
  powerLines: [
    {
      from: [-73.9825, 40.7540],
      to: [-73.9915, 40.7545],
      voltage: "138kV Transmission",
      color: [59, 130, 246, 200]
    },
    {
      from: [-73.9825, 40.7540],
      to: [-73.9740, 40.7645],
      voltage: "138kV Backbone Line",
      color: [59, 130, 246, 200]
    },
    {
      from: [-73.9835, 40.7535],
      to: [-73.9825, 40.7540],
      voltage: "Renewable Solar Feed",
      color: [147, 51, 234, 220]
    },
    {
      from: [-73.9740, 40.7645],
      to: [-73.9795, 40.7635],
      voltage: "Plaza Distribution Ring",
      color: [16, 185, 129, 200]
    }
  ]
};

// Scenario Definitions & Preset Configurations
export const SCENARIO_CONFIGS = {
  current: {
    id: "current",
    title: "Current Infrastructure",
    subtitle: "Baseline Live City Spatial Twin",
    badge: "LIVE TWIN",
    badgeColor: "#3b82f6",
    description: "Real-time monitoring of existing street grid, vehicle fleet density, and baseline air quality.",
    camera: {
      longitude: -73.9835,
      latitude: 40.7585,
      zoom: 14.5,
      pitch: 45,
      bearing: -15
    },
    layerDefaults: {
      roads: true,
      vehicles: true,
      heatmap: true,
      masterPlan: false,
      energyGrid: false,
      emergencyPath: true
    },
    kpis: {
      fleetSpeed: "22.4 mph",
      trafficCongestion: "Moderate (42%)",
      aqi: "48 - Good",
      activeSensors: "1,240 Nodes"
    }
  },
  future: {
    id: "future",
    title: "2030 Master Plan",
    subtitle: "Future Smart Grid & Hyper-Transit",
    badge: "VISION 2030",
    badgeColor: "#10b981",
    description: "Autonomous hyperloop transit corridors, zero-emission greenways, and aerial drone delivery skyways.",
    camera: {
      longitude: -73.9820,
      latitude: 40.7590,
      zoom: 15.0,
      pitch: 55,
      bearing: -25
    },
    layerDefaults: {
      roads: true,
      vehicles: true,
      heatmap: false,
      masterPlan: true,
      energyGrid: false,
      emergencyPath: true
    },
    kpis: {
      fleetSpeed: "34.8 mph (+55%)",
      trafficCongestion: "Optimized (18%)",
      aqi: "19 - Pristine",
      activeSensors: "3,890 Nodes"
    }
  },
  traffic: {
    id: "traffic",
    title: "Peak Traffic Simulation",
    subtitle: "Rush-Hour Choke Point Modeling",
    badge: "CONGESTION SIM",
    badgeColor: "#f59e0b",
    description: "Stress-testing intersection capacities during peak rush-hour gridlock and high emission zones.",
    camera: {
      longitude: -73.9851,
      latitude: 40.7580,
      zoom: 15.2,
      pitch: 50,
      bearing: 10
    },
    layerDefaults: {
      roads: true,
      vehicles: true,
      heatmap: true,
      masterPlan: false,
      energyGrid: false,
      emergencyPath: true
    },
    kpis: {
      fleetSpeed: "11.2 mph (-50%)",
      trafficCongestion: "Severe (88%)",
      aqi: "118 - Sensitive",
      activeSensors: "1,240 Nodes"
    }
  },
  energy: {
    id: "energy",
    title: "Energy Grid & Smart Utilities",
    subtitle: "IoT Power & EV Charging Network",
    badge: "ENERGY GRID",
    badgeColor: "#8b5cf6",
    description: "Real-time substation telemetry, high-voltage transmission backbones, and EV fleet charging hubs.",
    camera: {
      longitude: -73.9800,
      latitude: 40.7570,
      zoom: 14.8,
      pitch: 40,
      bearing: -5
    },
    layerDefaults: {
      roads: true,
      vehicles: false,
      heatmap: false,
      masterPlan: false,
      energyGrid: true,
      emergencyPath: false
    },
    kpis: {
      fleetSpeed: "--",
      trafficCongestion: "Normal (34%)",
      aqi: "32 - Good",
      activeSensors: "2,150 Smart Meters"
    }
  },
  emergency: {
    id: "emergency",
    title: "Emergency Response Priority",
    subtitle: "Intelligent A* Dynamic Routing",
    badge: "EMERGENCY DISPATCH",
    badgeColor: "#ef4444",
    description: "Prioritizing emergency ambulance dispatch, dynamically calculating fastest clear corridors around bottlenecks.",
    camera: {
      longitude: -73.9851,
      latitude: 40.7589,
      zoom: 16.0,
      pitch: 60,
      bearing: 30
    },
    layerDefaults: {
      roads: true,
      vehicles: true,
      heatmap: true,
      masterPlan: false,
      energyGrid: false,
      emergencyPath: true
    },
    kpis: {
      fleetSpeed: "42.5 mph (Priority)",
      trafficCongestion: "Active Reroute",
      aqi: "54 - Moderate",
      activeSensors: "Dispatch Active"
    }
  }
};
