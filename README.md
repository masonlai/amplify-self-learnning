沒問題，我們一步一步來。

在進行第四步時，有一個細節需要處理：原本的 `BUYINOUT` 驗證邏輯需要讀取 `BENPLUS` 資料（也就是 `benplus_master_data`），但你在拆分函數時，有三個函數（Bridge, Payment Change, Guaranteed Payment End）並沒有把 `benplus_master_data` 傳進去。

為了讓驗證邏輯能順利執行，我們分為兩個部分來改：**A. 直接修改 return 的函數**，以及 **B. 需要補上參數的函數**。

請按照以下具體指示修改 `plan_business_rule_service.py`。

---

### A. 直接替換 return 區塊的函數

針對這四個函數，它們已經有 `benplus_master_data` 或 `recent_benplus_master`，你只需要找到函數最下方的 `return` 區塊，直接用下面的代碼替換掉。

**1. `_process_retirement_data**`
替換函數最後面的 `return` 區塊（並清理 `commencement_benplus`）：

```python
        output_table = output_table.drop(columns=["commencement_benplus"], errors="ignore")

        # Apply final table formatting and validation
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

**2. `_process_ex_spouse_data**`
**3. `_process_lump_sum_data**`
**4. `_process_retirement_temp_expiry_data**`
**5. `_process_spouse_ben_end_of_guarantee_data**`

以上四個函數的改法完全一樣。請找到它們最下方的 `return`，替換成以下代碼：

```python
        # Apply final table formatting and validation
        finalized_data = self._finalize_table_data(output_table, benplus_master_data, reporting_period)

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

---

### B. 需要補上參數的函數

有三個函數原本的 signature (參數定義) 沒有 `benplus_master_data`。你需要先在函數定義補上參數，再修改 return 區塊，最後更新主迴圈的呼叫方式。

**1. `_process_bridge_data**`
將函數第一行定義修改為：

```python
    def _process_bridge_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, inpay_df: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:

```

替換最下方的 `return`：

```python
        # Apply final table formatting and validation
        finalized_data = self._finalize_table_data(output_table, benplus_master_data, reporting_period)

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

**2. `_process_payment_change_data**`
將函數第一行定義修改為：

```python
    def _process_payment_change_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:

```

替換最下方的 `return`（使用與上方相同的 `finalized_data` 結構）。

**3. `_process_guaranteed_payment_end_data**`
將函數第一行定義修改為：

```python
    def _process_guaranteed_payment_end_data(self, output_table: pd.DataFrame, raw_table: pd.DataFrame, inpay_df: pd.DataFrame, benplus_master_data: pd.DataFrame, reporting_period) -> dict:

```

替換最下方的 `return`（使用與上方相同的 `finalized_data` 結構）。

---

### C. 更新主迴圈的呼叫 (process_all_business_rules)

因為你在 **B 部分** 幫三個函數增加了參數，現在你需要回到最上方的 `process_all_business_rules` 函數中的 `if/elif` 判斷式，把 `benplus_master_data` 傳進去。

找到對應的 `elif` 區塊並修改成這樣：

```python
        elif change_reason == "BRIDGE_DATA":
            result = self._process_bridge_data(output_table, table, inpay_df, benplus_master_data, reporting_period)
            # ... 下方 if result 區塊不動
            
        elif change_reason == "PAYMENT_CHANGE_DATA":
            result = self._process_payment_change_data(output_table, table, benplus_master_data, reporting_period)
            # ... 下方 if result 區塊不動
            
        elif change_reason == "GUARANTEED_PAYMENT_END_DATA":
            result = self._process_guaranteed_payment_end_data(output_table, table, inpay_df, benplus_master_data, reporting_period)
            # ... 下方 if result 區塊不動

```

完成這些步驟後，這部分就完全補齊了。請告訴我你是否順利改完，我們再接續修改 `ReportRenderingService` 的部分。
