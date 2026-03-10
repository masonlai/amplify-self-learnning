
這個 test 拋出的錯誤訊息非常有價值，它直接指出了問題的核心：**你的 Refactored 版本 (Actual) 渲染到了第 38 個欄位 (也就是 Excel 的 `AL` 欄)，但是原本的版本 (Expected) 只渲染到第 31 個欄位 (也就是 `AE` 欄)。**

多出來的這 7 個欄位，恰好等於你將藍色 Adjustments 表格從 `AA` 移動到 `AH` 所產生的位移 (剛好差 7 欄)。這表示：**在這個 specific sheet 中，原版代碼判定「沒有黃色資料」所以放在 `AA`，但你的重構版本卻判定「有黃色資料」所以推到了 `AH`。**

你截圖裡 highlight 的那段判斷邏輯方向是對的，但有兩個地方我們必須立刻修正與驗證：

### 1. 修復 `_render_historic_totals_grey_table` 裡的 Hardcode Bug

我注意到在你之前的截圖 (Image 19, 第 75 行)，你在畫灰色 Totals 表格時，不小心把 `AA` 寫死了：

```python
col_num = self.data_processor.excel_col_to_num("AA") + 3

```

這會導致不管藍色表格在哪，灰色表格永遠畫在 `AD`，這會引發嚴重的版面重疊。

**請修改 `_render_historic_totals_grey_table`：**

1. 在函數參數中加上 `adjustments_col: str`。
2. 將第 75 行的 `"AA"` 換成 `adjustments_col`。

```python
def _render_historic_totals_grey_table(self, plan: str, totals_dict: dict, adjusted_total_row: int, adjustments_col: str):
    ...
    col_num = self.data_processor.excel_col_to_num(adjustments_col) + 3

```

*(記得在 `render_plan_report` 呼叫它的地方，把 `adjustments_col` 傳進去)*

### 2. 驗證 `has_yellow_data` 到底看到了什麼鬼東西

雖然你的 `has_yellow_data` 寫法沒有語法錯誤，但因為資料處理過後可能產生了「有 DataFrame 結構但內容是空的」或者「只有 `None`」的邊界情況，導致它誤判為 `True`。

請在你剛才 highlight 的那行代碼下面，**加上這兩行 print**：

```python
        has_yellow_data = any(not table_data.get("df", pd.DataFrame()).empty for table_data in processed_yellow_tables)
        
        # 加在這裡幫忙 debug
        if has_yellow_data:
            print(f"\n[DEBUG] Plan {plan} HAS yellow data! Length of processed list: {len(processed_yellow_tables)}")
            for t in processed_yellow_tables:
                print(f"[DEBUG] Table Title: {t.get('title')}, Empty? {t.get('df').empty}, Shape: {t.get('df').shape}")

        adjustments_start_col = "AH" if has_yellow_data else "AA"

```

**下一步：**
請照著上面改完後，**再跑一次 test**。
如果 test 還是 fail，請把 console 裡印出來的 `[DEBUG]` 訊息截圖或貼給我看。只要看到到底是什麼 table 沒有被判定為 `.empty`，我們就能一擊斃命解決這個 parity 問題。
