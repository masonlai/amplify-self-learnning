// (D) downstreamService (來自 YAML)
        regressionNode.put("downstreamService", config.getTestConfig().getDownstreamService());

        // (E) expectedDataLoader
        ObjectNode expectedDataLoader = objectMapper.createObjectNode();
        ArrayNode filePaths = objectMapper.createArrayNode();
        // 這裡可以根據需要帶入變數，目前按照截圖寫死路徑模板
        filePaths.add("{{storage-path}}/broadridge-position/baseline.json");
        expectedDataLoader.set("filePaths", filePaths);
        regressionNode.set("expectedDataLoader", expectedDataLoader);

        // (F) actualDataLoader (處理多個 requests)
        ObjectNode actualDataLoader = objectMapper.createObjectNode();
        ArrayNode requestsArray = objectMapper.createArrayNode();

        if (config.getTestConfig().getRequests() != null) {
            for (RunBroadridgePosConfig.RequestConfig reqConfig : config.getTestConfig().getRequests()) {
                ObjectNode reqNode = objectMapper.createObjectNode();
                reqNode.put("method", reqConfig.getMethod());
                reqNode.put("path", reqConfig.getPath());
                
                // 處理 queryParams
                if (reqConfig.getQueryParams() != null) {
                    ObjectNode qParams = objectMapper.createObjectNode();
                    reqConfig.getQueryParams().forEach(qParams::put);
                    reqNode.set("queryParams", qParams);
                }
                requestsArray.add(reqNode);
            }
        }
        actualDataLoader.set("requests", requestsArray);
        regressionNode.set("actualDataLoader", actualDataLoader);
