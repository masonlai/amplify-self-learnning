明白！有咗 `ExcelReportWriter` 嘅代碼，我哋就唔洗估，可以直接動手將佢改裝成支援 File Stream 嘅版本。

睇返你俾嘅 `ExcelReportWriter` 代碼 (Image 5)，佢目前嘅 `save_workbook` (Line 23) 係寫死咗用 `self.file_path` (字串)。因為你要將 Output 上 Cloud，所以我哋要加一個 `save_to_stream` 方法，然後去 `ProcessingHelper` 嗰度配合使用。

### 第一步：修改 `ExcelReportWriter` (`excel_writer.py`)

請打開 `utils/objects/excel_writer.py`，加入一個新 method 專門用嚟寫入 Stream。

**喺 Line 25 之後加入 `save_to_stream`:**

```python
    def save_workbook(self):
        self.workbook.save(self.file_path)

    # ---------------------------------------------------------
    # [NEW] Add a method to save directly to a file-like object (stream)
    # ---------------------------------------------------------
    def save_to_stream(self, file_stream):
        """Saves the workbook to an open file stream instead of a string path."""
        self.workbook.save(file_stream)

```

*(註：`openpyxl` 嘅 `workbook.save()` 原生就支援傳入 file-like object，所以咁樣加一行就搞掂！)*

---

### 第二步：修改 `ProcessingHelper` (`processing_helper.py`)

依家返去你個 `ProcessingHelper`，將頭先講過嗰兩個位改一改。

#### 1. 修改 `__init__` (加入 Factory)

去到 Image 2 (或者你之前已經改咗)，確保 `__init__` 有收 `file_factory`。

```python
    def __init__(self, logger: Logger, file_factory: FileFactory, path_to_parquets: str, report_output_path: str):
        self.logger = logger
        self.file_factory = file_factory  # <--- 確保有呢行
        self.data_path = path_to_parquets
        self.report_output_path = report_output_path
        self.report_file = None

```

#### 2. 修改 `save_excel_file` (使用 Stream 寫出)

去到 Image 2 嘅 Line 33。將原本直接 Call `save_workbook` 嘅代碼，改成用 Factory 建立檔案並透過 Stream 寫出。

**將原本的：**

```python
    def save_excel_file(self):
        self.report_file.save_workbook()

```

**改成咁：**

```python
    def save_excel_file(self):
        """Saves the Excel report using the abstract File protocol."""
        self.logger.log_info(f"Saving final report to: {self.report_output_path}")
        
        # 1. 用 Factory 將 output path 變成 File 物件
        report_file_obj = self.file_factory.build_from_fragments(self.report_output_path)
        
        # 2. 確保資料夾存在 (如果是 Local 環境)
        report_file_obj.ensure_parents_exist()
        
        # 3. 透過 open_binary 打開寫入 Stream ("wb")
        with report_file_obj.open_binary(mode="wb") as f:
            # 4. 呼叫你頭先喺 ExcelReportWriter 加嘅新 method
            self.report_file.save_to_stream(f)

```

---

### 咁就大功告成啦！

依家成個 Report 2 嘅 Input (透過 `Resolver` + `ExcelReader`) 同 Output (透過 `ProcessingHelper` + `ExcelReportWriter`) 都已經全面升級做 Abstraction 層。Parquet 嘅邏輯則原封不動留喺 Local。

你依家可以放心撳 Run 試跑一次！如果冇報錯，而且產生出嚟嘅 Report 內容同以前一模一樣，你呢張 Ticket 就可以宣告完成。如果有咩 Error，成段 Error Message copy 俾我睇！
