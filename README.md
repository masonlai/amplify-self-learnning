
從你提供的截圖來看，VS Code UI 裡的 `Http: Proxy Support` 已經設為 `off`，也設定了 `No Proxy`，但依舊被擋下來。這代表公司的網路安全軟體（例如 Zscaler, Palo Alto 等）是在更底層的網路卡層級強制攔截了流量，或者是 VS Code 擴充套件底層的 Node.js 直接讀取了 Windows 系統全域的環境變數，忽略了你在 UI 做的設定。

在這種嚴格的企業網路環境下，我們可以嘗試以下幾個從底層繞過的方法：

### 方法一：清除當前環境變數並啟動 VS Code
很多時候，開發工具會繼承系統的 `HTTP_PROXY` 環境變數。我們可以開一個乾淨的命令提示字元，暫時抹除這些變數再啟動 VS Code。

1. 關閉目前所有的 VS Code 視窗。
2. 在 Windows 搜尋列輸入 `cmd`，開啟命令提示字元 (Command Prompt)。
3. 依序貼上並執行以下指令：

```cmd
# Clear proxy environment variables for current session
set HTTP_PROXY=
set HTTPS_PROXY=
set http_proxy=
set https_proxy=

# Launch VS Code from this clean session
code .
```
啟動 VS Code 後，再去左側 Azure 面板重新整理 Local Emulator 看看。

### 方法二：手動連接並替換 IP 為 localhost
有些防火牆的阻擋規則會寫死攔截 `127.0.0.1`，但對 `localhost` 放行（或者相反）。我們可以不要依賴預設的 Local Emulator 按鈕，改用手動加入。

1. 在 VS Code Azure 面板的 `Attached Storage Accounts` 上按右鍵，選擇 `Attach Storage Account...`。
2. 選擇 `Connection String`。
3. 貼上以下字串（我已將 IP 替換為 localhost）：
```text
DefaultEndpointsProtocol=http;AccountName=devstoreaccount1;AccountKey=Eby8vdM02xNOcqFlqUwJPLlmEtlCDXJ1OUzFT50uSRZ6IFsuFq2UVErCz4I6tq/K1SZFPTOtr/KBHBeksoGMGw==;BlobEndpoint=http://localhost:10000/devstoreaccount1;
```
4. 輸入一個名稱（例如 `Local-Host-Test`），完成後展開這個新節點，看是否依然出現 Access Denied。

### 方法三：更改 Azurite 的本機 Port
如果公司的 IT 把 10000 這個 port 給封鎖了，你可以讓 Azurite 跑在其他不敏感的 port 上面。

如果你是用 Docker 啟動 Azurite，可以把本機的 port 改成 18000：
```bash
# Map container port 10000 to local host port 18000
docker run -p 18000:10000 -p 10001:10001 -p 10002:10002 mcr.microsoft.com/azure-storage/azurite
```
然後按照上面的「方法二」，手動加入 Connection String，並將字串最後面的 `10000` 改成 `18000`。

---

如果這三種方法都無效，代表公司電腦安裝的安全軟體實行了極度嚴格的強制性全域封包檢查 (Deep Packet Inspection)，任何未經證明的 HTTP 流量都會被丟棄。

這種情況下，我會建議：
1. **放棄 VS Code 擴充套件，改用微軟獨立的 Azure Storage Explorer 桌面版**。它的網路底層和 Proxy 繞過機制比 VS Code 獨立且完善，通常在企業環境下存活率較高。
2. **向公司的 IT Support 提出申請**，請他們將你的開發 port (10000) 或是本機迴圈地址 (127.0.0.1) 加入白名單。

需要我提供獨立版 Azure Storage Explorer 的官方下載資訊，或是嘗試其他方向嗎？
