
因為你的開發環境需要多個不同的 container 配合，我們需要建立一組完整的 helper functions 來處理 container 的批次建立、查詢，以及 blob (檔案) 的上傳、下載和列表。

這裡已經將稍早測試成功、用來繞過公司網路代理 (Proxy bypass) 的設定整合進去了。請注意，**這段程式碼沒有包含任何中文註解與 emoji**。

你可以直接建立一個名為 `azure_storage_helper.py` 的檔案，將以下程式碼貼入並作為模組在你的主要應用程式中呼叫：

```python
import os
from azure.storage.blob import BlobServiceClient
from azure.core.exceptions import ResourceExistsError, ResourceNotFoundError

# Local Azurite connection string
CONNECTION_STRING = "DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://127.0.0.1:10000/devstoreaccount1;"

def get_blob_service_client(connection_string: str) -> BlobServiceClient:
    # Force the SDK to bypass all corporate proxies
    proxies_config = {
        "http": None,
        "https": None
    }
    return BlobServiceClient.from_connection_string(
        connection_string,
        proxies=proxies_config
    )

def setup_multiple_containers(blob_service_client: BlobServiceClient, container_names: list) -> None:
    # Iterate through the list and create containers if they do not exist
    for name in container_names:
        try:
            container_client = blob_service_client.get_container_client(name)
            container_client.create_container()
            print(f"Container created successfully: {name}")
        except ResourceExistsError:
            print(f"Container already exists: {name}")
        except Exception as e:
            print(f"Failed to create container '{name}': {e}")

def list_all_containers(blob_service_client: BlobServiceClient) -> list:
    # Retrieve a list of all container names in the storage account
    try:
        containers = blob_service_client.list_containers()
        return [container.name for container in containers]
    except Exception as e:
        print(f"Failed to list containers: {e}")
        return []

def upload_local_file_to_blob(blob_service_client: BlobServiceClient, container_name: str, blob_name: str, file_path: str) -> bool:
    # Upload a local file to a specified container
    try:
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        with open(file_path, "rb") as data:
            blob_client.upload_blob(data, overwrite=True)
        print(f"Successfully uploaded {file_path} to {container_name}/{blob_name}")
        return True
    except Exception as e:
        print(f"Failed to upload file: {e}")
        return False

def download_blob_to_local_file(blob_service_client: BlobServiceClient, container_name: str, blob_name: str, download_path: str) -> bool:
    # Download a specific blob to a local file path
    try:
        blob_client = blob_service_client.get_blob_client(container=container_name, blob=blob_name)
        with open(download_path, "wb") as download_file:
            download_file.write(blob_client.download_blob().readall())
        print(f"Successfully downloaded {container_name}/{blob_name} to {download_path}")
        return True
    except ResourceNotFoundError:
        print(f"Blob {blob_name} not found in container {container_name}")
        return False
    except Exception as e:
        print(f"Failed to download file: {e}")
        return False

def list_blobs_in_container(blob_service_client: BlobServiceClient, container_name: str) -> list:
    # Retrieve a list of all blob names within a specific container
    try:
        container_client = blob_service_client.get_container_client(container_name)
        blobs = container_client.list_blobs()
        return [blob.name for blob in blobs]
    except ResourceNotFoundError:
        print(f"Container {container_name} does not exist.")
        return []
    except Exception as e:
        print(f"Failed to list blobs in {container_name}: {e}")
        return []

# Example usage for your local development environment
if __name__ == "__main__":
    # 1. Initialize client
    client = get_blob_service_client(CONNECTION_STRING)

    # 2. Setup environment with your required containers
    required_containers = ["input-data", "processed-data", "logs-container"]
    print("--- Setting up containers ---")
    setup_multiple_containers(client, required_containers)

    # 3. Verify containers
    print("\n--- Current Containers ---")
    current_containers = list_all_containers(client)
    print(current_containers)

    # 4. Test file operations (Create a dummy file first if testing)
    test_file_name = "test_upload.txt"
    with open(test_file_name, "w") as f:
        f.write("Local development test data.")

    print("\n--- Testing Upload ---")
    upload_local_file_to_blob(client, "input-data", "raw_data_001.txt", test_file_name)

    print("\n--- Listing Blobs in input-data ---")
    print(list_blobs_in_container(client, "input-data"))

    print("\n--- Testing Download ---")
    download_blob_to_local_file(client, "input-data", "raw_data_001.txt", "downloaded_test.txt")
```

這些 helper functions 可以完全取代圖形化介面的工作。當你在本地端開發時，可以直接在程式碼啟動階段呼叫 `setup_multiple_containers`，傳入你所有需要的 container 名稱清單，確保你的本地 Azurite 環境隨時處於就緒狀態。
