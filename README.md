
這是一個非常好的消息！你在 browser 看到的這串 XML 錯誤訊息 (`InvalidQueryParameterValue`)，**其實代表你成功連上 Azurite 了。**

這不是防火牆的阻擋頁面，而是 Azurite 本身回傳的標準 Azure API 錯誤訊息。因為 browser 只是單純對 `127.0.0.1:10000` 發送了一個 GET 請求，沒有帶上 Azure 所需的 API 參數和驗證標頭，所以 Azurite 拒絕了這個「不合規的 API 呼叫」，但**連線本身是完全暢通的**。

### 為什麼 Browser 可以，但 VS Code 和 Python 不行？

這在大型企業或金融機構的網路環境中非常典型。Browser（Chrome/Edge）非常聰明，它們會完美解析系統的 Proxy Auto-Config (PAC) 檔案或 Windows 的 Proxy Bypass 規則，知道遇到 `127.0.0.1` 就要直接連線，不要經過 Proxy。

但是，VS Code 的擴充套件（底層是 Node.js）以及 Python 的 `requests` 模組，通常比較「笨」。它們往往會忽略系統的 Bypass 規則，直接把所有流量都往環境變數設定的 Proxy Server 塞，結果就是被公司的 Proxy 攔截並回傳 Access Denied。

### 解決方案：在 Python 中強制繞過 Proxy

既然確定 `127.0.0.1:10000` 是活著的，我們只需要在 Python 程式碼中，明確指示 Azure SDK **不要使用任何 Proxy**。

請更新你的 Python 測試程式碼，我們在建立 `BlobServiceClient` 時，直接傳入一個空的 proxy 設定來強制覆蓋環境變數：

```python
import os
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceNotFoundError

# Local Azurite connection string
CONNECTION_STRING = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"
CONTAINER_NAME = "local-test-container"

def test_local_connection():
    try:
        print("Connecting to local Azurite...")
        
        # Force the SDK to bypass all proxies
        proxies_config = {
            "http": None,
            "https": None
        }

        # Pass the proxies_config into the client
        blob_service_client = BlobServiceClient.from_connection_string(
            CONNECTION_STRING,
            proxies=proxies_config
        )
        
        container_client = blob_service_client.get_container_client(CONTAINER_NAME)
        try:
            container_client.get_container_properties()
            print(f"Container '{CONTAINER_NAME}' already exists.")
        except ResourceNotFoundError:
            container_client.create_container()
            print(f"Container '{CONTAINER_NAME}' created successfully.")
            
        print("Connection successful.")
        
    except Exception as e:
        print(f"Connection failed: {e}")

if __name__ == "__main__":
    test_local_connection()
```

至於圖形化介面的部分，既然你的 browser 可以正確繞過 Proxy，**獨立的桌面版 Azure Storage Explorer** 大機率也能直接運作（因為它預設會繼承系統的 proxy 設定）。

你想先測試這段加上 `proxies_config` 的 Python 程式碼，看看 application logic 能不能順利跑通嗎？
