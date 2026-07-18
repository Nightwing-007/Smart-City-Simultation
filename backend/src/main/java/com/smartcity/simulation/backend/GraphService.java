package com.smartcity.simulation.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.io.File;
import java.io.IOException;
import java.util.*;

@Service
public class GraphService {

    public static class Node {
        public double lng;
        public double lat;

        public Node(double lng, double lat) {
            this.lng = lng;
            this.lat = lat;
        }

        public String getKey() {
            return lng + "," + lat;
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Node node = (Node) o;
            return Double.compare(node.lng, lng) == 0 && Double.compare(node.lat, lat) == 0;
        }

        @Override
        public int hashCode() {
            return Objects.hash(lng, lat);
        }
    }

    public static class Edge {
        public Node target;
        public double distance;
        public int currentVehicles = 0;

        public Edge(Node target, double distance) {
            this.target = target;
            this.distance = distance;
        }
    }

    private final Map<String, List<Edge>> adjacencyList = new HashMap<>();
    private final List<Node> nodes = new ArrayList<>();
    private final Map<String, Node> nodeMap = new HashMap<>();

    @PostConstruct
    public void init() throws IOException {
        ObjectMapper mapper = new ObjectMapper();
        // Path relative to backend-simulation running dir
        File file = new File("../frontend/src/data/mockRoads.json");
        JsonNode root = mapper.readTree(file);

        JsonNode features = root.path("features");
        for (JsonNode feature : features) {
            if ("LineString".equals(feature.path("geometry").path("type").asText())) {
                JsonNode coordinates = feature.path("geometry").path("coordinates");
                for (int i = 0; i < coordinates.size() - 1; i++) {
                    Node u = new Node(coordinates.get(i).get(0).asDouble(), coordinates.get(i).get(1).asDouble());
                    Node v = new Node(coordinates.get(i+1).get(0).asDouble(), coordinates.get(i+1).get(1).asDouble());
                    addEdge(u, v, getDistance(u, v));
                }
            }
        }
    }

    private void addEdge(Node u, Node v, double dist) {
        nodeMap.putIfAbsent(u.getKey(), u);
        nodeMap.putIfAbsent(v.getKey(), v);

        if (!nodes.contains(nodeMap.get(u.getKey()))) nodes.add(nodeMap.get(u.getKey()));
        if (!nodes.contains(nodeMap.get(v.getKey()))) nodes.add(nodeMap.get(v.getKey()));

        adjacencyList.putIfAbsent(u.getKey(), new ArrayList<>());
        adjacencyList.putIfAbsent(v.getKey(), new ArrayList<>());

        adjacencyList.get(u.getKey()).add(new Edge(nodeMap.get(v.getKey()), dist));
        adjacencyList.get(v.getKey()).add(new Edge(nodeMap.get(u.getKey()), dist));
    }

    public double getDistance(Node c1, Node c2) {
        double R = 6371e3;
        double lat1 = Math.toRadians(c1.lat);
        double lat2 = Math.toRadians(c2.lat);
        double dLat = Math.toRadians(c2.lat - c1.lat);
        double dLng = Math.toRadians(c2.lng - c1.lng);

        double a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng/2) * Math.sin(dLng/2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    }

    public List<Node> getNodes() {
        return nodes;
    }

    public Map<String, List<Edge>> getAdjacencyList() {
        return adjacencyList;
    }

    public Edge getEdge(Node u, Node v) {
        List<Edge> edges = adjacencyList.get(u.getKey());
        if (edges != null) {
            for (Edge e : edges) {
                if (e.target.equals(v)) return e;
            }
        }
        return null;
    }
}
