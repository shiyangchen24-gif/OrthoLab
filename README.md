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

`vite.config.ts` 使用 `base: './'`，路由使用 hash（`#/cases`），所以 `dist/` 可以直接放在任何子路徑，例如 `https://<user>.github.io/OrthoLab/`。本專案沒有後端、登入、付費 API 或執行時 AI。

**必須發布 `dist/`，不能發布原始碼。** 部署流程 `.github/workflows/deploy-pages.yml` 會在推送到 `main` 時執行 `npm ci → npm test → npm run build`、檢查 `dist/index.html` 沒有引用 `src/main.tsx`，再把 `dist/` 發布到 Pages。

GitHub 設定（只需做一次）：
1. **Settings → Pages → Build and deployment → Source** 選 **GitHub Actions**（不要選 Deploy from a branch）。
2. **Settings → Environments → github-pages → Deployment branches** 允許 `main`。

### 空白頁的原因（已確認）
若 Source 是「Deploy from a branch」，GitHub 會用 Jekyll 直接發布儲存庫根目錄。根目錄的 `index.html` 會載入 `/OrthoLab/src/main.tsx`，GitHub Pages 以 `application/octet-stream` 回傳，瀏覽器拒絕把它當作 module script 執行（Console：*Expected a JavaScript-or-Wasm module script but the server responded with a MIME type of "application/octet-stream"*），`#root` 保持空白。現在即使發生這種錯誤部署，頁面也會顯示「OrthoLab 無法啟動」與重新載入按鈕，不會再是空白頁；`npm run e2e` 有重現這個情境的測試。

## 遊戲流程

首頁 → 接診（病患卡：名字、物種、年齡、體重、主訴）→ 患肢定位（俯視圖點選或文字選項）→ 檢查與影像（逐步解鎖、可重讀、正交視角切換）→ 處置推理（3 題判斷＋四類處置回饋）→ 手術操作或非手術管理 → 術後照護 → 結算（分開顯示檢查、推理、操作、照護，並列出最值得改善的 1–2 項）。

未完成的步驟會鎖住，不能跳過。首次進入的玩家從 **C07 示範關卡** 開始，並有可略過、可在設定中重看的引導（每次只提示一個主要動作）。

## C07 場景式關卡（工具直接操作）

C07 小型犬橈尺骨骨折是場景式示範關卡：中央是診所／手術場景，下方是大型器械工具盤，左上角只有一句任務提示，病歷、教學說明與文獻收在「📋 病歷與資料」面板。

- **操作方式（三種都可）**：點選工具再點目標；把工具從工具盤拖到目標上；或用鍵盤（Tab 移到目標、Enter 使用，手術區方向鍵／Q／E 微調）。
- **回饋**：拿起工具時，可用的目標會以虛線高亮；放錯位置會給出具體修正提示，但不增加進度；成功時有放置動畫與輕柔音效（可關閉）。
- **接診與檢查**：問診紀錄（飼主）→ 患肢標記（四肢分別可點；右側肢在後方較深色）→ 步態觀察 → 骨科觸診（一次即可，不需重複碰觸）→ X 光（正交兩視角）→ 補充資訊 → 推理白板（3 題）→ 處置卡（四類回饋）。
- **手術**：檢查台平順放大到「左前肢・左橈骨（L）」局部視角，依序使用 骨段復位（拖曳＋旋轉把手）→ 骨鉗（兩側夾持點）→ 骨板（選規格、拖到張力側、沿骨軸對齊）→ 鑽孔器（對準螺孔按住約 1 秒；按住時間只是遊戲互動）→ 量深規 → 螺釘（選長度鎖入）→ C 臂（拍 Lat、AP 兩張）→ 四項檢核。
- 手機會改用直式構圖與橫向捲動的工具列，不是縮小桌面畫面；拖曳時頁面不會捲動。

其他病例沿用原本的畫面與流程；判定引擎、存檔與評分完全共用。

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
docs/assets.md               素材作者、來源、授權與修改紀錄
```

## 存檔

`localStorage` 鍵 `ortholab:save`，含版本號（v2），可遷移 v1 格式；損壞的存檔會備份到 `ortholab:save:corrupt-backup` 並以新存檔開始，不會讓遊戲崩潰。首次作答與練習分開保存，重試不覆寫首次紀錄；每次病例以唯一事件 ID 結算一次。設定頁可在確認後清除所有紀錄。

## 資料與來源

見 `docs/data-review.md`（也可在遊戲「說明」頁閱讀）。重點：T05／T06 ID 衝突已拆分、A34 標為條件不足／待審閱、未經支持的數字不顯示、只有首頁網址的來源標示「章節／頁碼待確認」。
