非常好，我們乘勝追擊！接下來我們來處理 `RETIREMENT_DATA` (2.4) 和 `EX_SPOUSE_DATA` (2.5) 這兩個區塊。

這兩個區塊的邏輯非常典型，`RETIREMENT_DATA` 牽涉到跟 `ongoing_payments` 的合併與 Retro 計算；而 `EX_SPOUSE_DATA` 則有比較特別的 ID 字尾判斷 (endswith "4") 和雙重 Flagging 邏輯 (OR logic)。

請將以下兩個方法加入你的 `PlanBusinessRuleService` 類別中（放在 `_process_death_data` 下面）：

### 1. 加入處理邏輯方法

```python
    def _process_retirement_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, ongoing_payments_df: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.4 RETIREMENT DATA LOGIC
        """
        table_title = "Retirement of Deferred, Pension in Payment"
        output_table["Payment Amount"] = raw_table["New Pension Amount"].astype(float)

        # Add plan commencement column from benplus_master_data
        output_table = add_commencement_column(output_table, benplus_master_data)
        
        # Aggregate ongoing_payments_df to get the most recent commencement date
        commencement_column = "TPSUBDTE"
        user_id = "TPEENO"
        agg_df = (
            ongoing_payments_df
            .groupby(user_id, as_index=False)[commencement_column]
            .max()
            .rename(columns={commencement_column: "Commencement"})
        )

        # Merge aggregated data
        output_table = output_table.merge(agg_df, left_on="ID", right_on=user_id, how="left").drop(columns=[user_id])
        
        # Make sure date formatting for commencement matches
        output_table = update_df_col_date_format(output_table, col="Commencement")

        # Logic to change flag in output table given expected status code change in benplus
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="4", current_required="25")

        # Add sum to totals table
        totals_updates = {
            "Retirement of Deferred, pension in payment": output_table["Payment Amount"].astype(float).sum()
        }

        # Calculate adjustments for RETIREMENT_DATA
        adjustments_list = []
        for _, row in output_table.iterrows():
            start_date = None
            retro_start_date = pd.to_datetime(row.get("Commencement"), errors="coerce")
            plan_commencement_date = pd.to_datetime(row.get("commencement_benplus"), errors="coerce")
            
            if pd.notna(retro_start_date) and pd.notna(plan_commencement_date):
                date_to_compare = max(retro_start_date, plan_commencement_date)
                adjustment = calculate_over_retro_payment(float(row["Payment Amount"]), reporting_period, date_to_compare, is_over=False)
                start_date = date_to_compare
            else:
                adjustment = 0.0

            period_str = get_period_range_string(reporting_period, start_date) if start_date else ""
            
            adjustments_list.append({
                "FN": row.get("FN", ""),
                "LN": row.get("LN", ""),
                "ID": row.get("ID", ""),
                "Adjustments": adjustment,
                "Comments": f"Retirement of Deferred, Pension in Payment. Retro for {period_str}"
            })

        adjustments_df = pd.DataFrame(adjustments_list)

        # Remove commencement col from yellow table
        output_table = output_table.drop(columns=["commencement_benplus"], errors="ignore")

        return {
            "table_info": {
                "title": table_title,
                "df": output_table,
            },
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

    def _process_ex_spouse_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.5 EX-SPOUSE LOGIC
        """
        table_title = "Pension Reduction: Marriage Breakdown"
        output_table["Amount"] = raw_table["New Pension Amount"].astype(float)

        # Create a copy of the output table with original master IDs to perform validation
        master_ids = output_table.copy()
        
        # Logic to change flag in output table given expected status code change in benplus
        # If status for main master did not change changes from 13 -> 13
        master_ids = benplus_status_month_compare(master_ids, benplus_master_data, reporting_period, prev_required="13", current_required="13")

        # Set yellow table id value to recipient id after benplus verifications
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        # Unflag all recipient ids that end with 4
        output_table.loc[output_table["ID"].astype(str).endswith("4"), "FLAG"] = False

        # Reflag any flags in output table that do not have the BENPLUS master status of 10
        output_table = benplus_flag_by_column(
            output_table, 
            benplus_master_data, 
            reporting_period, 
            column_name="STATUS", 
            expected_value="10", 
            set_flag_val=True, 
            not_equal=True
        )

        # Update flags in output table to have the OR of the logic for the ex-spousal master flagging and original
        # Note: Assuming or_output_table_flags is imported from your helper methods
        output_table["FLAG"] = or_output_table_flags(output_table, master_ids)

        # Add sum to totals table
        totals_updates = {
            "Pension Reduction: Marriage Breakdown": output_table["Amount"].astype(float).sum()
        }

        # EX_SPOUSE does not seem to generate any adjustments based on the screenshots
        adjustments_df = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])

        return {
            "table_info": {
                "title": table_title,
                "df": output_table,
            },
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

```

### 2. 將邏輯接入主流程

接著，回到你的 `process_all_business_rules`，解開註解並加入這兩個新的 `change_reason`：

```python
            # ... previous routing ...
            elif change_reason == "DEATH_DATA":
                result = self._process_death_data(output_table, table, recent_benplus_master, recent_benplus_spouse, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "RETIREMENT_DATA":
                result = self._process_retirement_data(output_table, table, benplus_master_data, ongoing_payments_df, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "EX_SPOUSE_DATA":
                result = self._process_ex_spouse_data(output_table, table, benplus_master_data, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])
            
            # elif change_reason == "ACTIVE_DATA":
            #     ...

```

你可以看到，我們的架構設計發揮了極大的威力：主迴圈永遠保持乾淨，只負責「分配工作」和「收集結果」。

處理完這段之後，接下來的區塊是 `LUMP_SUM_DATA` (2.8)、`BRIDGE_DATA` (2.9) 和 `PAYMENT_CHANGE_DATA` (2.10)。你隨時準備好我們就繼續前進！
