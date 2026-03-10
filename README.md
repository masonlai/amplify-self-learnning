# 將 Mask 轉做純 True/False 陣列，完全剝離 Pandas Index
        mask_arr = mask_retiree_and_spouse_setup.to_numpy(dtype=bool)
        
        # 直接攞 Numpy 純數值塞入去，完美避開對齊崩潰
        output_table.loc[mask_arr, "ID"] = raw_table["Employee ID"].to_numpy()[mask_arr]
