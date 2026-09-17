package com.smartcity.simulation.backend;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import jakarta.annotation.PostConstruct;

import java.util.*;

@Service
public class GraphService {

    @Autowired
    private JdbcTemplate jdbcTemplate;

    public static class Node {
        public double lng;
        public double lat;

        public Node(double lng, double lat) {
            this.lng = lng;
            this.lat = lat;
        }

        public String getKey() {
            return String.format(Locale.US, "%.6f,%.6f", lng, lat);
        }

        @Override
        public boolean equals(Object o) {
            if (this == o) return true;
            if (o == null || getClass() != o.getClass()) return false;
            Node node = (Node) o;
            return Math.abs(node.lng - lng) < 1e-6 && Math.abs(node.lat - lat) < 1e-6;
        }

        @Override
        public int hashCode() {
            return Objects.hash(Math.round(lng * 1e5), Math.round(lat * 1e5));
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
    public void init() {
        reloadGraph();
    }

    public synchronized void reloadGraph() {
        System.out.println("[GraphService] Querying spatial road network from PostGIS database...");
        
        // Transforms PostGIS Web Mercator (EPSG:3857) to standard WGS84 Lat/Lng (EPSG:4326)
        String query = "SELECT ST_AsGeoJSON(ST_Transform(way, 4326)) AS geojson, name, highway " +
                       "FROM planet_osm_line " +
                       "WHERE highway IS NOT NULL LIMIT 10000";
        
        try {
            List<Map<String, Object>> rows = jdbcTemplate.queryForList(query);
            ObjectMapper mapper = new ObjectMapper();

            nodes.clear();
            nodeMap.clear();
            adjacencyList.clear();

            for (Map<String, Object> row : rows) {
                String geojsonStr = (String) row.get("geojson");
                if (geojsonStr == null) continue;

                JsonNode geometry = mapper.readTree(geojsonStr);
                if ("LineString".equalsIgnoreCase(geometry.path("type").asText())) {
                    JsonNode coordinates = geometry.path("coordinates");
                    for (int i = 0; i < coordinates.size() - 1; i++) {
                        Node u = new Node(coordinates.get(i).get(0).asDouble(), coordinates.get(i).get(1).asDouble());
                        Node v = new Node(coordinates.get(i + 1).get(0).asDouble(), coordinates.get(i + 1).get(1).asDouble());
                        addEdge(u, v, getDistance(u, v));
                    }
                }
            }

            if (nodes.isEmpty()) {
                System.out.println("[GraphService] Notice: PostGIS table planet_osm_line is currently empty.");
                System.out.println("[GraphService] Run ./ingest.sh to populate real OpenStreetMap spatial road data.");
            } else {
                System.out.println("[GraphService] Spatial Graph successfully loaded from PostGIS. Total Nodes: " + nodes.size() + ", Edges: " + adjacencyList.size());
            }
        } catch (Exception e) {
            System.err.println("[GraphService] Could not connect to PostGIS or table not yet created: " + e.getMessage());
            System.err.println("[GraphService] Please run ./ingest.sh to ingest OSM data into the 'db' container.");
        }
    }

    private void addEdge(Node u, Node v, double dist) {
        nodeMap.putIfAbsent(u.getKey(), u);
        nodeMap.putIfAbsent(v.getKey(), v);

        Node nodeU = nodeMap.get(u.getKey());
        Node nodeV = nodeMap.get(v.getKey());

        if (!nodes.contains(nodeU)) nodes.add(nodeU);
        if (!nodes.contains(nodeV)) nodes.add(nodeV);

        adjacencyList.putIfAbsent(nodeU.getKey(), new ArrayList<>());
        adjacencyList.putIfAbsent(nodeV.getKey(), new ArrayList<>());

        adjacencyList.get(nodeU.getKey()).add(new Edge(nodeV, dist));
        adjacencyList.get(nodeV.getKey()).add(new Edge(nodeU, dist));
    }

    public double getDistance(Node c1, Node c2) {
        double R = 6371e3; // Earth radius in meters
        double lat1 = Math.toRadians(c1.lat);
        double lat2 = Math.toRadians(c2.lat);
        double dLat = Math.toRadians(c2.lat - c1.lat);
        double dLng = Math.toRadians(c2.lng - c1.lng);

        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1) * Math.cos(lat2) *
                Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
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
