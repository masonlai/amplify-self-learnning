
import sys
import os
import pytest
import pgpy
from pgpy.constants import PubKeyAlgorithm, KeyFlags, SymmetricKeyAlgorithm, CompressionAlgorithm
from unittest.mock import patch

# --- Fix Import Path ---
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../functions/EncryptFn')))

from function_app import main, encrypt_data_with_pgp

# ==========================================
# Fixtures (準備工作)
# ==========================================

@pytest.fixture(scope="module")
def real_key_pair():
    """
    專門為 Logic Test 生成一對【真實】的 RSA Key。
    scope="module" 代表成個檔案只會跑一次 Key Gen，唔會每次跑 test 都慢一次。
    """
    print("\n[Setup] Generating real 4096-bit RSA key for testing...")
    key = pgpy.PGPKey.new(PubKeyAlgorithm.RSAEncryptOrSign, 4096)
    uid = pgpy.PGPUID.new('Test User', comment='For Unit Test')
    
    key.add_uid(uid, usage={KeyFlags.EncryptCommunications}, 
                hashes=[pgpy.constants.HashAlgorithm.SHA256],
                ciphers=[SymmetricKeyAlgorithm.AES256],
                compression=[CompressionAlgorithm.ZLIB])
    
    public_key_str = str(key.pubkey)
    private_key_obj = key
    return public_key_str, private_key_obj

# ==========================================
# Test Cases (測試主體)
# ==========================================

# 1. Logic Test: 測試真實加密 (Integration Level)
def test_encryption_logic_real_crypto(real_key_pair):
    # Unpack fixture data
    pub_key_str, priv_key_obj = real_key_pair
    
    # 1. 準備 Clear Text
    original_data = b"This is sensitive banking data."

    # 2. 執行 Function (真跑!)
    encrypted_bytes = encrypt_data_with_pgp(original_data, pub_key_str)

    # 3. 驗證基本野
    assert encrypted_bytes is not None
    assert encrypted_bytes != original_data

    # 4. 驗證解密 (The Proof)
    try:
        encrypted_message = pgpy.PGPMessage.from_blob(encrypted_bytes)
        decrypted_message = priv_key_obj.decrypt(encrypted_message)
        
        # 強制轉 bytes 避免類型錯誤
        decrypted_bytes = bytes(decrypted_message.message)
        
        assert decrypted_bytes == original_data
        print("\n✅ Real Crypto Logic Verified!")
        
    except Exception as e:
        pytest.fail(f"Decryption failed! Logic broken. Error: {e}")


# 2. Flow Test: 測試 Azure Function 流程 (Mock Level)
# 注意：這裡用的 fixtures (create_mock_blob 等) 來自 conftest.py
def test_main_flow_success(mock_public_key, create_mock_blob, mock_output_blob):
    
    # --- Arrange ---
    fake_input = create_mock_blob(content=b"My Secret Data", name="input-clear/report.xlsx")
    
    # Mock 走內部 helper
    with patch('function_app.get_public_key_from_kv') as mock_get_key, \
         patch('function_app.encrypt_data_with_pgp') as mock_encrypt:
        
        # 設定 Mock 行為
        mock_get_key.return_value = mock_public_key
        mock_encrypt.return_value = b"MOCKED_ENCRYPTED_BYTES"

        # --- Act ---
        main(fake_input, mock_output_blob)

        # --- Assert ---
        mock_get_key.assert_called_once()
        mock_encrypt.assert_called_once_with(b"My Secret Data", mock_public_key)
        
        # 驗證 Output 有無 set 到
        mock_output_blob.set.assert_called_once_with(b"MOCKED_ENCRYPTED_BYTES")
