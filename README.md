# service/tests/conftest.py
import pytest
from unittest.mock import MagicMock
import azure.functions as func

# 1. 共用的假 Public Key
@pytest.fixture
def mock_public_key():
    return """-----BEGIN PGP PUBLIC KEY BLOCK-----
Version: GnuPG v2
... (這裡是你的假 Key 內容) ...
-----END PGP PUBLIC KEY BLOCK-----"""

# 2. 共用的假 Blob Generator
# 這裡我寫得高級少少，讓你可以自訂檔案內容同名
@pytest.fixture
def create_mock_blob():
    def _creator(content=b"Default Content", name="input-clear/default.txt"):
        # 建立一個扮晒野既 InputStream
        mock_blob = MagicMock(spec=func.InputStream)
        mock_blob.read.return_value = content
        mock_blob.name = name
        mock_blob.length = len(content)
        return mock_blob
    return _creator

# 3. 共用的假 Output Binding
@pytest.fixture
def mock_output_blob():
    return MagicMock(spec=func.Out)


    =============

    # service/tests/unit/test_encrypt_fn.py
import sys
import os
import unittest
from unittest.mock import patch

# Fix Import Path (依然要有呢句)
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '../../functions/EncryptFn')))

from function_app import main

# 注意：如果要用 pytest fixtures，通常唔用 unittest.TestCase class 寫法，
# 而是直接寫 function，或者用 @pytest.mark.usefixtures
# 但為了保持簡單，這裡示範最常見的 pytest function 寫法：

def test_main_flow_success(mock_public_key, create_mock_blob, mock_output_blob):
    """
    pytest 會自動去 conftest.py 搵:
    1. mock_public_key
    2. create_mock_blob
    3. mock_output_blob
    然後注入入來。
    """
    
    # --- Arrange ---
    # 使用 Fixture 建立假 Input
    fake_input = create_mock_blob(content=b"My Secret Data", name="input-clear/report.xlsx")
    
    # Mock 走 Function App 內部的 helper
    with patch('function_app.get_public_key_from_kv') as mock_get_key, \
         patch('function_app.encrypt_data_with_pgp') as mock_encrypt:
        
        # 設定 Mock 行為
        mock_get_key.return_value = mock_public_key
        mock_encrypt.return_value = b"ENCRYPTED_BYTES"

        # --- Act ---
        main(fake_input, mock_output_blob)

        # --- Assert ---
        mock_get_key.assert_called_once()
        mock_encrypt.assert_called_once_with(b"My Secret Data", mock_public_key)
        mock_output_blob.set.assert_called_once_with(b"ENCRYPTED_BYTES")
