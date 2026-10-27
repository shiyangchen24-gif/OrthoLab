# 手繪風格素材：架構、規格與缺件清單

C07 診間已接入使用者以 ChatGPT 生成的手繪風格素材：
- 瑪爾濟斯三個對齊姿態
- 診間背景、獸醫、飼主、檢查台

C07 診間的所有圖層都已是手繪 PNG。獸醫與飼主以「半身」構圖出現在畫面兩側（全身圖放大，下半身由畫面底部與檢查台遮住），檢查台位於病患正下方。

| 項目 | 狀態 |
|---|---|
| 程式整合（分層場景、PNG 接入、姿態切換、命中區、退縮計時、回退機制、檢查工具、測試） | **已完成** |
| 素材取得 | **C07 診間完成**：`sit`、`lift-LF`、`withdraw-LF`、`clinic-room`、`vet`、`owner`、`exam-table` |
| 視覺驗收 | **C07 診間完成**：桌面與手機（直式）皆已檢查構圖、命中區與觸診姿態切換；其他畫面與病例尚未改版 |

### 已放入素材的處理紀錄

| 檔案 | 處理 |
|---|---|
| `src/assets/patients/maltese/{sit,lift-LF,withdraw-LF}.png` | 原圖 1024 × 1536 透明 PNG，三張頭部位置一致（位移 0 px）。以同一倍率（0.79）縮放，前腳掌中心對齊 x = 510、腳掌基線對齊 y = 1002，輸出 1020 × 1140。各姿態命中區依實際畫面重新量測。 |
| `src/assets/scene/vet.png` | 原圖 1024 × 1536 透明 PNG，縮放 0.822，鞋底貼齊畫布底部，輸出 660 × 1260。 |
| `src/assets/scene/owner.png` | 原圖 1024 × 1536 透明 PNG，與獸醫相同處理，輸出 660 × 1260。 |
| `src/assets/scene/exam-table.png` | 原圖 1536 × 1024 透明 PNG，原尺寸放入；病患腳掌落在畫布 y = 190 的台面上（`seatY`）。 |
| `src/assets/scene/clinic-room.png` | 原圖 1536 × 1024，裁成 16:9（1536 × 864，上方裁 95 px），讓地板線落在 70% 高度；未放大，以免假造解析度。 |

### 病例選擇頁頭像（`src/assets/portraits/C01–C08.png`）

原圖在 `art-inbox/portraits/`（透明 PNG）。裁去空白、等高縮放到 512 × 512，四腳底線統一在 y = 492。全部是健康、四腳著地的姿勢，不會在玩家定位前透露患肢。由 `src/components/CasePortrait.tsx` 顯示；缺圖的病例沿用向量角色。來源：使用者以 ChatGPT 生成。

### 頁面插圖（`src/assets/illust/`，由 `src/components/illustrations.ts` 載入）

原圖在 `art-inbox/`；不透明插圖縮到寬 720 px（首頁背景 1672 px、圖書室 1536 px）並轉成 WebP，透明的 `hero-cat` 保留 PNG。

| 畫面 | 使用的插圖 |
|---|---|
| 首頁 | `home/hero-room` 背景；獸醫（`scene/vet.png`，裁在檢查台台面後方）、瑪爾濟斯 `sit`、`home/hero-cat`；下方三張功能卡 `home/card-exam`、`card-surgery`、`card-care` |
| 術後照護 | 照護卡依類別配圖：活動 `care/activity`、傷口 `care/wound`、疼痛 `care/pain`、追蹤 `care/recheck`、警訊 `care/warning`（正確卡與干擾卡共用同一類別圖，不會洩漏答案）；C07 顯示 `patients/maltese/bandaged-LF.png`（左前肢包紮，與其他姿態同畫布），其他病例顯示頭像 |
| 說明 | 六步驟 `guide/step1–6`，側邊選單：遊戲介紹／操作方式／教學限制／資料審閱 |
| 知識庫 | 疾病卡 `kb/D01–D10`；右側詳細面板分「症狀／檢查／處置」。插圖下方註明「解剖細節待獸醫審閱」 |
| 參考來源 | 頁首 `scene/library-room` |

