private String extractIdsFromBaseline(String filePath) {
    try {
        Path path = Paths.get(filePath);
        if (!Files.exists(path)) {
            // Log warning if file not found
            return "";
        }

        JsonNode rootNode = objectMapper.readTree(Files.readAllBytes(path));
        
        // Ensure the root is an array as per the requirement [obj, obj, obj]
        if (rootNode != null && rootNode.isArray()) {
            List<String> idList = new ArrayList<>();
            for (JsonNode node : rootNode) {
                if (node.has("id")) {
                    idList.add(node.get("id").asText());
                }
            }
            return String.join(",", idList);
        }
    } catch (IOException e) {
        // Log the actual error in a real production environment
        return "";
    }
    return "";
}
