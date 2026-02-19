太好啦，搞掂咗 `main.py` 最頭痕嗰段，依家個邏輯已經清晰好多！我哋依家即刻做埋 `ingestion_helper.py` 嘅大換血。

為咗減低 import 錯嘅風險，我建議**直接將個 Resolver 寫喺 `ingestion_helper.py` 嘅最尾**。

請打開 `ingestion_helper.py`，跟住以下呢 3 個步驟做：

### 第一步：喺最底加入 Resolver 完整代碼

碌到去 `ingestion_helper.py` 嘅最底（即係所有 class 嘅外面），將以下呢段代碼**原封不動 Copy & Paste 落去**。我已經幫你將你之前喺 `main.py` 刪除咗嘅「等檔案」邏輯，同埋原本嘅 `archiveFile` 邏輯，完美縫合入去呢個黑盒子裡面：

```python
import os
import shutil
import time
from shared.file_system import InputFileResolver, FileFactory, File

class Report2OnPremInputResolver(InputFileResolver):
    """
    Handles input file resolution for Report 2 in an On-Prem environment.
    Responsibilities include checking file stability, archiving files,
    and returning a list of abstracted File objects for further processing.
    """
    def __init__(self, logger, input_path: str, archive_path: str, file_factory: FileFactory, 
                 max_retries: int, check_interval: int):
        self.logger = logger
        self.input_path = input_path
        self.archive_path = archive_path
        self.file_factory = file_factory
        self.max_retries = max_retries
        self.check_interval = check_interval

    def resolve(self) -> list[File]:
        self.logger.log_info("Resolver started: Checking file stability and archiving...")
        
        # Step 1: Wait for file stability (Replaces the old main.py for-loop)
        self._wait_for_file_stability()
        
        # Step 2: Move all files to the archive directory
        self._archive_all()
        
        # Step 3: Wrap archived files in the File protocol
        resolved_files = []
        if os.path.exists(self.archive_path):
            for filename in os.listdir(self.archive_path):
                file_path = os.path.join(self.archive_path, filename)
                if os.path.isfile(file_path):
                    # Create File object using the factory
                    resolved_file = self.file_factory.build_from_fragments(self.archive_path, filename)
                    resolved_files.append(resolved_file)
                    
        self.logger.log_info(f"Resolver finished: Found {len(resolved_files)} archived files.")
        return resolved_files

    def _wait_for_file_stability(self):
        """ Checks if files are still being copied into the landing zone. """
        from utils.functions.file_utils import get_files, all_files_stable # 確保 import 返你原本用開嘅 utils
        
        for attempt in range(1, self.max_retries + 1):
            files = get_files(self.logger, self.input_path)
            self.logger.log_info(f"[Attempt {attempt}/{self.max_retries}] Existing Files: {files}")
            self.logger.log_info("Checking file stability...")
            
            if all_files_stable(self.logger, self.input_path, files, self.check_interval):
                self.logger.log_info("All files are stable. Proceeding to archiving...")
                break
                
            self.logger.log_info(f"Some files are still being copied. Retrying in {self.check_interval} seconds.")
            time.sleep(self.check_interval)
        else:
            self.logger.log_error(f"Files did not stabilize after {self.max_retries} attempts.")
            raise TimeoutError(f"Files did not stabilize after {self.max_retries} attempts.")

    def _archive_all(self):
        """ Moves files from landing zone to archive. """
        self.logger.log_info("Beginning file archiving")
        if not os.path.exists(self.input_path):
            raise ConnectionError(f"Input path does not exist: {self.input_path}")
            
        for filename in os.listdir(self.input_path):
            file_path = os.path.join(self.input_path, filename)
            try:
                self._archive_file(file_path, filename)
            except Exception as e:
                self.logger.log_error(f"Error moving {filename}: {e}")
                raise e
        self.logger.log_info("Files moved to archive path")

    def _archive_file(self, file_path, file_name):
        """ Handles the actual move, appending _1, _2 if filename exists in archive. """
        archive_file_path = os.path.join(self.archive_path, file_name)
        
        if os.path.exists(archive_file_path):
            base, ext = os.path.splitext(file_name)
            counter = 1
            while True:
                new_filename = f"{base}_{counter}{ext}"
                new_archive_path = os.path.join(self.archive_path, new_filename)
                if not os.path.exists(new_archive_path):
                    archive_file_path = new_archive_path
                    break
                counter += 1
                
        shutil.move(file_path, archive_file_path)
        self.logger.log_info(f"Moved file to archive as {os.path.basename(archive_file_path)}")

```

