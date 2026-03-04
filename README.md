你的直覺非常敏銳，看到行數變多、甚至還有 `pd.concat` 留在外層而產生質疑，這是軟體工程師非常好的特質。

這確實是一個很現實的 Trade-off（權衡）。在我們目前處於的 **Phase 1（單純封裝 Pandas）**，很多時候「行數變長」是一種必然的過渡期現象，因為我們正在建立原本不存在的「架構層（Layer）」。

但你對第 3 點（Ongoing Payments）的質疑**完全正確且一針見血**。把 `pd.concat` 留在 `report_2_main.py` 的迴圈裡面，代表這個重構**只做了一半**，它並沒有發揮 Repository Pattern 該有的威力。

我們來深入探討為什麼這值得做，以及如何把你指出的第 3 點改寫得更好、更短。

---

### 為什麼這在未來（SQLAlchemy）是值得的？

如果你不把這些隱藏的 Query 抽出來，未來換成 SQLAlchemy 和 Cloud SQL 時會發生災難：

1. **N+1 Query 甚至 N+100 Query 問題**：如果在 main 裡面留著迴圈，每次 `if` 判斷成功就去向 Repo 要一次資料（然後用 `concat` 拼起來），這代表程式會對資料庫發出無數次微小的 SQL Request，這會讓網路延遲（Latency）拖垮整個報表的產生速度。
2. **記憶體爆發**：如果你不把 `str[:4] == plan` 這種邏輯下推到 Repo，為了讓 main 能夠執行這行程式碼，你必須寫 `df = db.query(Model).all()` 把整張資料表的幾十萬筆資料全部載入記憶體，然後再用 Python 去做 string match。這完全違背了使用資料庫的初衷。

---

### 你抓到的 Bug：讓第 3 點重構得更徹底

你說得對，如果有 `pd.concat` 留在 main，那就不夠好。

在資料庫的世界裡，如果你要同時抓取多個 Plan 的資料，你絕對不會寫個迴圈下多次 Query 再拼起來，而是會用 **`IN (...)`** 或是 **`OR`** 一次撈回來。

我們可以修改 Repo，讓它直接接受一個「List」，一次把所有需要的資料用一次「Query」撈回來，這樣 main 裡面的 `pd.concat` 就可以徹底消失，程式碼也會變得比 Old Code 更短！

#### 徹底重構版：`OngoingPaymentsRepository`

我們把剛剛的 fuzzy match 改成支援一次搜尋多個目標：

```python
    def get_payments_by_plans_fuzzy_match(self, df: pd.DataFrame, plan_col_name: str, target_plans: list) -> pd.DataFrame:
        # Remove whitespace from the column
        col_no_space = df[plan_col_name].astype(str).str.replace(r'\s+', '', regex=True)
        
        # Create a combined regex pattern for all target plans (Equivalent to SQL IN or OR)
        # e.g., target_plans=["PLAN A", "PLAN B"] -> pattern="PLANA|PLANB"
        clean_targets = [str(p).replace(' ', '') for p in target_plans]
        pattern = '|'.join(clean_targets)
        
        # Match any of the plans in a single operation
        return df[col_no_space.str.contains(pattern, case=False, na=False)]

```

#### 徹底重構版：`report_2_main.py`

現在看看你的 main 會變得多乾淨。我們把原本的迴圈跟 `pd.concat` 全部拔掉。

**Original Code (你原本的爛 Code):**

```python
# Ongoing payments for main plan
plan_ongoing_payments_df = data_processor.select_data_for_column_value(ongoing_payments_df, payments_plan_col_name, plan)

# Append grouped plans to ongoing payments
if plan in RPT_2_VARS.GROUPED_PLANS:
    for grouped_plan in RPT_2_VARS.GROUPED_PLANS[plan]:
        extra_payments_df = data_processor.select_data_for_column_value(ongoing_payments_df, payments_plan_col_name, grouped_plan)
        plan_ongoing_payments_df = pd.concat([plan_ongoing_payments_df, extra_payments_df], ignore_index=True)

```

**New Code (真正發揮 Repo 威力的寫法):**

```python
# Gather all plans to query into a single list
plans_to_query = [plan]
if plan in RPT_2_VARS.GROUPED_PLANS:
    plans_to_query.extend(RPT_2_VARS.GROUPED_PLANS[plan])

# Fetch all relevant ongoing payments in one single repository call
plan_ongoing_payments_df = ongoing_payments_repo.get_payments_by_plans_fuzzy_match(
    df=ongoing_payments_df, 
    plan_col_name=payments_plan_col_name, 
    target_plans=plans_to_query
)

```

### 總結

你提出的質疑非常有價值。

在重構初期，程式碼確實會因為引入新的類別而稍微膨脹。但只要我們確保**業務邏輯（決定要撈哪些 Plan）**與**資料存取邏輯（如何處理大小寫空白並撈出資料）**被正確地切開（就像上面這個改良版的寫法），主程式 `main.py` 的可讀性就會大幅提升，而且未來將 `get_payments_by_plans_fuzzy_match` 換成 SQLAlchemy 時，只需要把 Regex 改成 `SQLAlchemy.Column.in_()` 就可以了，main 依然一行都不用改。

如果你同意這個方向，我們可以按照這種「把迴圈收斂成 List Query」的思路，把第 2 點（Employee ID 切割）也優化掉，讓 `pd.concat` 徹底從你的資料獲取邏輯中消失。需要我接著示範嗎？
