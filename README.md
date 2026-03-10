明白，我們一步一步來。我們現在只專注在 `PlanBusinessRuleService` (檔案：`plan_business_rule_service.py`) 裡面把遺漏的資料處理邏輯加回去，確保跑出來的 DataFrame 結構和原本一模一樣。

### 第一步：把遺漏的邏輯寫成一個獨立的方法

請在 `PlanBusinessRuleService` 類別裡面，新增下面這個 `_finalize_table_data` 函數。你可以把它放在檔案的最下面（緊接在其他 `_process_xxx_data` 函數之後）：

```python
    def _finalize_table_data(self, output_table: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period: str) -> dict:
        flagged_rows = []
        
        if len(output_table) > 0:
            if "FLAG" in output_table.columns:
                mask_unflagged_values = output_table["FLAG"] == False
                
                output_table.loc[mask_unflagged_values] = benplus_flag_by_column(
                    output_table.loc[mask_unflagged_values],
                    benplus_table=benplus_master_data,
                    reporting_time=reporting_period,
                    column_name="BUYINOUT",
                    expected_value="1",
                    set_flag_val=True,
                    not_equal=True
                )
                
                flagged_rows = output_table.index[output_table["FLAG"] == True].tolist()
            
            output_table = output_table.drop(columns=["FLAG", "CHANGE_REASON"], errors="ignore")
            
            if len(output_table.columns) < 6:
                output_table = output_table.reindex(
                    columns=list(output_table.columns) + [None] * max(0, 6 - output_table.shape[1])
                )
                
        return {
            "df": output_table,
            "flagged_rows": flagged_rows
        }

```

### 第二步：修改 `_process_death_data` 的結尾

找到 `_process_death_data` 函數的最下方（參考你上傳的 Image 12，大約在 line 391 附近）。

**原本你的寫法是：**

```python
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

**請將這段改成：**

```python
        output_table = output_table.drop(columns=["Comments", "commencement_benplus"], errors="ignore")

        finalized_data = self._finalize_table_data(output_table, recent_benplus_master, reporting_period)

        return {
            "table_info": {
                "title": table_title,
                "df": finalized_data["df"],
                "flagged_rows": finalized_data["flagged_rows"]
            },
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

```

### 第三步：修改 `_process_spouse_data` 的結尾

找到 `_process_spouse_data` 函數的最下方（參考你上傳的 Image 13，大約在 line 260 附近）。

**原本你的寫法是：**

```python
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

**請將這段改成：**

```python
        output_table = output_table.drop(columns=["commencement_benplus"], errors="ignore")

        finalized_data = self._finalize_table_data(output_table, recent_benplus_master, reporting_period)

        return {
            "table_info": {
                "title": table_title,
                "df": finalized_data["df"],
                "flagged_rows": finalized_data["flagged_rows"]
            },
            "totals_updates": totals_updates,
            "adjustments_df": adjustments_df
        }

```

### 第四步：把同樣的改動套用到剩下的所有 `_process_xxx_data`

你需要對以下這幾個函數做**與第二、第三步完全相同的修改**（在 return 之前呼叫 `_finalize_table_data`，並更新 return 字典）：

1. `_process_retirement_data` (記得傳入 `recent_benplus_master`)
2. `_process_ex_spouse_data` (記得傳入 `benplus_master_data`)
3. `_process_lump_sum_data` (記得傳入 `benplus_master_data`)
4. `_process_bridge_data` (這一個函數你可能需要傳入 `inpay_df` 或者是空 DataFrame，因為它似乎不依賴 benplus_master，但為了函數簽名一致，你可以傳入 `benplus_master_data` 即使它沒用到)
5. `_process_payment_change_data`
6. `_process_guaranteed_payment_end_data`
7. `_process_retirement_temp_expiry_data`
8. `_process_spouse_ben_end_of_guarantee_data`

請先完成這四步。做完之後，`PlanBusinessRuleService` 產生的 `df` 結構就會和原來完全相同，而且會多帶出一個 `flagged_rows`。

完成後請告訴我，我再教你最後一步：如何在 `ReportRenderingService` 裡把 `flagged_rows` 塗成紅色。
