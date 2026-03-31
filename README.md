
Context:
We are migrating an on-premise Python reporting pipeline to an Azure Functions cloud environment. The cloud environment uses a `ReportUsecaseDispatcher` to route incoming blob files to the correct processor using the `InputResolver` interface.

Task:
Migrate the entry point and resolver logic for "Report 2" from the on-premise repository to the cloud repository. You must strictly preserve all of Report 2's existing business logic. Only refactor the routing/resolver layer to match the cloud architecture, using "Report 4" as your template.

Steps to execute:
1. Analyze Target Architecture: Review how "Report 4" is implemented in the cloud repo (specifically look for `report_4_ingestion_input_resolver.py` or its equivalent). Understand the `InputResolver` base class, especially how `can_resolve(blob_name: str)` is implemented and how it returns processors.
2. Analyze Source Logic: Review `report_2_main.py` and its associated file factory/setup components in the on-prem repo. Identify the specific file naming patterns or conditions used to trigger Report 2.
3. Create Resolver: Create a new file named `report_2_ingestion_input_resolver.py` in the cloud repo (in the same directory level as Report 4's resolver).
4. Implement Logic: Create the `Report2IngestionInputResolver` class. Implement the `can_resolve` method based on Report 2's file identification rules. 
5. Preserve Business Logic: Instantiate and return the existing Report 2 processors within the resolver. Do NOT modify the core domain logic, data transformations, or use cases of Report 2.
6. Register Resolver: Update `function_app.py`. In the `IngestReconFn` function, append the new resolver to the dispatcher chain. Example:
   `dispatcher = ReportUsecaseDispatcher().register(Report4IngestionInputResolver()).register(Report2IngestionInputResolver())`
7. Constraints: All code comments must be in English. Do not introduce any new business features.
