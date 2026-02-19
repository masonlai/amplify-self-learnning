import pandas as pd
from pathlib import Path
import argparse
import sys

def compare_excel_reports(old_file_path: str, new_file_path: str) -> bool:
    print("="*60)
    print("🔍 Starting Excel Parity Check...")
    print(f"Expected (Old): {old_file_path}")
    print(f"Actual (New):   {new_file_path}")
    print("="*60 + "\n")

    try:
        old_excel = pd.ExcelFile(old_file_path)
        new_excel = pd.ExcelFile(new_file_path)
    except Exception as e:
        print(f"❌ ERROR: Failed to read Excel files. Details: {e}")
        return False

    old_sheets = old_excel.sheet_names
    new_sheets = new_excel.sheet_names
    
    if old_sheets != new_sheets:
        print("❌ ERROR: Sheet names mismatch!")
        print(f"Expected Sheets: {old_sheets}")
        print(f"Actual Sheets:   {new_sheets}")
        return False
    
    print("✅ Sheet names match perfectly.")
    all_match = True

    for sheet in old_sheets:
        print(f"\n📊 Validating sheet: '{sheet}'...")
        
        df_old = pd.read_excel(old_excel, sheet_name=sheet, dtype=str).fillna("")
        df_new = pd.read_excel(new_excel, sheet_name=sheet, dtype=str).fillna("")
        
        if df_old.shape != df_new.shape:
            print(f"❌ Shape mismatch! Expected: {df_old.shape}, Actual: {df_new.shape}")
            all_match = False
            continue
            
        if df_old.equals(df_new):
            print(f"✅ Sheet '{sheet}' is 100% identical.")
        else:
            print(f"❌ Data mismatch found in sheet '{sheet}'.")
            all_match = False
            
            try:
                diff = df_old.compare(df_new)
                print(f"🔍 Difference details (Expected vs Actual) [Top 10 rows]:\n{diff.head(10)}")
            except ValueError:
                print("⚠️ Cannot generate detailed comparison due to different column names or index.")

    print("\n" + "="*60)
    if all_match:
        print("🎉 SUCCESS: The actual report matches the expected baseline perfectly!")
    else:
        print("⚠️ WARNING: Parity check failed. Differences were found.")
    print("="*60)
    
    return all_match

if __name__ == "__main__":
    # Dynamically resolve the directory where this script is located
    current_dir = Path(__file__).parent.resolve()
    
    # Define default paths based on the recommended structure
    default_expected = current_dir / "test_data" / "expected" / "expected_report.xlsx"
    default_actual = current_dir / "test_data" / "actual" / "actual_report.xlsx"

    parser = argparse.ArgumentParser(description="Regression Parity Check for Excel Reports.")
    parser.add_argument("--expected", type=str, default=str(default_expected), 
                        help="Path to the expected (baseline) Excel file")
    parser.add_argument("--actual", type=str, default=str(default_actual), 
                        help="Path to the actual (newly generated) Excel file")
    
    args = parser.parse_args()
    
    expected_path = Path(args.expected)
    actual_path = Path(args.actual)

    # Validate file existence before running the comparison
    if not expected_path.exists():
        print(f"❌ ERROR: Expected file not found at:\n{expected_path}")
        sys.exit(1)
        
    if not actual_path.exists():
        print(f"❌ ERROR: Actual file not found at:\n{actual_path}")
        sys.exit(1)

    # Run the parity check
    is_success = compare_excel_reports(str(expected_path), str(actual_path))
    
    # Exit with code 1 if failed (useful for CI/CD pipelines)
    if not is_success:
        sys.exit(1)
