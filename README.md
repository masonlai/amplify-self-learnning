透過你提供的截圖，我已經完全掌握了你目前的架構狀態。你把 Service 拆分得很好，這正是 Clean Architecture 要求的方向。

但在我們修改 `report_2_main.py` 之前，我必須先點出一個**會導致程式崩潰的致命錯誤**。

### 🚨 必須先修正：`PlanProcessingService.py` 中的 `NoneType` Error 元兇

請看你第 12 張截圖 (`PlanProcessingService.py`) 的 **第 49 行**：

```python
data_processor=None, # Passed as None since Repo layer handles DB now

```

這就是導致你之前遇到 `'NoneType' object has no attribute 'select_data_for_column_value'` 的根本原因。

雖然 Repo 層接管了資料庫，但你原本的 `create_plan_tables` 函數內部**還在使用 `data_processor` 來畫 Excel 表格線** (`add_border_to_table_in_report`)。在你完全建立 Excel Export Service 之前，你**絕對不能**把 `data_processor` 設為 `None`。

**請先在 `PlanProcessingService.py` 進行以下修改：**

1. 在 `process_all_plan_changes` 的參數列表 (約第 21 行) 加入 `data_processor`:
```python
    reporting_period: pd.Timestamp,
    create_plan_tables_func,
    data_processor  # Add this parameter
) -> tuple:

```


2. 將第 49 行改為傳入這個變數：
```python
    data_processor=data_processor, # Pass the actual instance to avoid NoneType error during Excel formatting

```



---

### 最終版 `report_2_main.py` 修改指南

修正完 Service 之後，我們現在來徹底清理你的 `main` 腳本。

請打開 `report_2_main.py`，找到從 `for plan in plan_list:` 開始的地方（根據第 4 張截圖，大約在 **Line 333**），一直往下拉，**刪除所有內容**，直到 `plan_total_tracker = pd.concat(...)` 這一行結束（根據第 2 張截圖，大約在 **Line 396**）。

將刪除的這整大段，替換為以下簡潔的呼叫：

```python
    # Ensure PlanProcessingService is imported at the top of the file
    from report_2.services.PlanProcessingService import PlanProcessingService

    # Initialize the PlanProcessingService
    plan_processing_service = PlanProcessingService(
        payment_changes_repo=payment_changes_repo,
        logger=logger,
        rpt_2_vars=RPT_2_VARS
    )

    logger.log_info("Processing Payment Changes and Adjustments via Service")
    # This completely replaces the giant 'for plan in plan_list:' loop
    final_excel_data_map, new_historic_totals = plan_processing_service.process_all_plan_changes(
        plan_list=plan_list, # Make sure this variable holds the filtered list from OngoingPaymentsService
        raw_changes_data=changes_data_tables,
        grouped_ongoing_payments=grouped_results, # Ensure this matches your OngoingPaymentsService output
        historic_totals_df=historic_totals_df,
        inpay_df=inpay_df,
        benplus_dfs=benplus_df_dict,
        reporting_period=reporting_period,
        create_plan_tables_func=create_plan_tables,
        data_processor=data_processor # CRITICAL: Pass the active instance here
    )

    logger.log_info("Writing updated historic totals to parquet")
    historic_totals_repo.append_totals(new_historic_totals)

    # The existing code for saving the Excel file continues here...
    logger.log_info("Saving output to file")
    # data_processor.save_excel_file()

```

### 總結目前的架構對應

* **`OngoingPaymentsService`**: 負責處理 `GROUPED_PLANS`，產出 `grouped_results` (dict) 和過濾後的 `plan_list`。
* **`PlanProcessingService`**: 負責跑主迴圈，切分 Changes Data，並呼叫外部的 `create_plan_tables` 進行計算。
* **`report_2_main.py`**: 只剩下初始化依賴、循序抓取資料表 (`historic_totals`, `benplus`, `changes`)，並把資料餵給上述兩個 Service。

請照著修改並執行你的 Parity Test。只要 `data_processor` 有正確傳遞，這次就不會再報 `NoneType` error，而且你的 `main` 會變得非常符合 Ticket 要求。
