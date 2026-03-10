
你說得對，與其我們在這裡盲猜，不如直接讓 test 告訴我們到底多了哪 7 個 columns (38 vs 31)。這個 debug 思路非常正確。

請修改你的 `test_parity.py`，在 `assert df_expected.shape == df_actual.shape` 這一行之前，加入一段比對 columns 的 print 邏輯。這樣當 shape 不一樣的時候，pytest 的錯誤報告裡面就會印出具體差異。

請將你原本的第 38 到 40 行替換成以下代碼：

```python
    # Compare columns if shapes differ to pinpoint the issue
    if df_expected.shape != df_actual.shape:
        expected_cols = set(df_expected.columns)
        actual_cols = set(df_actual.columns)
        
        extra_in_actual = actual_cols - expected_cols
        missing_in_actual = expected_cols - actual_cols
        
        print(f"\n--- Shape Mismatch in sheet: {sheet} ---")
        print(f"Extra columns in actual: {extra_in_actual}")
        print(f"Missing columns in expected: {missing_in_actual}")

    # Assert shape first for a clearer error message if row/col counts differ
    assert df_expected.shape == df_actual.shape, \
        f"Shape mismatch in sheet '{sheet}'. Expected: {df_expected.shape}, Actual: {df_actual.shape}"

```

改完之後，請再跑一次 test，然後把 console 印出來的 `Extra columns in actual:` 結果貼給我看。這樣我們就能馬上知道是哪裡漏了 drop column，或者是在 rendering 的時候哪裡多畫了東西。等你回覆。
