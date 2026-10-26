# art-inbox：手繪素材收件匣

把 ChatGPT 生成的原始 PNG 上傳到這裡（依 `portraits/`、`home/`、`care/`、`guide/`、`kb/`、`scene/`、`surgery/` 分資料夾）。
這個資料夾**不會**被遊戲讀取；OrthoLab 檢查、裁切、對齊後才會複製到 `src/assets/`。原始檔保留在此，方便日後重新處理。

| 資料夾 | 狀態 |
|---|---|
| `portraits/` | 已處理 → `src/assets/portraits/`（病例選擇頁） |
| `home/`、`care/`、`guide/`、`kb/`、`scene/` | 已處理 → `src/assets/illust/`（首頁、照護、說明、知識庫、參考來源） |
| `surgery/` | 已處理 → 手術鋪巾、器械圖示、骨頭、骨板、螺孔與螺釘（`src/assets/illust/surgery/`） |
| `patients/<資料夾>/` | 待上傳：其他病例的病患姿態（清單見 `docs/art-assets.md` 第 3 節） |
