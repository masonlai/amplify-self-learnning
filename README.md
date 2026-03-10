進度非常好！既然我們已經掌握了節奏，而且接下來的幾個 `change_reason` 邏輯比較短且單純，我們可以一口氣把它們全部處理完。

根據你提供的截圖，這包含了 2.8 到 2.13 的所有邏輯。請將以下這 6 個方法一次過貼到 `PlanBusinessRuleService` 裡面：

### 1. 實作剩餘的商業邏輯 (2.8 到 2.13)

```python
    def _process_lump_sum_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.8 LUMP SUM DATA LOGIC
        """
        table_title = "Lump Sum"
        output_table["Amount"] = raw_table["Lump Sum Insurance Contract"].astype(float)
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        # Logic to change flag in output table given expected status code change in benplus
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="4", current_required="5")
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="4", current_required="25")

        # Lump sum does not add to totals_dict in the original code
        totals_updates = {}

        # Lump Sum adjustment (simple)
        adjustments_list = []
        for _, row in output_table.iterrows():
            adjustment = float(row["Amount"]) if pd.notna(row["Amount"]) else 0.0
            adjustments_list.append({
                "FN": row.get("FN", ""),
                "LN": row.get("LN", ""),
                "ID": row.get("ID", ""),
                "Adjustments": adjustment,
                "Comments": "Lump Sum"
            })

        adjustments_df = pd.DataFrame(adjustments_list)

        return {
            "table_info": {"title": table_title, "df": output_table},
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

    def _process_bridge_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, inpay_df: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.9 BRIDGE DATA LOGIC
        """
        table_title = "Bridge Expiry"
        output_table["Bridge Amount"] = raw_table["Previous Pension Amount"].astype(float) - raw_table["New Pension Amount"].astype(float)

        # Do inpay validation
        output_table = inpay_date_col_flagging(output_table, inpay_df, reporting_period, date_col="TPSTOP")
        output_table.rename(columns={"TPSTOP": "Bridge Expiry Date"}, inplace=True)
        
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        totals_updates = {
            "Bridge Expiry": output_table["Bridge Amount"].sum()
        }
        
        adjustments_df = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])

        return {
            "table_info": {"title": table_title, "df": output_table},
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

    def _process_payment_change_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.10 PAYMENT CHANGE LOGIC
        """
        table_title = "Payment Changes"
        output_table["Amount"] = raw_table["New Pension Amount"].astype(float) - raw_table["Previous Pension Amount"].astype(float)
        
        # Set yellow table id value to recipient id
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        totals_updates = {
            "Payment Change": output_table["Amount"].astype(float).sum()
        }
        
        adjustments_df = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])

        return {
            "table_info": {"title": table_title, "df": output_table},
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

    def _process_guaranteed_payment_end_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, inpay_df: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.11 GUARANTEED PAYMENT END LOGIC
        """
        table_title = "Guaranteed Payment Ended"
        output_table["Payment Amount"] = raw_table["New Pension Amount"].astype(float) - raw_table["Previous Pension Amount"].astype(float)

        # Do inpay validation
        output_table = inpay_date_col_flagging(output_table, inpay_df, reporting_period, date_col="TPSUAEND")
        
        totals_updates = {
            "Guarantee End (no further payment)": output_table["Payment Amount"].sum()
        }
        
        adjustments_df = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])

        return {
            "table_info": {"title": table_title, "df": output_table},
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

    def _process_retirement_temp_expiry_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.12 RETIREMENT TEMPORARY PAYMENT EXPIRY LOGIC
        """
        table_title = "Retirement, temporary payment expiry - no further payments"
        output_table["Payment Amount"] = raw_table["New Pension Amount"].astype(float) - raw_table["Previous Pension Amount"].astype(float)

        # If benplus status changes from 13 -> 32
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="13", current_required="32")
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        totals_updates = {
            "Retirement, temporary payment expiry - no further payments": output_table["Payment Amount"].sum()
        }
        
        adjustments_df = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])

        return {
            "table_info": {"title": table_title, "df": output_table},
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

    def _process_spouse_ben_end_of_guarantee_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:
        """
        Logic for 2.13 SPOUSE/BENEFICIARY END OF GUARANTEE LOGIC
        """
        table_title = "Spouse/Beneficiary, end of guarantee - no further payments"
        output_table["Payment Amount"] = raw_table["New Pension Amount"].astype(float) - raw_table["Previous Pension Amount"].astype(float)

        # If benplus status changes from 9 -> 33
        output_table = benplus_status_month_compare(output_table, benplus_master_data, reporting_period, prev_required="9", current_required="33")
        output_table["ID"] = raw_table["Recipient ID"].reset_index(drop=True)

        totals_updates = {
            "Spouse/Beneficiary, end of guarantee - no further payments": output_table["Payment Amount"].sum()
        }
        
        adjustments_df = pd.DataFrame(columns=["FN", "LN", "ID", "Adjustments", "Comments"])

        return {
            "table_info": {"title": table_title, "df": output_table},
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

```

### 2. 接回主流程 `process_all_business_rules`

請將以下程式碼加進你主流程的 `if-elif` 判斷樹中：

```python
            elif change_reason == "LUMP_SUM_DATA":
                result = self._process_lump_sum_data(output_table, table, benplus_master_data, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "BRIDGE_DATA":
                result = self._process_bridge_data(output_table, table, inpay_df, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "PAYMENT_CHANGE_DATA":
                result = self._process_payment_change_data(output_table, table, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "GUARANTEED_PAYMENT_END_DATA":
                result = self._process_guaranteed_payment_end_data(output_table, table, inpay_df, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "RETIREMENT_TEMP_PAYMENT_EXPIRY_DATA":
                result = self._process_retirement_temp_expiry_data(output_table, table, benplus_master_data, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

            elif change_reason == "SPOUSE_BEN_END_OF_GUARANTEE_DATA":
                result = self._process_spouse_ben_end_of_guarantee_data(output_table, table, benplus_master_data, reporting_period)
                if result:
                    report_data["processed_yellow_tables"].append(result["table_info"])
                    report_data["totals_dict"].update(result["totals_updates"])
                    report_data["adjustments_table_list"].append(result["adjustments_df"])

```

到目前為止，整個商業邏輯處理的部分已經快要拼圖完成了。剩下的就只有 `ACTIVE_DATA` (2.6) 和 `TRANSFERRED_DATA` (2.7)。

你需要我教你怎麼建立用來純畫 Excel 的 `ReportRenderingService` 嗎？還是我們要把最後兩個缺少的 Change Reason 也補完？