---

### 第二步：幫 IngestionHelper 大掃除 (Delete Code)

依家 Resolver 已經包辦晒啲污糟嘢，你入返去 `IngestionHelper` 個 Class 裡面，**狠狠地 Delete 以下三個 function**（唔洗留戀）：

1. `def get_file_name_list(self, ...):`
2. `def archive_all(self, ...):`
3. `def archiveFile(self, ...):`

刪除完之後，你個 Helper 會即刻輕咗一半！

---

### 第三步：將 String 改成 File Stream (核心改動)

最後一步，我哋要令 `IngestionHelper` 食 `File` 物件而唔係字串路徑。

**1. 修改 `append_excel_file_to_parquet**` (大概喺 Line 113)
將原本個 function 成個 Replace 做以下代碼 (假設你已經改咗 `ExcelReader` 接受 `file_obj`)：

```python
    def append_excel_file_to_parquet(self, report_file_list: list[File], parquet_file_list: list[str], header_row_list: list[int] | None = None):
        """ Iterates over a list of File objects and processes them via ExcelReader. """
        for file_obj in report_file_list:
            self.logger.log_info(f"Processing {file_obj.filename}")
            try:
                # 依家直接傳入 file_obj，而唔係 os.path.join 砌出嚟嘅字串
                excel_file = ExcelReader(self.logger, file_obj=file_obj, parquet_output_dir=self.output_path)
                excel_file.process_sheets(self.logger.get_job_id(), header_row_list, parquet_file_list)
            except Exception as e:
                self.logger.log_error(f"Error processing {file_obj.filename}: {e}")
                raise e

```

**2. 修改 `append_csv_file_to_parquet**` (大概喺 Line 126)
將原本用 `os.path.join` 砌 path 然後 `pd.read_csv(file_path)` 嘅寫法，改成用 `with file_obj.open_binary()` 開 Stream。

請將整個 function Replace 做：

```python
    def append_csv_file_to_parquet(self, file_obj: File, parquet_file_name: str, reporting_period: str = None, req_cols: list[str] | None = None, encoding: str = "ISO-8859-1"):
        """ Reads a delimited text file from a File object and appends to parquet. """
        self.logger.log_info(f"Processing {file_obj.filename} to {parquet_file_name}.parquet")
        
        parquet_path = os.path.join(self.output_path, f"{parquet_file_name}.parquet")
        
        try:
            # [CRITICAL CHANGE] Use abstraction to open binary stream
            with file_obj.open_binary() as f:
                # Pandas reads directly from the stream (f)
                df = pd.read_csv(f, skiprows=1, encoding=encoding, dtype=str)
                
            # Drop empty rows
            df = df.dropna(how='all').reset_index(drop=True)
            
            if df.empty:
                self.logger.log_info(f"No data found in {file_obj.filename}")
                return
                
            # ... [以下嘅 Code 保持不變，照 Keep 返你原本寫入 Parquet 嘅邏輯] ...
            # Add reporting_period...
            # Add process_time...
            # Check req_cols...
            # Concat or create parquet...

```

做完呢三步，你嘅 `IngestionHelper` 就已經完全脫胎換骨，符合晒 Abstraction 嘅要求！

你想我幫你 Double Check 埋你之前改嗰個 `ExcelReader` 有冇甩漏？定係你想直接 Run 一次睇下 PyCharm 有冇彈咩 Error 先？
