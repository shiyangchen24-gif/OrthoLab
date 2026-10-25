# OrthoLab：獸醫骨科互動教學模擬

繁體中文的獸醫骨科教學遊戲。玩家扮演獸醫，完成：

接診 → 蒐集檢查線索 → 臨床推理 → 選擇處置 → 手術操作或非手術管理 → 術後照護 → 學習回饋

> **教學模擬，非實際臨床決策工具。** 病例皆為依附件資料設定的虛構教學病例。分數為本關教學評分，不代表治療成功率。T09 的角度、位移、跨距、皮質數與距離為遊戲幾何門檻，不是臨床標準。

## 快速開始

需要 Node.js 18 以上（開發時使用 Node 22）。

```bash
npm install
npm run dev        # 開發伺服器 http://localhost:5173
npm run build      # 型別檢查 + 靜態建置到 dist/
npm run preview    # 預覽建置結果
npm test           # 單元測試（Vitest）
npm run e2e        # 端對端遊玩 C01–C08（需先 npm run build；使用 Playwright + Chromium）
```

`npm run data:extract` 會從 `data-source/veterinary-ortho-game-source.xlsx` 重新產生 `src/data/generated/source.json`（需要 Python 3 與 openpyxl）。建置本身不需要 Python。

## 部署（靜態網站／GitHub Pages）

`vite.config.ts` 使用 `base: './'`，路由使用 hash（`#/cases`），所以 `dist/` 可以直接放在任何子路徑，例如 `https://<user>.github.io/OrthoLab/`。e2e 測試就是從 `/OrthoLab/` 子路徑提供 `dist/` 來驗證。本專案沒有後端、登入、付費 API 或執行時 AI。

## 可玩內容

| 病例 | 內容 | 模組 |
|---|---|---|
| C01、C02 | 犬 CCLD | T01 TPLO 概念操作：規劃核對 → 圓弧截骨與旋轉示意 → 範本固定 → 影像檢核 |
| C03 | 犬 LCPD | T02 FHNE：辨識股骨頭頸 → 切除示意 → 殘留撞擊檢查 → 復健路線（無骨板關卡） |
| C04 | 有症狀 MPL | T03 組合矯正：辨識排列 → 依所見選組合 → 操作示意 → 屈伸軌跡檢核 |
| C05 | 無症狀輕度 MPL | T04 非手術：觀察、衛教與追蹤卡片 |
| C06 | 貓慢性 OA | T04 非手術：個別化疼痛、體重、環境與追蹤卡片（與 C05 不同） |
| C07、C08 | 小型犬橈尺骨／貓股骨幹骨折 | T09 骨折復位與骨板固定（主打模組） |

T09：拖曳／旋轉遠端骨段（滑鼠、觸控、方向鍵、按鈕微調）、可切換磁吸輔助、骨鉗避開骨板路徑、選擇並定位預設骨板、逐孔「選孔 → 鑽孔 → 量深 → 選長度鎖入」、兩個正交視角的術後檢核。所有判分以 SVG 模型座標計算（螢幕座標經 `getScreenCTM()` 反轉換），縮放與換視角不影響判分；角度差處理 0/360° 邊界；短縮、平移與角度分開計算；螺釘距骨折線以線段距離計算；只有有效、雙皮質、未重複的螺釘計入；多餘螺釘不加分。

其他處置（囊外固定、TTA、THR、外固定、髓內釘等）提供決策回饋與解說／轉介路線，沒有假操作畫面。

## 專案結構

```
data-source/                 原始 Excel（附件）
scripts/extract_xlsx.py      Excel → JSON（清除空白列欄、數值轉換、null 保留）
src/data/                    資料層：generated JSON、ID 對照與覆寫（mapping.ts）、照護卡、解說路線
src/config/tolerances.ts     唯一的容差設定（完整區間、衝突紀錄）
src/config/fractureCases.ts  C07／C08 骨折幾何模型
src/engine/                  純函式：幾何、T09、概念模組、病例流程、存檔
src/modules/                 T01、T02、T03、T09 操作畫面
src/components/              共用 UI、SVG 美術（犬貓、X 光示意）、卡片關卡
src/screens/                 首頁、病例、診間、知識庫、來源、設定、說明
tests/                       Vitest 單元測試
e2e/playthrough.mjs          Playwright 端對端遊玩（含觸控、子路徑、損壞存檔）
docs/data-review.md          資料問題、處理方式與待審閱項目
```

## 存檔

`localStorage` 鍵 `ortholab:save`，含版本號（v2），可遷移 v1 格式；損壞的存檔會備份到 `ortholab:save:corrupt-backup` 並以新存檔開始，不會讓遊戲崩潰。首次作答與練習分開保存，重試不覆寫首次紀錄；每次病例以唯一事件 ID 結算一次。設定頁可在確認後清除所有紀錄。

## 資料與來源

見 `docs/data-review.md`（也可在遊戲「說明」頁閱讀）。重點：T05／T06 ID 衝突已拆分、A34 標為條件不足／待審閱、未經支持的數字不顯示、只有首頁網址的來源標示「章節／頁碼待確認」。
