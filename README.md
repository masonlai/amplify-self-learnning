寫 PR (Pull Request) Message 最緊要係清晰交代你「做咗咩」、「點解咁做」，同埋「點樣 Test」。既然你份 Code 係全英文，我幫你準備咗一份 **全英文嘅專業 PR 範本**，方便你直接 Copy & Paste 落 GitHub。

範本入面已經幫你重點 Highligh 咗 **「Data Privacy（唔上傳真實資料）」** 同埋 **「點樣自己 Setup Test Data」** 嘅步驟，包保 Lily 同其他 Reviewer 睇到會覺得你做事非常嚴謹！

---

### GitHub PR Message Template (直接 Copy 呢段 👇)

**Title:** Feature/GRSP-492: Refactor Report 2 Input Resolution & File Abstraction

**## 📝 Summary**
This PR refactors the Report 2 ingestion pipeline to make it cloud-ready and align with SOLID principles. It decouples the core business logic from local file system dependencies (e.g., `os.path` and `shutil`) by implementing the `InputFileResolver` and `File` protocol abstractions.

**## 🛠️ Key Changes**

* **Separation of Concerns:** Introduced `Report2OnPremInputResolver` to handle file stability checks and archiving. `report_2_main.py` is now strictly focused on business logic orchestration.
* **File Abstraction:** Upgraded `IngestionHelper` and `ExcelReader` to accept `File` objects instead of string paths. Implemented `.open_binary()` streams to ensure compatibility with future cloud storage integrations.
* **Code Cleanup:** Removed legacy local path manipulations and string-matching loops in validation methods, replacing them with object-oriented property access (`f.filename`).
* **Regression Testing:** Added a dedicated parity check script (`test_parity.py`) using `pandas.testing` and `pytest`.

**## 🧪 How to Run Parity Test**
A regression test (`tests/regression/report2/test_parity.py`) has been created to ensure data parity between the old and new implementations.

**⚠️ IMPORTANT: DATA PRIVACY ⚠️**
Due to the presence of PII (Personally Identifiable Information) in the report data, **test data is NOT included in this repository.** Reviewers/Testers must provide their own local test files.

**Test Setup Instructions:**

1. Do not commit any real employee data to Git.
2. In your local environment, create the following directory structure (which is gitignored):
```text
tests/regression/report2/test_data/
├── expected/
│   └── expected_report.xlsx  <-- Place the baseline report from Production here
└── actual/
    └── actual_report.xlsx    <-- Place the newly generated report here

```


3. Run the parity test via terminal:
```bash
pytest tests/regression/report2/test_parity.py -v

```


4. The test will automatically assert shape, sheet names, and cell-by-cell data equality.

---

### 💡 小貼士

* 呢個 PR Message 寫法非常符合大公司嘅標準，特別係 **⚠️ IMPORTANT: DATA PRIVACY ⚠️** 嗰一段，Security Team 同 Senior Developer 見到都會覺得你防禦意識極高。
* 你可以將上面嘅 `Feature/GRSP-492` 改返做你真正嘅 Jira Ticket Number 如果有出入的話。

搞掂晒就隨時撳 "Create Pull Request" 啦！祝你 Code Review 一次過 Pass！需唔需要我幫你睇埋如果有 Reviewer 留 Comment 應該點回覆？
