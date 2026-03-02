睇到你最新嗰張圖（Image 14），原來你嘅 `CloudInputResolver` 裡面已經寫好咗個好靚嘅 `_archive_files` function，連 download-then-upload 避開 cross-container permission 嘅邏輯都處理好晒！

既然啲「架生」齊晒，呢個「緊急洗地功能」(`clear_landing_zone`) 其實非常易搞，只係將你現有嘅 functions 組合埋一齊。你需要喺 **3 個地方** 加少少 code：

### 1. 更新 Protocol (介面)

首先喺你嘅 `InputFileResolver` Protocol 入面加返個 method signature，等主程式知道有呢招可以用：

```python
    def clear_landing_zone(self) -> None:
        """Emergency cleanup: forcefully move all files from landing zone to archive without validation."""
        ...

```

### 2. Cloud Resolver 嘅實作 (基於 Image 14)

喺你圖中嘅 `CloudInputResolver` 裡面，加呢個 method。佢嘅邏輯好簡單：搵晒啲 files 出嚟，然後直接質晒畀你圖中嗰個 `_archive_files`。

*(留意圖中頂部，似乎你有個 function 類似 `_discover_files` 去 `list_blobs`，我當你個 class 有個 function 可以攞到 list of blob names)*

```python
    def clear_landing_zone(self) -> None:
        self.logger.log_info("Executing emergency clear of the cloud landing zone...")
        try:
            # 1. 無腦搵晒 Landing zone 所有 files 出嚟
            # (用返你圖頂部嗰個 list_blobs 嘅邏輯，假設叫 _get_all_blob_names)
            blob_names = self._get_all_blob_names() # 請換成你實際攞 file list 嘅 function 名
            
            if not blob_names:
                self.logger.log_info("Cloud landing zone is already empty. Nothing to clear.")
                return
            
            # 2. 直接 call 你圖 14 寫好嗰個搬 file 大法
            self._archive_files(blob_names)
            self.logger.log_info(f"Emergency cleanup complete. Moved {len(blob_names)} files to archive.")
            
        except Exception as e:
            self.logger.log_error(f"Failed to clear cloud landing zone during emergency cleanup: {e}")
            raise

```

### 3. On-Prem Resolver 嘅實作

同樣道理，你要喺 `Report2OnPremInputResolver` 都加返呢個 method，針對 Local Filesystem 做洗地。

```python
    def clear_landing_zone(self) -> None:
        self.logger.log_info("Executing emergency clear of the local landing zone...")
        try:
            # 假設你有個類似 get_files() 嘅 utility function 攞晒 input path 嘅 files
            from utils.functions.file_utils import get_files # 根據你 import 習慣調整
            
            files_to_move = get_files(self.logger, self.input_path)
            if not files_to_move:
                self.logger.log_info("Local landing zone is already empty.")
                return
            
            # 無腦將佢哋全部搬去 archive (利用你 OnPrem 本身用開嘅搬 file 邏輯)
            self._archive_files(files_to_move) # 假設你 OnPrem 都有個對應嘅 _archive_files method
            
            self.logger.log_info(f"Emergency cleanup complete. Moved {len(files_to_move)} files to archive.")
            
        except Exception as e:
            self.logger.log_error(f"Failed to clear local landing zone during emergency cleanup: {e}")
            raise

```

### 總結

加完呢三個位之後，你就可以安全咁將 `input_resolver.clear_landing_zone()` 放落 `report_2_reingestion.py` 嘅 global `except` block 度。

咁樣做完美符合 Jira Ticket 嘅要求：**主程式 (`reingestion.py`) 依然對底層 File System 毫不知情**，只係落個 order 叫 Resolver「同我洗地」，至於點洗（Cloud 用 download/upload，On-prem 用 OS move），全部交畀各自嘅 Resolver 自己搞掂！
