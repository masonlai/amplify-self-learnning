這是一份專業的 PR Description 草稿，我用 **Markdown Table** 的形式幫你整理，因為這樣 Reviewer 一眼就能看懂 Input 和 Output 的關係。

你可以直接 Copy 落你的 PR 到：

---

### ## Test Scenarios & System Behavior

This section outlines the expected behavior of the E2E framework under various Loader and Regression states.

| Case | Scenario | Loader Exit Code | Regression Test | Final Status | Outcome / Error Details |
| --- | --- | --- | --- | --- | --- |
| **1** | **Happy Path**<br>

<br>(Loader success + Regression pass) | `0` | **Triggered** | `COMPLETED` | **`successful: true`**<br>

<br>Both the loader and regression test executed without issues. |
| **2** | **Concurrency Lock**<br>

<br>(Loader already running) | Non-zero | **Skipped** | `FAILED` | **`successful: false`**<br>

<br>Error message indicates the loader is already active on a specific server.<br>

<br>*Exception: `IllegalStateException: ... is already running on ...*` |
| **3a** | **Loader Failure (Silent)**<br>

<br>(Loader fails but swallows error) | `0` | **Triggered** | `COMPLETED` | **`successful: true` (False Positive)**<br>

<br>The loader failed internally but returned `exit code 0`. The system incorrectly perceives this as success and proceeds with the regression test.<br>

<br>*Note: This depends on the specific loader's design and requires further investigation.* |
| **3b** | **Loader Failure (Explicit)**<br>

<br>(Loader fails with error code) | Non-zero | **Skipped** | `FAILED` | **`successful: false`**<br>

<br>The loader correctly reports a failure. The workflow stops immediately. |
| **4** | **Missing Baseline**<br>

<br>(Loader success, no baseline file) | `0` | **Triggered** | `FAILED` | **Error during comparison**<br>

<br>The regression test attempts to run but crashes during the comparison phase. The error message typically cites a missing "actual" field (due to empty/missing comparison data) rather than explicitly stating "Baseline Missing". |
| **5** | **Regression Failure**<br>

<br>(Loader success, Data mismatch) | `0` | **Triggered** | `COMPLETED` | **`successful: false`**<br>

<br>The loader ran successfully, but the regression test detected data discrepancies against the baseline. |

---

### 建議的補充文字 (Optional)

如果你覺得 Table 唔夠，或者想在 Description 裡特別 highlight **Case 3** 同 **Case 4** 的隱患，可以加多一段 "Known Limitations"：

**Known Limitations & Observations:**

* **Case 3 (Silent Failure):** We observed that some loaders return `exit code 0` even when they fail internally. In these cases, the regression test is triggered incorrectly. This requires a separate fix within the loader scripts to ensure they propagate non-zero exit codes upon failure.
* **Case 4 (Missing Baseline):** Currently, if a baseline file is missing, the error reporting is ambiguous (referencing missing JSON fields instead of the file itself). Future improvements could include an explicit file existence check before comparison.

這樣寫 Reviewer 就會覺得你考慮得好周全，不但改了 code，還分析了系統現在的不足之處。