手術畫面：`surgery/drape` 為手術台背景、`tools/*` 為器械盤圖示。

| 素材 | 用法（判分幾何不變） |
|---|---|
| `surgery/C07-bone`（橈骨）、`C08-bone`（股骨） | **骨頭外形以這兩張圖為準**：`scripts/trace_bone_outline.py` 依原始比例（不拉伸）描出每 1 mm 的上緣／下緣，寫入 `src/config/boneOutlines.generated.ts`；判分引擎的骨表面、骨厚度、骨折線端點、關節面與骨鉗夾持點都改用這份外形。手術畫面整張顯示原圖，只沿骨折線分成近端／遠端兩段，不裁切外形。X 光示意也使用同一外形 |
| `surgery/C07-ulna` | 尺骨（裝飾、不計分），整張顯示並沿骨折線分段，位置在橈骨骨幹下方 |
| `surgery/plate`（不鏽鋼材質） | 填入程式計算的骨板外形；孔數、長度依所選骨板規格 |
| `surgery/hole`、`screw-head` | 骨板上方編號螺孔標記的外觀：空孔／已鎖釘；狀態以外圈顏色表示（預設孔、已鑽、有效、無效） |
| `surgery/screw-side` | 側視螺釘，依所選長度伸縮 |

X 光判讀與正交檢核畫面維持程式繪製的灰階教學示意，不使用這些畫作。

## 1. 場景分層（C07 診間，`src/scenes/C07Clinic.tsx`）

所有圖層都使用同一套場景座標（SVG viewBox 1600 × 900；直式手機改用 `430 40 780 900` 的取景）。圖片、命中區與工具一起縮放，不以螢幕像素寫死。

| 順序 | 圖層（`data-layer`） | 內容 | 素材 |
|---|---|---|---|
| 1 | `background` | 牆面、櫃體、窗戶、植栽、用品 | `src/assets/scene/clinic-room.png`，缺件時用向量診間 |
| — | `props` | 推理白板、X 光燈箱（可互動，文字由程式繪製） | 程式繪製 |
| 2 | `people` | 飼主、獸醫（半身構圖，位置由 `C07Clinic.tsx` 的 `LAYOUT.*.painted` 依桌面／手機分別設定） | `owner.png`、`vet.png`，缺件時用向量人物 |
| 3 | `table` | 檢查台（台面 `seatY` 對齊病患腳掌基線） | `exam-table.png`，缺件時用向量檢查台 |
| 4–5 | `patient` | 病患角色＋接觸陰影＋患肢／身體命中區 | `src/assets/patients/maltese/*.png`，缺件時用向量 `PatientView` |
| 6 | `interaction` | 飼主命中區（透明） | 程式繪製 |
| 7 | HTML | 導覽、任務提示（左上，一次一句）、結果卡、工具盤、病歷側欄 | 程式呈現 |

文字、按鈕、患肢高亮與工具盤一律不烘焙進圖片。

## 2. 病患素材規格（`src/components/patientAssets.ts`）

- 同一角色的所有姿態使用**同一畫布 1020 × 1140 px**（= `PatientView` viewBox 340 × 380 的 3 倍），鏡頭、光源（左上柔光）、身體位置一致。
- 腳掌基線固定在畫布 y = 1002，水平錨點 x = 510。
- 真正透明背景，邊緣不可有白邊。
- 視角：病患面向觀看者並略轉向觀看者左方，**病患左側在畫面右側**。不得以水平鏡像產生另一側。
- 每個姿態的四肢命中區（viewBox 單位）記錄在 `limbBoxes`；素材交付後須依實際畫面重新量測。
- 姿態規則（`posePlan`）：
  - 只有單一患肢被抬起時才用 `lift-<肢>`。
  - 雙側、無症狀、患側不明一律 `sit`。
  - 只有單一患肢時才有 `withdraw-<肢>`。
