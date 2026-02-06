import logging
import os
import azure.functions as func
from azure.identity import DefaultAzureCredential
from azure.keyvault.secrets import SecretClient
import pgpy
from pgpy.constants import PubKeyAlgorithm, KeyFlags, CompressionAlgorithm, SymmetricKeyAlgorithm

app = func.FunctionApp()

# 1. 定義環境變數 (Environment Variables)
# 這些變數會由 Terraform (App Settings) 注入
KEY_VAULT_URL = os.getenv("KEY_VAULT_URL")
PGP_PUBLIC_KEY_SECRET_NAME = os.getenv("PGP_PUBLIC_KEY_SECRET_NAME") 

@app.function_name(name="BlobEncryptFn")
# 2. Input Trigger: 監聽 'input-clear' container
# connection="AzureWebJobsStorage" 係指 Function App 本身既 Storage Connection String
@app.blob_trigger(arg_name="myblob", path="input-clear/{name}", connection="AzureWebJobsStorage")
# 3. Output Binding: 自動將 return 既野寫入 'output-encrypted' container
# 檔案名會自動加 .pgp 後綴
@app.blob_output(arg_name="outputblob", path="output-encrypted/{name}.pgp", connection="AzureWebJobsStorage")
def main(myblob: func.InputStream, outputblob: func.Out[bytes]):
    logging.info(f"Processing blob: {myblob.name}, Size: {myblob.length} bytes")
    
    try:
        # --- Step A: 讀取原始檔案 (Clear Text) ---
        original_data = myblob.read()
        
        # --- Step B: 拿 Public Key (由 Key Vault) ---
        public_key_str = get_public_key_from_kv()
        
        # --- Step C: 加密 (PGP Encryption) ---
        encrypted_data = encrypt_data_with_pgp(original_data, public_key_str)
        
        # --- Step D: 輸出 (Output) ---
        # 將加密後既 bytes 寫入 Output Blob
        outputblob.set(encrypted_data)
        
        logging.info(f"Successfully encrypted and moved to output-encrypted/{myblob.name}.pgp")

    except Exception as e:
        logging.error(f"Error during encryption process: {e}")
        # 這裡 raise error 會讓 Blob Trigger 失敗，Azure 會自動 Retry 幾次
        raise

# --- Helper Function: Get Key from Key Vault ---
def get_public_key_from_kv():
    if not KEY_VAULT_URL or not PGP_PUBLIC_KEY_SECRET_NAME:
        raise ValueError("Missing Environment Variables: KEY_VAULT_URL or PGP_PUBLIC_KEY_SECRET_NAME")

    # 使用 Managed Identity 登入 (不需要密碼)
    credential = DefaultAzureCredential()
    client = SecretClient(vault_url=KEY_VAULT_URL, credential=credential)
    
    logging.info(f"Fetching public key secret: {PGP_PUBLIC_KEY_SECRET_NAME}")
    secret = client.get_secret(PGP_PUBLIC_KEY_SECRET_NAME)
    return secret.value

# --- Helper Function: PGP Encryption Logic ---
def encrypt_data_with_pgp(data: bytes, public_key_str: str) -> bytes:
    # 載入 Public Key
    pub_key, _ = pgpy.PGPKey.from_blob(public_key_str)
    
    # 建立 PGP Message 對象
    message = pgpy.PGPMessage.new(data)
    
    # 執行加密
    # 銀行標準通常要求 AES256 + ZLIB 壓縮
    encrypted_message = pub_key.encrypt(
        message, 
        cipher=SymmetricKeyAlgorithm.AES256, 
        compression=CompressionAlgorithm.ZLIB
    )
    
    # 轉成 bytes 回傳
    return bytes(encrypted_message)
