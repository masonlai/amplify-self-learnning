
這是一份為你準備的英文 PR description。內容直接將那 49 個檔案標示為不需過度關注，並將 reviewer 的重點引導到真正有修改的核心架構檔案上。

你可以直接複製以下內容：

***

## Overview
This PR migrates Report 2 from the on-premise repository to the cloud repository, integrating it into the existing Azure Functions `ReportUsecaseDispatcher` architecture.

## Note to Reviewers (55 Files Changed in Total)

### 🟢 Safe to Skim (49 Files)
These files are direct copy-pastes from the on-premise repository. The core business logic remains completely untouched. The only minor adjustments made to these files are:
* Updated relative import paths.
* Minor file system method migration: Replaced `open_binary()` with `open_read_binary()` to align with the cloud file system implementation.

### 🔍 Key Changes for Review (6 Files)
Please focus your review on the structural and configuration changes below:
* `function_app.py`: Registered `Report2IngestionInputResolver` to the main dispatcher.
* `local.settings.json`: Aligned configuration container names with the actual provisioned cloud containers.
* `requirements.txt`: Added specific library dependencies required for Report 2.
* `shared/file_system.py`: Migrated the `InputFileResolver` protocol from the on-prem repository.
* `service/report_2_ingestion_input_resolver.py`: Created the new resolver interface for Report 2 to adopt the dispatcher workflow.
* `service/validation/validate_ingestion_inputs.py`: Implemented validation logic mirroring the pattern used in Report 4 to support the new resolver.

***

如果有需要補充其他背景資訊，或是要調整哪些檔案的路徑名稱，可以直接修改對應的 bullet points。
