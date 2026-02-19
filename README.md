import pandas as pd
from pathlib import Path

def test_report_2_data_parity():
    """
    Regression test to ensure the newly generated Report 2 matches the baseline exactly.
    """
    # 1. Resolve paths dynamically
    current_dir = Path(__file__).parent.resolve()
    expected_path = current_dir / "test_data" / "expected" / "expected_report.xlsx"
    actual_path = current_dir / "test_data" / "actual" / "actual_report.xlsx"

    # 2. Assert files exist
    assert expected_path.exists(), f"Baseline file missing: {expected_path}"
    assert actual_path.exists(), f"Generated file missing: {actual_path}"

    # 3. Load Excel files
    expected_excel = pd.ExcelFile(expected_path)
    actual_excel = pd.ExcelFile(actual_path)

    # 4. Assert sheet names are identical
    assert expected_excel.sheet_names == actual_excel.sheet_names, \
        f"Sheet names mismatch. Expected: {expected_excel.sheet_names}, Actual: {actual_excel.sheet_names}"

    # 5. Assert data within each sheet is identical
    for sheet in expected_excel.sheet_names:
        # Cast to string and handle NaNs to focus strictly on visible values
        df_expected = pd.read_excel(expected_excel, sheet_name=sheet, dtype=str).fillna("")
        df_actual = pd.read_excel(actual_excel, sheet_name=sheet, dtype=str).fillna("")

        # Assert shape first for a clearer error message if row/col counts differ
        assert df_expected.shape == df_actual.shape, \
            f"Shape mismatch in sheet '{sheet}'. Expected: {df_expected.shape}, Actual: {df_actual.shape}"

        # Pandas built-in testing utility: throws a detailed diff if DataFrames don't match
        pd.testing.assert_frame_equal(
            df_expected, 
            df_actual, 
            obj=f"Sheet '{sheet}'", 
            check_exact=True
        )
