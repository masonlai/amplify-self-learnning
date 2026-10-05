You are working on PR #111 (branch chore/BPIC-147). All paths are relative to service/functions/.

The Jira story requires logs to identify Applicants, Applications, Products and Users by UUID, never by PII, and not to duplicate existing server logs. Make the changes below. Keep the diff minimal and don't refactor unrelated code.

## 0. Investigate first (report before changing anything)
a) Read shared/audit/blueprint.py (AuditedBlueprint). Summarise what it already logs/audits per request.
   For each of these new log calls, say whether AuditedBlueprint already records the same event:
   - "PDF generated" (GeneratePdfs), "PDF downloaded" (GetPdf), "Application created" (OnboardClient)
b) Inspect every AuthError subclass and every place one is raised. Confirm whether str(error) can ever contain a UPN, email, claim value or token fragment.
c) Check whether applicants have their own UUID (e.g. in the client profile models / DB models).
d) Check whether any endpoint touched by this PR deals with Products.
Show me the findings, then continue with the steps below.

## 1. Auto-inject the DB user UUID into every log entry
In shared/shared_services/log.py:
- Add _db_user_id_safe() -> str | None, mirroring _session_id_safe():
  lazy-import get_current_user_id from shared.auth.context, return str(...) of it,
  and return None on ANY exception (get_current_user_id raises RuntimeError when no identity is bound).
- Use the DB user UUID from context only. NEVER use Principal.user_id — that is an email/UPN.
- Add "db_user_id": _db_user_id_safe() to the reserved keys at the end of entry (after **kwargs).
- Update the log() docstring to list db_user_id as a reserved key.
In app_service/FetchRegionalApplications/function_app.py:
- Remove the manual db_user_id=str(get_current_user_id()) kwarg (now automatic). Remove the get_current_user_id import if unused.
Tests in shared/tests/test_log.py:
- db_user_id is null when no identity is bound.
- db_user_id equals the bound UUID when an identity is bound (use set_current_identity / clear_current_identity).
- A db_user_id kwarg cannot override the reserved value.
- log() still does not raise if the user id lookup raises (monkeypatch, like the existing session test).

## 2. Consistent key names
- In app_service/GetPdf/function_app.py rename the log kwarg document_uuid -> document_id.
- Make sure every log kwarg ending in _id holds a plain UUID string (str(uuid)), not a UUID object and not a different format.
- Do not rename anything outside log calls.

## 3. Applicant UUIDs (only if 0c found one)
In app_service/ClientProfile/function_app.py, where an applicant is created/updated/deleted, add the applicant UUID(s) as applicant_id (single) or applicant_ids (list) alongside the existing fields. If applicants have no UUID, change nothing and tell me.

## 4. Auth failure detail (based on 0b)
In app_service/service_layer/authenticate.py:
- If str(error) could contain any identity data, replace detail=str(error) with error_type=type(error).__name__ and update test_authenticate.py.
- If it is safe, leave it unchanged.

## 5. Duplication (based on 0a)
If AuditedBlueprint already logs an equivalent event, remove the duplicate log call I added in that handler. If it doesn't, leave it.

## Do NOT change
- Session ID logic, report_error / _has_unsafe_exc, validation_error_fields, db session hide_parameters, host.json.

## Verify
- Run pytest from service/functions and fix anything you broke.
- Grep all log( calls and list every kwarg key used, so I can check naming is consistent.
- Do not commit or push. Leave changes unstaged.
- Finish with a short summary: files changed, why, and the answers to step 0.
