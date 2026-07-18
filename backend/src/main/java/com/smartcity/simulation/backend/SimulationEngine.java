package com.smartcity.simulation.backend;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import jakarta.annotation.PostConstruct;
import java.util.*;

@Component
public class SimulationEngine {

    @Autowired
    private GraphService graphService;

    @Autowired
    private SimulationHandler simulationHandler;

    private final ObjectMapper mapper = new ObjectMapper();

    private List<Vehicle> vehicles = new ArrayList<>();
    private Ambulance ambulance;

    static class Vehicle {
        String id;
        double speedPerTick;
        List<GraphService.Node> path = new ArrayList<>();
        int currentEdgeIndex = 0;
        double[] position;
        boolean isAmbulance;

        public Vehicle(String id, boolean isAmbulance) {
            this.id = id;
            this.isAmbulance = isAmbulance;
            this.speedPerTick = isAmbulance ? 5.0 : Math.random() * 2 + 2; // Ambulance is faster
        }
    }

    static class Ambulance extends Vehicle {
        public Ambulance(String id) {
            super(id, true);
        }
    }

    @PostConstruct
    public void init() {
        for (int i = 0; i < 50; i++) {
            Vehicle v = new Vehicle("v-" + i, false);
            assignNewRoute(v, false);
            vehicles.add(v);
        }
        ambulance = new Ambulance("amb-1");
        assignNewRoute(ambulance, true);
    }

    private void assignNewRoute(Vehicle v, boolean avoidTraffic) {
        List<GraphService.Node> nodes = graphService.getNodes();
        if (nodes.isEmpty()) return;

        GraphService.Node start = nodes.get(new Random().nextInt(nodes.size()));
        GraphService.Node end = nodes.get(new Random().nextInt(nodes.size()));
        while (start.equals(end) && nodes.size() > 1) {
            end = nodes.get(new Random().nextInt(nodes.size()));
        }

        v.path = aStar(start, end, avoidTraffic);
        v.currentEdgeIndex = 0;
        if (!v.path.isEmpty()) {
            v.position = new double[]{v.path.get(0).lng, v.path.get(0).lat};
        }
    }

    private List<GraphService.Node> aStar(GraphService.Node start, GraphService.Node goal, boolean avoidTraffic) {
        Set<GraphService.Node> openSet = new HashSet<>();
        openSet.add(start);
        Map<GraphService.Node, GraphService.Node> cameFrom = new HashMap<>();

        Map<GraphService.Node, Double> gScore = new HashMap<>();
        gScore.put(start, 0.0);

        Map<GraphService.Node, Double> fScore = new HashMap<>();
        fScore.put(start, graphService.getDistance(start, goal));

        while (!openSet.isEmpty()) {
            GraphService.Node current = null;
            double minF = Double.POSITIVE_INFINITY;
            for (GraphService.Node node : openSet) {
                double score = fScore.getOrDefault(node, Double.POSITIVE_INFINITY);
                if (score < minF) {
                    minF = score;
                    current = node;
                }
            }

            if (current != null && current.equals(goal)) {
                List<GraphService.Node> path = new ArrayList<>();
                path.add(goal);
                GraphService.Node curr = current;
                while (cameFrom.containsKey(curr)) {
                    curr = cameFrom.get(curr);
                    path.add(0, curr);
                }
                return path;
            }

            openSet.remove(current);

            List<GraphService.Edge> neighbors = graphService.getAdjacencyList().getOrDefault(current.getKey(), new ArrayList<>());
            for (GraphService.Edge edge : neighbors) {
                GraphService.Node neighbor = edge.target;
                
                // Dynamic weight: distance * (1 + densityPenalty)
                double weight = edge.distance;
                if (avoidTraffic) {
                    weight *= (1 + (edge.currentVehicles * 0.5)); // Heavy penalty for traffic
                }

                double tentativeGScore = gScore.getOrDefault(current, Double.POSITIVE_INFINITY) + weight;

                if (tentativeGScore < gScore.getOrDefault(neighbor, Double.POSITIVE_INFINITY)) {
                    cameFrom.put(neighbor, current);
                    gScore.put(neighbor, tentativeGScore);
                    fScore.put(neighbor, tentativeGScore + graphService.getDistance(neighbor, goal));
                    openSet.add(neighbor);
                }
            }
        }
        return new ArrayList<>();
    }

    @Scheduled(fixedRate = 100)
    public void tick() {
        if (graphService.getNodes().isEmpty()) return;

        // Reset edge counts
        for (List<GraphService.Edge> edges : graphService.getAdjacencyList().values()) {
            for (GraphService.Edge edge : edges) {
                edge.currentVehicles = 0;
            }
        }

        List<Vehicle> allVehicles = new ArrayList<>(vehicles);
        allVehicles.add(ambulance);

        List<Map<String, Object>> vehicleData = new ArrayList<>();
        List<Map<String, Object>> pollutionData = new ArrayList<>();

        for (Vehicle v : allVehicles) {
            if (v.path.size() <= 1 || v.currentEdgeIndex >= v.path.size() - 1) {
                assignNewRoute(v, v.isAmbulance);
                continue;
            }

            GraphService.Node p1 = v.path.get(v.currentEdgeIndex);
            GraphService.Node p2 = v.path.get(v.currentEdgeIndex + 1);

            // Add to density
            GraphService.Edge edge = graphService.getEdge(p1, p2);
            if (edge != null) {
                edge.currentVehicles++;
            }

            double dist = graphService.getDistance(new GraphService.Node(v.position[0], v.position[1]), p2);

            if (dist <= v.speedPerTick) {
                v.position = new double[]{p2.lng, p2.lat};
                v.currentEdgeIndex++;
            } else {
                double ratio = v.speedPerTick / dist;
                v.position[0] += (p2.lng - v.position[0]) * ratio;
                v.position[1] += (p2.lat - v.position[1]) * ratio;
            }

            Map<String, Object> vd = new HashMap<>();
            vd.put("id", v.id);
            vd.put("lng", v.position[0]);
            vd.put("lat", v.position[1]);
            vd.put("isAmbulance", v.isAmbulance);
            vehicleData.add(vd);
        }

        // Calculate pollution hotspots (edges with > 1 vehicle)
        for (List<GraphService.Edge> edges : graphService.getAdjacencyList().values()) {
            for (GraphService.Edge edge : edges) {
                if (edge.currentVehicles > 1) {
                    Map<String, Object> p = new HashMap<>();
                    p.put("lng", edge.target.lng);
                    p.put("lat", edge.target.lat);
                    p.put("weight", edge.currentVehicles * 10); // pollution index
                    pollutionData.add(p);
                }
            }
        }

        Map<String, Object> payload = new HashMap<>();
        payload.put("vehicles", vehicleData);
        payload.put("pollution", pollutionData);

        try {
            simulationHandler.broadcast(mapper.writeValueAsString(payload));
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
