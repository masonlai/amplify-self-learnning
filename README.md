def execute_ingestion_pipeline(self, validate_files_func):
        resolved_files = self.input_resolver.resolve()
        
        # 1. Identify trigger file
        trigger_files = [f for f in resolved_files if self.rpt_2_vars.TRIGGER_FILE in f.filename]
        if len(trigger_files) == 0:
            self.logger.log_error(f"Trigger file '{self.rpt_2_vars.TRIGGER_FILE}' not found!")
            raise FileNotFoundError(f"Missing trigger file: {self.rpt_2_vars.TRIGGER_FILE}")
        if len(trigger_files) > 1:
            raise RuntimeError(f"Multiple trigger files found.")
            
        trigger_file = trigger_files[0]

        # 2. Extract reporting period
        reporting_period = self._extract_reporting_period(trigger_file)

        # 3. Validate files
        self.logger.log_info("Proceeding with validation...")
        validate_files_func(self.logger, resolved_files, reporting_period)

        # 4. Execute data ingestion
        self._ingest_all_files(trigger_file, resolved_files, reporting_period)

        return reporting_period

    # --- Private Helper Methods ---

    def _extract_reporting_period(self, trigger_file):
        try:
            trigger_file_df = self.ingestion.get_file_df(file=trigger_file, output_dir=self.config.report_2_output_path)
            reporting_period = pd.to_datetime(
                trigger_file_df["period(YYYYMMDD)"].dropna().astype(int).astype(str),
                format="%Y%m%d"
            ).iloc[0]
            return reporting_period
        except Exception as e:
            self.logger.log_error(f"Unable to extract reporting period from trigger file with error: {e}")
            raise e

    def _ingest_all_files(self, trigger_file, resolved_files, reporting_period):
        self.logger.log_info("Beginning file append to parquet")
        
        report_files = [f for f in resolved_files if "Buy-in Payroll" in f.filename]
        inpay_file = next((f for f in resolved_files if "INPAY" in f.filename), None)
        benplus_master_file = next((f for f in resolved_files if "MASTER" in f.filename), None)
        benplus_spouse_file = next((f for f in resolved_files if "SPOUSE" in f.filename), None)

        # Append Trigger and Report files
        self.ingestion.append_excel_file_to_parquet(
            [trigger_file], self.rpt_2_vars.TRIGGER_FILE_PARQUET, self.config.report_2_output_path
        )
        self.ingestion.append_excel_file_to_parquet(
            report_files, self.rpt_2_vars.DATA_PARQUET_FILE_LIST, self.config.report_2_output_path, self.rpt_2_vars.SHEET_HEADER_ROWS
        )

        # Append CSV reference files
        if inpay_file:
            self.logger.log_info("INPAY file exists in data landing zone")
            self.ingestion.append_csv_file_to_parquet(inpay_file, self.rpt_2_vars.INPAY_PARQUET, self.config.report_2_output_path, reporting_period)
            
        if benplus_master_file:
            self.logger.log_info("BENPLUS MASTER file exists")
            self.ingestion.append_csv_file_to_parquet(benplus_master_file, self.rpt_2_vars.BEN_PLUS_MASTER_PARQUET, self.config.report_2_output_path, reporting_period)
            
        if benplus_spouse_file:
            self.logger.log_info("BENPLUS SPOUSE file exists")
            self.ingestion.append_csv_file_to_parquet(benplus_spouse_file, self.rpt_2_vars.BEN_PLUS_SPOUSE_PARQUET, self.config.report_2_output_path, reporting_period)
