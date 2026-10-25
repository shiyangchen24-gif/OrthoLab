# 素材來源與授權紀錄

本專案**尚未指定任何授權條款**（儲存庫沒有 LICENSE 檔）。下列素材不會自動套用日後選定的程式碼授權；若要對外散布，需另外決定圖片授權。

| 素材 | 檔案 | 作者 | 來源 | 授權 | 修改紀錄 |
|---|---|---|---|---|---|
| 犬貓側視角色（姿態：抬腳、坐臥、蹲伏） | `src/components/art/Patient.tsx` | OrthoLab 專案（以程式碼繪製的 SVG） | 原創，依美術規範 ART-03 | 未指定 | v1.0 建立；v1.2 修正抬起的患肢被動畫覆蓋而未顯示 |
| 診間病患插圖（坐姿 3/4 正面，呼吸／眨眼／抬肢微顫／觸診回縮動畫） | `src/components/PatientView.tsx`、`PatientView.css` | OrthoLab 專案（以程式碼繪製的 SVG） | 原創，依美術規範 ART-03 | 未指定 | v1.3 建立；診間（一般病例與 C07 場景）改用此版，舊 `Patient.tsx` 仍供首頁與病例列表使用 |
| 手繪風格 PNG 圖層（C07 病患三姿態、診間背景、獸醫、飼主、檢查台） | `src/assets/patients/`、`src/assets/scene/`（尚無檔案） | 待定 | 待製作（原創，參考使用者提供之風格圖） | 待確認 | v1.4 完成接入架構；素材未取得，見 `docs/art-assets.md` |
| 患肢定位俯視圖 | `src/components/art/LimbMap.tsx` | OrthoLab 專案 | 原創 | 未指定 | v1.1 建立 |
| 診所場景、獸醫角色 | `src/screens/Home.tsx`（ClinicScene） | OrthoLab 專案 | 原創 | 未指定 | v1.0 建立 |
| X 光教學示意（C01–C08） | `src/components/art/XRay.tsx` | OrthoLab 專案 | 原創向量示意，依 C0x-IMG 素材需求；**非臨床影像、非 DICOM** | 未指定 | v1.0 建立；v1.1 加入正交視角切換 |
| 骨骼、骨板、螺釘、骨鉗、量深規圖層（T09） | `src/modules/T09Fracture.tsx`、`src/components/art/boneShapes.ts` | OrthoLab 專案 | 原創，依 T09-AST1／T09-AST2 與 ART-01／ART-02 | 未指定 | v1.0 建立 |
| TPLO、FHNE、MPL 示意 | `src/modules/T01Tplo.tsx`、`T02Fhne.tsx`、`T03Mpl.tsx` | OrthoLab 專案 | 原創示意 | 未指定 | v1.0 建立 |
| 飼主、獸醫、診間、檢查台、場景用瑪爾濟斯（四肢可分別操作） | `src/scenes/art.tsx` | OrthoLab 專案（以程式碼繪製的 SVG） | 原創；操作概念參考「選工具→作用於角色→即時變化」的互動模式，未使用參考遊戲的任何美術、角色、音效或程式 | 未指定 | v1.2 建立 |
| 器械圖示（問診板、患肢標記、放大鏡、觸診手套、X 光、骨段、骨鉗、骨板、鑽孔器、量深規、螺釘、C 臂） | `src/scenes/art.tsx`（ToolIcon） | OrthoLab 專案 | 原創向量 | 未指定 | v1.2 建立 |
| 網站圖示 | `public/favicon.svg` | OrthoLab 專案 | 原創 | 未指定 | v1.0 建立 |
| 音效 | `src/audio.ts` | OrthoLab 專案 | 以 Web Audio 即時合成，無音檔 | 未指定 | v1.0 建立 |

原始素材表（術後與資源表 C01-IMG…T09-AST2）中標示「授權待確認」的真實影像，本專案**沒有使用**。
