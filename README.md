
def get_file_df(self, file_obj: File) -> pd.DataFrame:
        """
        Reads a single File object and returns it as a DataFrame.
        Used primarily for reading the trigger file.
        """
        self.logger.log_info(f"Reading file from abstract stream: {file_obj.filename}")
        
        # 直接將 File object 傳俾 ExcelReader
        excel_file = ExcelReader(self.logger, file_obj=file_obj, parquet_output_dir=self.output_path)
        
        # 透過 ExcelReader 攞 DataFrame
        return excel_file.get_as_df()
