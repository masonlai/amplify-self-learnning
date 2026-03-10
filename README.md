太棒了，我們現在就來把最複雜的 `DEATH_DATA` 區塊獨立出來。

這個區塊的邏輯非常密集，包含了很多不同的子狀態（例如 `mask_retiree_election_pending` 等等），以及特定的過度支付 (Overpayment) 計算邏輯。

請在你的 `PlanBusinessRuleService` 類別中，加入以下這個全新的 `_process_death_data` 私有函數。

### 1. 實作 `_process_death_data`

請將這段程式碼貼到 `PlanBusinessRuleService` 裡面（可以放在之前寫好的 `_process_spouse_data` 下方）：

```python
    def _process_death_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, recent_benplus_master: pd.DataFrame, recent_benplus_spouse: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.1 DEATH CHANGE LOGIC
        """
        table_title = "New Reported Deaths"
        output_table["Pension Amount"] = raw_table["Previous Pension Amount"].astype(float)

        # Join output table with benplus master and spouse data to pull DOD and DODNOTIF
        output_table = merge_benplus_death_data(recent_benplus_master, recent_benplus_spouse, output_table)

        # Get data subsets for each type of death change
        mask_retiree_election_pending = output_table["CHANGE_REASON"] == "Death of retiree, election pending"
        mask_deferred_deferred_spousal_pension = output_table["CHANGE_REASON"] == "Death, Deferred spousal pension"
        mask_deferred_finalization_pending = output_table["CHANGE_REASON"] == "Death of Deferred, finalization pending"
        mask_deferred_paid_out = output_table["CHANGE_REASON"] == "Death of Deferred, paid out"
        mask_retiree_paid_out = output_table["CHANGE_REASON"] == "Death of retiree, paid out"
        mask_retiree_no_further_payments = output_table["CHANGE_REASON"] == "Deceased, no further payments"
        mask_retiree_and_spouse_setup = output_table["CHANGE_REASON"].str.contains(r"set[- ]?up", case=False, na=False)

        # Perform benplus validation on each death reason subset in above defined masks
        output_table.loc[mask_retiree_election_pending] = benplus_status_month_compare(output_table.loc[mask_retiree_election_pending], recent_benplus_master, reporting_period, prev_required="13", current_required="8")
        output_table.loc[mask_deferred_deferred_spousal_pension] = benplus_status_month_compare(output_table.loc[mask_deferred_deferred_spousal_pension], recent_benplus_master, reporting_period, prev_required="4", current_required="14")
        output_table.loc[mask_deferred_finalization_pending] = benplus_status_month_compare(output_table.loc[mask_deferred_finalization_pending], recent_benplus_master, reporting_period, prev_required="4", current_required="24")
        output_table.loc[mask_deferred_paid_out] = benplus_status_month_compare(output_table.loc[mask_deferred_paid_out], recent_benplus_master, reporting_period, prev_required="4", current_required="27")
        output_table.loc[mask_retiree_paid_out] = benplus_status_month_compare(output_table.loc[mask_retiree_paid_out], recent_benplus_master, reporting_period, prev_required="13", current_required="34")

        # For "Death of Retiree, no further payments": Check that STATUS == 12
        output_table.loc[mask_retiree_no_further_payments] = benplus_flag_by_column(output_table.loc[mask_retiree_no_further_payments], recent_benplus_master, reporting_period, column_name="STATUS", expected_value="12")

        # Set comment row for different death types to be tracked in adjustments table
        output_table.loc[mask_retiree_election_pending, "Comments"] = "Death of retiree, election pending #2.1.1"
        output_table.loc[mask_retiree_no_further_payments, "Comments"] = "Death of Retiree, no further payments #2.1.2"
        output_table.loc[mask_deferred_deferred_spousal_pension, "Comments"] = "Death, Deferred spousal pension #2.1.3"
        output_table.loc[mask_deferred_finalization_pending, "Comments"] = "Death of Deferred, finalization pending #2.1.4"
        output_table.loc[mask_deferred_paid_out, "Comments"] = "Death of Deferred, paid out #2.1.5"
        output_table.loc[mask_retiree_paid_out, "Comments"] = "Death of retiree, paid out #2.1.6"
        output_table.loc[mask_retiree_and_spouse_setup, "Comments"] = "Death of retiree and survivor set-up #2.1.7"

        # Special case for survivor setup
        for idx, row in output_table.loc[mask_retiree_and_spouse_setup].iterrows():
            expected_death_logic = check_benplus_status_single_row(recent_benplus_master, row["ID"], reporting_period, prev_required="13", current_required="8")
            if not expected_death_logic:
                rule_1 = check_benplus_status_single_row(recent_benplus_master, row["ID"], reporting_period, prev_required="13", current_required="9")
                rule_2 = check_benplus_status_single_row(recent_benplus_master, row["ID"], reporting_period, prev_required="8", current_required="9")
                output_table.at[idx, "FLAG"] = not (rule_1 or rule_2)
            else:
                output_table.at[idx, "FLAG"] = False

        # DOD, DODNOTIF invalid values check
        output_table = death_outcome_table_flagging(output_table)

        # Add plan commencement column from benplus_master_data
        output_table = add_commencement_column(output_table, recent_benplus_master)

        # Set yellow table id value to recipient id after benplus verifications
        output_table = output_table.reset_index(drop=True)
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        # Add sum to totals table (Note: Negative sum for deaths)
        totals_updates = {
            "New Reported Deaths": -output_table["Pension Amount"].astype(float).sum()
        }

        # Set ID to Employee ID for survivor set-up rows for adjustment calculations
        output_table.loc[mask_retiree_and_spouse_setup, "ID"] = raw_table.loc[mask_retiree_and_spouse_setup, "Employee ID"]

        # Calculate adjustments for DEATH_DATA
        adjustments_list = []
        for _, row in output_table.iterrows():
            start_date = None
            dod = pd.to_datetime(row.get("DOD"), errors="coerce")
            plan_commencement_date = pd.to_datetime(row.get("commencement_benplus"), errors="coerce")
            
            if pd.notna(dod) and pd.notna(plan_commencement_date):
                date_to_compare = max(dod, plan_commencement_date)
                adjustment = -calculate_over_retro_payment(float(row["Pension Amount"]), reporting_period, date_to_compare, is_over=True)
                start_date = (date_to_compare.to_period("M") + 1).to_timestamp()
            else:
                adjustment = 0.0

            period_str = get_period_range_string(reporting_period, start_date) if start_date else ""
            base_comment = row.get("Comments", "")
            final_comment = f"{base_comment}. Overpayment for {period_str}" if base_comment else f"Overpayment for {period_str}"
            
            adjustments_list.append({
                "FN": row.get("FN", ""),
                "LN": row.get("LN", ""),
                "ID": row.get("ID", ""),
                "Adjustments": adjustment,
                "Comments": final_comment
            })

        adjustments_df = pd.DataFrame(adjustments_list)

        # Remove comments and commencement col from yellow table
        output_table = output_table.drop(columns=["Comments", "commencement_benplus"], errors="ignore")

        return {
            "table_info": {
                "title": table_title,
                "df": output_table,
            },
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

```

### 2. 解開註解並整合

現在，回到你剛才拍給我看、有藍色反白的那個主流程 `process_all_business_rules` 裡面，將佔位符替換為真正的邏輯：

```python
            # Route to specific logic handlers
            if change_reason == "SPOUSE_DATA":
                result = self._process_spouse_data(output_table, table, benplus_master_data, ongoing_payments_df, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])
                    
            elif change_reason == "DEATH_DATA":
                result = self._process_death_data(output_table, table, recent_benplus_master, recent_benplus_spouse, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])
            
            # elif change_reason == "RETIREMENT_DATA":
            #     ...

```

你可以仔細對比一下，所有的 Pandas 運算（合併、過濾、欄位格式化、金額加減）都保留得一字不漏，但我們徹底切斷了與 Excel 的牽連。

需要我接著給你提供下一個 `RETIREMENT_DATA` (2.4) 和 `EX_SPOUSE_DATA` (2.5) 的處理函數嗎？
