對唔住！我頭先無睇清楚你張圖入面啲 **Import Path (File Location)**，搞到啲分類錯晒。🙏

根據你最後張圖 (`infra.ts`) 嘅 `import` 路徑，你嘅 Code 其實係分咗 **5 類** (Core, Security, Functions, Data, Monitor)。

如果你講嘅「四個分類」係指將 Monitor 歸類入去其中一個，或者只係數漏咗，我建議跟返你 **Code 入面嘅 Folder Structure** 寫 Document 就最準。

以下係 **100% 跟足你 Code 路徑分類** 嘅版本，直接 Copy 呢個就啱：

---

## 🔄 Infrastructure Refactoring: Legacy to Semantic Naming

We have refactored the codebase to use semantic naming. Below is the mapping based on the new folder structure.

### 1. `// Core` (Foundational Resources)

| Legacy Name | **New Name** | Description |
| --- | --- | --- |
| `rgstack` | **`ResourceGroupStack`** | Resource Group |
| `asestack` | **`AppServiceEnvStack`** | App Service Environment (ASE) |
| `aspstack` | **`AppServicePlanStack`** | App Service Plan (ASP) |
| `umistack` | **`UserManagedIdentityStack`** | User Managed Identity |

### 2. `// Security` (Identity & Access)

| Legacy Name | **New Name** | Description |
| --- | --- | --- |
| `kvstack` | **`KeyVaultStack`** | Key Vault |
| `kvapstack` | **`KvAccessPolicyStack`** | Key Vault Access Policies |
| `rastack` | **`GlobalRoleAssignmentStack`** | Global RBAC Assignment |
| `ad1stack` | **`RgRoleAssignmentStack`** | Resource Group RBAC |
| `sftpkeysstack` | **`SftpSshKeysStack`** | SFTP SSH Keys |

### 3. `// Functions` (Business Logic)

| Legacy Name | **New Name** | Description |
| --- | --- | --- |
| `azfstack` | **`IngestReconFuncStack`** | Ingest & Recon Function |
| `azfstack02` | **`ReportingIngestFuncStack`** | Reporting Function |
| `azfstack03` | **`FileTransferFuncStack`** | File Transfer Function |
| `pgpstack` | **`PGPFuncStack`** | PGP Encryption Function |

### 4. `// Data` (Storage & Config)

| Legacy Name | **New Name** | Description |
| --- | --- | --- |
| `StorAccstack` | **`SharedStorageStack`** | Shared Storage Account |
| `mssqlstack` | **`MssqlDBStack`** | SQL Database |
| `sftpstack` | **`SftpServiceStack`** | SFTP Service |
| `appcfstack` | **`AppConfigStack`** | App Configuration |
| `appcfkeystack` | **`AppConfigKeysStack`** | App Config Key-Values |

### 5. `// Monitor` (Observability)

| Legacy Name | **New Name** | Description |
| --- | --- | --- |
| `appinstack` | **`AppInsightsStack`** | Application Insights |
| `actgrstack` | **`MonitorAlertsStack`** | Action Groups & Alerts |
