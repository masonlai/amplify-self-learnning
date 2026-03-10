import pandas as pd
import report_2.report_2_ingestion_constants as RPT_2_VARS

class ReportRenderingService:
    def __init__(self, logger, data_processor):
        self.logger = logger
        self.data_processor = data_processor

    def render_plan_report(self, plan: str, report_data: dict):
        """
        Main entry point. Coordinates the drawing of all tables and formatting.
        """
        self.logger.log_info(f"Rendering report for plan: {plan}")
        
        # 1. Render Yellow Tables (To be implemented when yellow table logic is extracted)
        # current_row = self._render_change_reason_tables(plan, report_data.get("processed_yellow_tables", []), 3)
        
        # 2. Render Blue Adjustments Table
        adjustments_df = report_data.get("adjustments_table", pd.DataFrame())
        adjustments_col, adjustments_col_end, adjusted_total_row = self._render_adjustments_table(plan, adjustments_df)

        # 3. Render Grey Totals Table
        totals_dict = report_data.get("totals_dict", {})
        total_col, total_end_col = self._render_historic_totals_grey_table(plan, totals_dict, adjusted_total_row)

        # 4. Render Final Totals Cell
        adjusted_total = report_data.get("adjusted_total", 0.0)
        self._render_final_totals_cell(plan, adjusted_total, adjustments_col, adjusted_total_row, total_col, totals_dict)

        # 5. Apply Global Formatting
        # Fallback to 1000 if the length is not provided in report_data yet
        ongoing_payments_len = report_data.get("ongoing_payments_len", 1000) 
        self._apply_global_formatting(plan, ongoing_payments_len)

    def _render_adjustments_table(self, plan: str, adjustments_table: pd.DataFrame):
        """
        Draws the blue adjustments table and returns layout coordinates.
        """
        self.logger.log_info(f"Creating adjustments table (blue) for plan: {plan}")

        if not adjustments_table.empty:
            adjustments_table = adjustments_table[adjustments_table["Adjustments"].astype(float) != 0]

        adjustments_col = "AA"
        col_num = self.data_processor.excel_col_to_num(adjustments_col)
        adjustments_col_end = self.data_processor.num_to_excel_col(col_num + 4)

        self.data_processor.write_table_with_title(
            sheet_name=plan, 
            start_cell=f"{adjustments_col}3", 
            title="Adjustments", 
            output_table_df=adjustments_table
        )

        color_range = (f"{adjustments_col}2", f"{adjustments_col_end}{len(adjustments_table) + 3}")
        self.data_processor.color_table_in_report(
            plan, 
            RPT_2_VARS.TABLE_COLOR_MAP["adjustments"], 
            cell_range=color_range
        )

        adjusted_total_row = max(6, len(adjustments_table) + 6)
        return adjustments_col, adjustments_col_end, adjusted_total_row

    def _render_historic_totals_grey_table(self, plan: str, totals_dict: dict, adjusted_total_row: int):
        """
        Draws the grey historic totals table and applies formatting.
        """
        self.logger.log_info(f"Creating final totals (grey) table for plan: {plan}")
        
        table_title = "Reconciliation from Last Month Wire Transfer to Current Month Wire Transfer"
        totals_df = pd.DataFrame([(v, k) for k, v in totals_dict.items()], columns=["Totals", "Reason for change"])
        
        col_num = self.data_processor.excel_col_to_num("AA") + 3
        total_col = self.data_processor.num_to_excel_col(col_num)
        total_end_col = self.data_processor.num_to_excel_col(col_num + 4)

        self.data_processor.write_table_with_title(
            sheet_name=plan, 
            start_cell=f"{total_col}{adjusted_total_row + 3}", 
            title=table_title, 
            output_table_df=totals_df
        )

        color_range = (f"{total_col}{adjusted_total_row + 2}", f"{total_end_col}{adjusted_total_row + len(totals_df) + 3}")
        self.data_processor.color_table_in_report(
            plan, 
            RPT_2_VARS.TABLE_COLOR_MAP["totals"], 
            cell_range=color_range
        )

        amount_range = (f"AK{adjusted_total_row + 3}", f"AK{adjusted_total_row + len(totals_df) + 4}")
        self.data_processor.set_cell_range_number_format(plan, amount_range)

        return total_col, total_end_col

    def _render_final_totals_cell(self, plan: str, adjusted_total: float, adjustments_col: str, adjusted_total_row: int, total_col: str, totals_dict: dict):
        """
        Draws the final calculated cells and applies conditional red text flagging.
        """
        label_col_num = self.data_processor.excel_col_to_num(adjustments_col) + 3
        total_label_col = self.data_processor.num_to_excel_col(label_col_num)
        
        adjusted_total_cell = f"{total_col}{adjusted_total_row}"
        adjusted_total_label_cell = f"{total_label_col}{adjusted_total_row}"

        self.data_processor.populate_cell(plan, adjusted_total_cell, adjusted_total)
        
        single_cell_range = (adjusted_total_cell, adjusted_total_cell)
        self.data_processor.color_table_in_report(plan, RPT_2_VARS.TABLE_COLOR_MAP["total cell"], cell_range=single_cell_range)
        self.data_processor.set_cell_range_number_format(plan, cell_range=single_cell_range)
        
        self.data_processor.populate_cell(plan, adjusted_total_label_cell, value="Total Payment Amount for current month")
        self.data_processor.set_cell_style(plan, adjusted_total_cell, bold=True, size=14, color=RPT_2_VARS.TABLE_COLOR_MAP["total cell text"])
        self.data_processor.set_cell_style(plan, adjusted_total_label_cell, bold=True, size=13)

        totals_len = len(totals_dict)
        final_row = adjusted_total_row + totals_len + 4
        final_total_cell = f"{total_col}{final_row}"
        
        final_total = sum([float(v) for v in totals_dict.values()])
        self.data_processor.populate_cell(plan, final_total_cell, final_total)

        if round(adjusted_total, 2) != round(final_total, 2):
            self.data_processor.set_cell_style(plan, final_total_cell, color=RPT_2_VARS.TABLE_COLOR_MAP["flagged value"])
        
        final_cell_range = (final_total_cell, final_total_cell)
        self.data_processor.color_table_in_report(plan, RPT_2_VARS.TABLE_COLOR_MAP["totals"], cell_range=final_cell_range)
        self.data_processor.add_border_to_table_in_report(plan, cell_range=final_cell_range)

    def _apply_global_formatting(self, plan: str, ongoing_payments_len: int):
        """
        Applies dollar signs to ongoing payment columns and autofits all columns.
        """
        for col in RPT_2_VARS.ONGOING_PAYMENTS_COLS_TO_MAKE_DOLLARS:
            amount_range = (f"{col}2", f"{col}{ongoing_payments_len + 2}")
            self.data_processor.set_cell_range_number_format(plan, amount_range)

        self.data_processor.auto_fit_report_columns(plan, RPT_2_VARS.COLUMNS_FOR_AUTOMAPPING)
