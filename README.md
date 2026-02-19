import pandas as pd

def compare_excel_reports(old_file_path: str, new_file_path: str):
    print(f"🔍 Starting Excel file comparison...")
    print(f"Old Version (Expected): {old_file_path}")
    print(f"New Version (Actual):   {new_file_path}\n")

    try:
        old_excel = pd.ExcelFile(old_file_path)
        new_excel = pd.ExcelFile(new_file_path)
    except Exception as e:
        print(f"❌ Failed to read files: {e}")
        return False

    # 1. Compare Sheet Names
    old_sheets = old_excel.sheet_names
    new_sheets = new_excel.sheet_names
    
    if old_sheets != new_sheets:
        print(f"❌ Sheet names do not match!")
        print(f"Old Sheets: {old_sheets}")
        print(f"New Sheets: {new_sheets}")
        return False
    
    print("✅ Sheet names match perfectly.")
    all_match = True

    # 2. Compare Data sheet by sheet
    for sheet in old_sheets:
        print(f"\n📊 Checking sheet: '{sheet}'...")
        
        # Read Data (cast everything to string to avoid float/int precision issues)
        df_old = pd.read_excel(old_excel, sheet_name=sheet, dtype=str).fillna("")
        df_new = pd.read_excel(new_excel, sheet_name=sheet, dtype=str).fillna("")
        
        # Check Shape (rows and columns)
        if df_old.shape != df_new.shape:
            print(f"❌ Shape mismatch! Old: {df_old.shape}, New: {df_new.shape}")
            all_match = False
            continue
            
        # Check if content is exactly the same
        if df_old.equals(df_new):
            print(f"✅ Sheet '{sheet}' data is 100% identical!")
        else:
            print(f"❌ Data differences found in sheet '{sheet}'!")
            all_match = False
            
            # Use compare() to find exact row/col differences
            try:
                diff = df_old.compare(df_new)
                print(f"🔍 Difference details (Old vs New) [Showing top 10 rows]:\n{diff.head(10)}")
            except ValueError:
                print("⚠️ Cannot generate detailed comparison (Column names or Index might differ).")

    print("\n" + "="*50)
    if all_match:
        print("🎉 SUCCESS! The data in both Excel files is [PERFECTLY IDENTICAL]!")
    else:
        print("⚠️ WARNING: Data differences found. Please check the logs above.")
    print("="*50)

# ==========================================
# Usage: Replace with your actual file paths
# ==========================================
if __name__ == "__main__":
    OLD_REPORT_PATH = r"C:\path\to\your\original_report_from_production.xlsx"
    NEW_REPORT_PATH = r"C:\path\to\your\newly_generated_report.xlsx"
    
    compare_excel_reports(OLD_REPORT_PATH, NEW_REPORT_PATH)
