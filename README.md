收到截圖了。資料非常充足，這 550 行的邏輯我們現在一覽無遺。

正如我們之前討論的，這個重構的核心精神是**「關注點分離 (Separation of Concerns)」**。原先的程式碼在同一個迴圈裡面，一下做 Pandas 計算，一下呼叫 `data_processor` 畫 Excel 框線，這會導致未來的測試和維護變成一場災難。

因為 550 行程式碼如果一次過全部丟給你，很容易出錯且難以閱讀。我們將採用**分階段重構**的策略。

今天我們專注完成第一步：**建立資料傳輸合約 (Data Contract) 與 `PlanBusinessRuleService` 的骨架，並示範抽離前置準備邏輯與 `SPOUSE_DATA` 邏輯。**

### 1. 核心概念：Data Contract (資料合約)

`PlanBusinessRuleService` 處理完所有商業邏輯後，會將結果打包成一個乾淨的 Dictionary，交給 `ReportRenderingService` 去畫圖。這個 Dictionary 的結構將會是這樣：

```python
# The structure that PlanBusinessRuleService will return
report_data_payload = {
    "plan_payments_sum": 1234.56,
    "totals_dict": { ... }, # For the Grey Table
    "processed_yellow_tables": [
        {
            "title": "Spouse/Beneficiary - pension in payment",
            "df": pd.DataFrame(...), # The fully processed table to draw
            "flagged_ids": ["12345", "67890"] # For coloring cells red later
        },
        # ... other tables
    ],
    "adjustments_table": pd.DataFrame(...), # The Blue table
    "adjustments_sum": 0.0,
    "adjusted_total": 1234.56
}

```

### 2. 重構實作：PlanBusinessRuleService (Phase 1)

請建立一個新的檔案 `services/plan_business_rule_service.py` (或者放在你覺得合適的 domain folder)。以下是抽離了 UI 邏輯後的純淨運算類別：

