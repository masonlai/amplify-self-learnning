
明白。這張 Ticket 寫得非常標準且清晰（完全符合 Clean Architecture 的精神）。根據 Ticket 的要求，`report_2_main.py`（作為 Controller/Pipeline）**絕對不能直接呼叫 Repo 或者做任何 DataFrame 的操作（例如 `pd.concat`）**。

為了完全對齊 Report 3 的架構（如你的第 4 張截圖所示，Services 是依照業務領域分類的，例如 `benplus.py`, `deductions.py` 等），我們將捨棄之前提議的單一巨大 `Report2Service`，改為「**依照業務領域拆分 Service**」，最後再用一個 Orchestrator 來統整。

我們「重新嚟過」，從你最新提供的第 1 張截圖（處理 Ongoing Payments 分組的邏輯）開始動刀。

### 架構藍圖 (參照 Report 3)

我們將在 `report_2/services/` 底下建立以下結構：

1. `ongoing_payments.py` (處理第 1 張截圖的 Plan Grouping 邏輯)
2. `payment_changes.py` (處理 Death/Active Changes 邏輯)
3. `report_orchestrator.py` (負責指揮各個 Service，取代 `main` 的流程)

---

### 第一步：建立 `OngoingPaymentsService`

請在 `report_2/services/` 目錄下建立一個新檔案 `ongoing_payments.py`。這個 Service 的職責是接收 Repo 撈出來的原始資料，然後執行截圖 1 裡面 `RPT_2_VARS.GROUPED_PLANS` 的商業合併邏輯。

```python
import pandas as pd

class OngoingPaymentsService:
    def __init__(self, ongoing_payments_repo, logger):
        # Service only interacts with the Repository, not direct file I/O
        self.repo = ongoing_payments_repo
        self.logger = logger

    def generate_grouped_plan_data(self, grouped_plans_config: dict) -> dict:
        """
        Fetches plan lists, retrieves ongoing payments, and groups them 
        based on business rules defined in grouped_plans_config.
        """
        self.logger.log_info("Generating plan list via repository")
        plan_list = self.repo.get_plan_list()

        self.logger.log_info("Collecting DataFrames for each individual plan")
        plan_dfs = {}
        for plan in plan_list:
            # 1. Fetch raw data from Repo
            df = self.repo.get_data_by_plan(plan)
            
            # 2. Transformation: Drop process_time if it exists
            if "process_time" in df.columns:
                df = df.drop(columns=["process_time"])
                
            plan_dfs[plan] = df

        self.logger.log_info("Executing business logic: Grouping related plans")
        grouped_results = plan_dfs.copy()
        
        # Mirroring the exact concatenation logic from the original main script
        for main_plan, grouped_plans in grouped_plans_config.items():
            dfs_to_concat = []

            # Add main plan's DataFrame if it exists
            if main_plan in plan_dfs:
                dfs_to_concat.append(plan_dfs[main_plan])

            # Add grouped plans' DataFrames if they exist
            for gp in grouped_plans:
                if gp in plan_dfs:
                    dfs_to_concat.append(plan_dfs[gp])

            # Create merged DataFrame for the main plan
            if dfs_to_concat:
                grouped_results[main_plan] = pd.concat(dfs_to_concat, ignore_index=True)

        return grouped_results

```

---

### 第二步：清理 `report_2_main.py` (對應截圖 1 的範圍)

現在你的 `main` 腳本不再需要親自做 DataFrame 操作了。請將截圖 1 中第 173 行到第 205 行的程式碼**全數刪除**，並替換為呼叫 Service。

**Original Code (請刪除第 173 ~ 205 行):**

```python
logger.log_info("Generating plan list")
plan_list = data_processor.get_plan_list(ongoing_payments_parquet_path)
# ... 中間一大段 for loop 和 pd.concat ...
for group in RPT_2_VARS.GROUPED_PLANS.values():
    plan_list[:] = [item for item in plan_list if item not in group]

```

**New Code (請加入):**

```python
    # Ensure this initialization happens at the top of your main script (after repos are created)
    from report_2.services.ongoing_payments import OngoingPaymentsService
    ongoing_payments_service = OngoingPaymentsService(
        ongoing_payments_repo=ongoing_payments_repo, 
        logger=logger
    )

    # ... execution flow continues ...

    # Replace lines 173-205 with a single service call
    logger.log_info("Delegating plan grouping logic to OngoingPaymentsService")
    grouped_results = ongoing_payments_service.generate_grouped_plan_data(
        grouped_plans_config=RPT_2_VARS.GROUPED_PLANS
    )

```

### 為什麼這樣做完全符合你的 Ticket 驗收標準？

1. **Service Layer Exists & Is Used:** 我們建立了 `OngoingPaymentsService`，`main` 現在只 call service，不再 call `pd.concat`。
2. **Separation of Concerns:** * `OngoingPaymentsRepository` 只負責 `get_data_by_plan` (資料獲取)。
* `OngoingPaymentsService` 負責 `drop(columns)` 與 `pd.concat` (商業邏輯與資料轉換)。
* `main` 負責串接 (Orchestration)。



你可以先完成這個 `OngoingPaymentsService` 的替換，並跑一次 `pytest tests/regression/report2/test_parity.py` 確定產出無誤。如果 passed，我們就繼續依照 Report 3 的分類方式，建立 `PaymentChangesService` 來處理下一段邏輯。需要繼續嗎？
