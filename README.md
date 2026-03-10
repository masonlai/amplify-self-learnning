
目前主要的業務邏輯和資料流都已經補齊了，這是一次很扎實的重構。

不過，在仔細比對你重構後的 UI 渲染層 (`ReportRenderingService`) 與原始代碼後，我發現還有**一個排版上的關鍵遺漏**，這會導致你的藍色表格（Adjustments Table）和黃色表格（Change Reason Tables）重疊。

在原始代碼中（Image 8，大約 471 行），藍色表格的起始欄位是動態計算的：如果沒有任何黃色表格資料，藍色表格從 `"AA"` 開始；如果有，為了避免重疊，會退後到 `"AH"` 開始。

但在你重構後的 `report_rendering_service.py` 裡面（Image 10，大約 46 行），你將 `adjustments_col = "AA"` 寫死了。

請按照以下步驟修正這個排版問題：

### 修正步驟：讓藍色表格動態避開黃色表格

**第一步：修改 `_render_adjustments_table` 的參數定義**

在 `report_rendering_service.py` 中，找到 `_render_adjustments_table` 方法（大約在 Image 10 的 37 行）。幫它新增一個 `start_col` 參數，並移除寫死的 `"AA"`：

```python
    def _render_adjustments_table(self, plan: str, adjustments_table: pd.DataFrame, start_col: str):
        # Draws the blue adjustments table and returns layout coordinates.
        
        self.logger.log_info(f"Creating adjustments table (blue) for plan: {plan}")
        
        if not adjustments_table.empty:
            adjustments_table = adjustments_table[adjustments_table["Adjustments"].astype(float) != 0]
            
        adjustments_col = start_col  # Use the passed column instead of hardcoded "AA"
        col_num = self.data_processor.excel_col_to_num(adjustments_col)
        adjustments_col_end = self.data_processor.num_to_excel_col(col_num + 4)
        
        # ... (keep the rest of the method exactly the same)

```

**第二步：在 `render_plan_report` 中動態計算起始欄位**

回到同一個檔案上面的 `render_plan_report` 進入點。我們需要判斷剛才處理的黃色表格有沒有資料，來決定要傳入 `"AA"` 還是 `"AH"`。

請將 `# 2. Render Blue Adjustments Table` 下方的呼叫方式修改成這樣：

```python
        # 2. Render Blue Adjustments Table
        adjustments_df = report_data.get("adjustments_table", pd.DataFrame())
        processed_yellow_tables = report_data.get("processed_yellow_tables", [])
        
        # Calculate adjustments_col dynamically to prevent overlapping
        has_yellow_data = any(not table_data.get("df", pd.DataFrame()).empty for table_data in processed_yellow_tables)
        adjustments_start_col = "AH" if has_yellow_data else "AA"
        
        adjustments_col, adjustments_col_end, adjusted_total_row = self._render_adjustments_table(
            plan, 
            adjustments_df, 
            start_col=adjustments_start_col
        )

```

改完這一步之後，排版邏輯也會和原版完全一致，不會再發生表格互相覆蓋的問題。

目前整體的重構拼圖應該已經完整了。你可以先跑一次測試，確認輸出的 Excel 報表格式和數據是否與原本一模一樣。測試後如果有遇到任何報錯，可以將錯誤訊息貼上來，我隨時幫你看。