```python
import pandas as pd
# Import your helper functions (benplus_status_month_compare, calculate_over_retro_payment, etc.)
# import ...

class PlanBusinessRuleService:
    def __init__(self, logger, grouped_plans_config, totals_table_rows_config):
        self.logger = logger
        self.grouped_plans_config = grouped_plans_config
        self.totals_table_rows_config = totals_table_rows_config

    def process_all_business_rules(self, plan: str, changes_data_tables: dict, historical_totals_df: pd.DataFrame, ongoing_payments_df: pd.DataFrame, benplus_dfs: dict, inpay_df: pd.DataFrame, reporting_period) -> dict:
        """
        Orchestrates all business logic calculations for a given plan.
        Does NOT contain any UI or Excel rendering code.
        """
        self.logger.log_info(f"Starting business rule processing for plan: {plan}")

        # 1. Initialize core data structures
        report_data = {
            "plan_payments_sum": round(ongoing_payments_df["TPVTOTPN"].astype(float).sum(), 2),
            "totals_dict": self._initialize_totals_dict(reporting_period),
            "processed_yellow_tables": [],
            "adjustments_table_list": [] # Use list to collect dfs, concat at the end
        }

        # 2. Prepare BENPLUS data
        benplus_master_data, benplus_spouse_data = self._filter_benplus_data_for_plan(plan, benplus_dfs)
        
        # Note: Assuming get_latest_benplus_data is imported or available
        recent_benplus_master, recent_benplus_spouse = get_latest_benplus_data(
            self.logger, benplus_master_data.copy(), benplus_spouse_data.copy(), reporting_period
        )

        # 3. Process each change reason
        for change_reason, table in changes_data_tables.items():
            if table.empty:
                continue
                
            self.logger.log_info(f"Processing logic for: {change_reason}")
            
            # Base table initialization
            output_table = pd.DataFrame({
                "FN": table["First Name"],
                "LN": table["Last Name"],
                "ID": table["Employee ID"],
                "CHANGE_REASON": table["Reason for Change"],
                "FLAG": True
            })

            # Route to specific logic handlers
            if change_reason == "SPOUSE_DATA":
                result = self._process_spouse_data(output_table, table, benplus_master_data, ongoing_payments_df, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])
                    
            # elif change_reason == "DEATH_DATA":
            #     result = self._process_death_data(...)
            # ... Add other elif blocks here later

        # 4. Finalize Adjustments Table and Totals
        final_adjustments_table = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])
        if report_data["adjustments_table_list"]:
            final_adjustments_table = pd.concat(report_data["adjustments_table_list"], ignore_index=True)
            
        report_data["adjustments_table"] = final_adjustments_table
        report_data["adjustments_sum"] = round(final_adjustments_table["Adjustments"].astype(float).sum(), 2)
        report_data["adjusted_total"] = report_data["adjustments_sum"] + report_data["plan_payments_sum"]

        # 5. Process Historical Totals (Grey Table Data)
        self._append_historical_data_to_totals(plan, report_data["totals_dict"], historical_totals_df, reporting_period, report_data["adjustments_sum"])

        return report_data

    # --- Private Helper Methods ---

    def _initialize_totals_dict(self, reporting_period) -> dict:
        month = reporting_period.strftime("%B")
        year = reporting_period.year
        last_month_date = reporting_period.replace(month=reporting_period.month - 1) if reporting_period.month > 1 else reporting_period.replace(month=12, year=year-1)
        last_month = last_month_date.strftime("%B")
        
        return {
            row.format(month=month, last_month=last_month, year=year): 0 
            for row in self.totals_table_rows_config
        }

    def _filter_benplus_data_for_plan(self, plan: str, benplus_dfs: dict):
        benplus_master_df = benplus_dfs["benplus_master"].copy()
        plans_to_include = [plan] + self.grouped_plans_config.get(plan, [])
        
        # Pure pandas filtering instead of using data_processor
        benplus_master_data = benplus_master_df[benplus_master_df["PLAN"].isin(plans_to_include)].drop_duplicates()
        benplus_spouse_data = benplus_dfs["benplus_spouse"].copy() # Assuming spouse isn't filtered by plan here based on original code
        
        return benplus_master_data, benplus_spouse_data

    def _append_historical_data_to_totals(self, plan: str, totals_dict: dict, historical_totals_df: pd.DataFrame, reporting_period, adjustments_sum: float):
        month = reporting_period.strftime("%B")
        year = reporting_period.year
        last_month_date = reporting_period.replace(month=reporting_period.month - 1) if reporting_period.month > 1 else reporting_period.replace(month=12, year=year-1)
        last_month = last_month_date.strftime("%B")

        totals_dict[f"{month} {year} Adjustments (retro and overpayments)"] = adjustments_sum

        if historical_totals_df.empty or historical_totals_df.loc[historical_totals_df["plan"] == plan].empty:
            totals_dict["Last month wire payment"] = 0.0
            totals_dict[f"Reverse 1-time {last_month} {year} adjustments"] = 0.0
        else:
            totals_dict["Last month wire payment"] = historical_totals_df.loc[historical_totals_df["plan"] == plan, "last_month_wire_payment"].iloc[0]
            totals_dict[f"Reverse 1-time {last_month} {year} adjustments"] = -historical_totals_df.loc[historical_totals_df["plan"] == plan, "adjustments"].iloc[0]

    # --- Business Logic Blocks ---

    def _process_spouse_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, ongoing_payments_df: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.2 / 2.3 NEW SPOUSAL PENSION LOGIC
        """
        table_title = "Spouse/Beneficiary - pension in payment"
        output_table["Pension Amount"] = raw_table["New Pension Amount"].astype(float)
        
        # Flagging logic
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="13", current_required="9")
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="8", current_required="9")

        # IDs and Aggregations
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)
        
        # Note: Ensure add_commencement_column, update_df_col_date_format are pure pandas functions
        output_table = add_commencement_column(output_table, benplus_master_data)
        
        commencement_column = "TPSUBDTE"
        user_id = "TPEENO"
        agg_df = (
            ongoing_payments_df
            .groupby(user_id, as_index=False)[commencement_column]
            .max()
            .rename(columns={commencement_column: "Commencement"})
        )
        
        output_table = output_table.merge(agg_df, left_on="ID", right_on=user_id, how="left").drop(columns=[user_id])
        output_table = update_df_col_date_format(output_table, col="Commencement")

        # Totals update
        totals_updates = {
            "Spouse/Beneficiary - pension in payment": output_table["Pension Amount"].astype(float).sum()
        }

        # Adjustments calculation
        adjustments_list = []
        for _, row in output_table.iterrows():
            start_date = None
            retro_start_date = pd.to_datetime(row["Commencement"])
            plan_commencement_date = pd.to_datetime(row["commencement_benplus"], errors="coerce")
            
            if pd.notna(retro_start_date) and pd.notna(plan_commencement_date):
                date_to_compare = max(retro_start_date, plan_commencement_date)
                adjustment = calculate_over_retro_payment(float(row["Pension Amount"]), reporting_period, date_to_compare, is_over=False)
                start_date = date_to_compare
            else:
                adjustment = 0
                
            period_str = get_period_range_string(reporting_period, start_date) if start_date else ""
            
            adjustments_list.append({
                "FN": row.get("FN", ""),
                "LN": row.get("LN", ""),
                "ID": row.get("ID", ""),
                "Adjustments": adjustment,
                "Comments": f"Spouse/Beneficiary - pension in payment. Retro for {period_str}"
            })
            
        adjustments_df = pd.DataFrame(adjustments_list)
        
        # Clean up output table for UI
        output_table = output_table.drop(columns=["commencement_benplus"])

        return {
            "table_info": {
                "title": table_title,
                "df": output_table,
            },
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }


```

### 這段程式碼的關鍵改變：

1. **完全沒有 `data_processor**`：你在這個類別裡面找不到任何 `.populate_cell` 或是 `.set_cell_style`。
2. **依賴注入**：原本依賴 `RPT_2_VARS` 的常數（如 `TOTALS_TABLE_ROWS` 和 `GROUPED_PLANS`），現在透過 `__init__` 傳入，符合我們之前討論的架構規範。
3. **資料流向清晰**：`_process_spouse_data` 算完之後，把 title、清理好的 DataFrame、Totals 更新值和 Adjustments 統統打包回傳給主函數統整。

如果這個結構你覺得清晰且合理，我們下一步就可以把 `DEATH_DATA`、`RETIREMENT_DATA` 等其他邏輯，依樣畫葫蘆做成 `_process_death_data` 等獨立函數。完成後，我們再去寫專門負責畫 Excel 的 `ReportRenderingService`。

你可以先檢視這段邏輯有沒有少掉你截圖裡面的任何業務規則。