- 退縮：有效觸診時切到 `withdraw-*` 約 650 ms 再回原姿態。
  - 兩張圖都預先載入並疊放，只切換不透明度，所以不會跳位或閃爍。
  - 連點只會重設同一個計時器，不會排隊；換病例或卸載時清除計時器。
  - 減少動態時不切換姿態，改顯示靜態虛線外框與文字提示。
- 原始 PNG 不做呼吸或眨眼（不以縮放整張圖假裝呼吸或眨眼）。若日後提供分層素材（頭、眼、胸腹、患肢、尾巴），再另外加入。

### 驗證工具

```bash
python3 -I scripts/check_patient_assets.py
```

檢查項目：檔案存在、畫布尺寸、RGBA 透明、邊框透明（非裁切矩形）、白邊比例、各姿態腳掌基線一致（±4 px）。單元測試會確認此腳本的清單與程式內的素材設定一致。

## 3. 缺件清單

### 其他病例的病患姿態（C01–C06、C08）

一般診間（`src/screens/Clinic.tsx`）會自動改用手繪病患：只要該品種「靜止姿態」的 PNG 存在就切換，缺件時沿用向量角色。上傳到 `art-inbox/patients/<資料夾>/`，由 OrthoLab 對齊畫布後放入 `src/assets/patients/<資料夾>/`。

| 病例 | 品種 | 資料夾 | 必要 | 選用（術後照護） |
|---|---|---|---|---|
| C01 | 拉布拉多 | `labrador` | `sit`、`lift-LH`、`withdraw-LH` | `bandaged-LH` |
| C02 | 玩具貴賓 | `toy-poodle` | `sit`、`lift-LH`、`withdraw-LH` | `bandaged-LH` |
| C03 | 約克夏 | `yorkshire` | `sit`、`lift-RH`、`withdraw-RH` | `bandaged-RH` |
| C04 | 博美 | `pomeranian` | `sit`、`lift-RH`、`withdraw-RH` | `bandaged-RH` |
| C05 | 米克斯犬 | `mixed-dog` | `sit`、`withdraw-LH`（無症狀，不抬腳） | `bandaged-LH` |
| C06 | 短毛家貓（灰虎斑） | `grey-tabby` | `sit`（雙側，不抬腳、不退縮） | — |
| C08 | 米克斯短毛貓（橘） | `orange-cat` | `sit`、`lift-RH`、`withdraw-RH` | `bandaged-RH` |

LH／RH：病患面向觀看者，**左後肢在畫面右側、右後肢在畫面左側**。三張圖必須同一角色、同一構圖，只改那隻腳。

| 檔案 | 尺寸 | 說明 |
|---|---|---|
C07 診間沒有缺件。

其他品種（C01–C06、C08）尚未規劃 PNG，繼續使用向量角色。

## 4. 來源與授權

| 素材 | 來源 | 授權 |
|---|---|---|
| 瑪爾濟斯三姿態、診間背景、獸醫、飼主、檢查台 PNG | 使用者以 ChatGPT 生成並提供；OrthoLab 依規格縮放、裁切、對齊 | 由 ChatGPT 生成（使用者提供） |
| 使用者提供的參考圖（犬隻插畫、改版示意圖） | 使用者提供 | 未說明；**未放入專案**，只作為風格參考 |
| 向量回退角色與場景 | OrthoLab 專案原創程式碼 | 同專案 |

## 5. 加入素材的步驟

1. 依上表尺寸輸出透明 PNG，放進對應資料夾。
2. 執行 `python3 -I scripts/check_patient_assets.py`，修正所有 ✗。
3. 依實際畫面調整 `limbBoxes`／`bodyBox`，更新來源、授權與 `status`。
4. 執行 `npm test`、`npm run build`、`npm run e2e`，並在瀏覽器檢查桌面與手機的命中區是否對準。
