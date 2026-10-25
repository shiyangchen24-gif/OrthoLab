// Explicit resolution of the source workbook's overloaded IDs.
//
// The source uses one 處置ID column for three different meanings (technique,
// module and option). Notably T05 means 關節囊外固定 in 術式模組 but external
// splint/coaptation in fracture options, and T06 means TTA in 術式模組 but IM
// pinning in fracture options. Every option is mapped here to a unique,
// semantic treatmentId and (optionally) a procedureId, while the raw value is
// kept on the option for traceability. See docs/data-review.md.

import type { AnswerCategory, OptionRoute, ProcedureId, TreatmentTechnique } from '../types';

/** Raw module id in 術式模組 → unique procedure id. Valid ONLY for that sheet. */
export const MODULE_RAW_TO_PROCEDURE: Record<string, ProcedureId> = {
  T01: 'PROC-TPLO',
  T02: 'PROC-FHNE',
  T03: 'PROC-MPL-COMBO',
  T04: 'PROC-NONSURGICAL',
  T05: 'PROC-ECS',
  T06: 'PROC-TTA',
  T07: 'PROC-THR',
  T08: 'PROC-SULCOPLASTY-ONLY',
  T09: 'PROC-ORIF-PLATE',
  T10: 'PROC-ANESTHESIA',
};

export const TECHNIQUES: TreatmentTechnique[] = [
  { id: 'TX-TPLO', name: 'TPLO 脛骨高原平移截骨術', procedureId: 'PROC-TPLO', description: '以圓弧截骨並旋轉脛骨高原，再以骨板固定。' },
  { id: 'TX-ECS', name: '關節囊外固定', procedureId: 'PROC-ECS', description: '以關節外縫線/固定材料穩定膝關節。本版僅提供決策解說。' },
  { id: 'TX-TTA', name: 'TTA 脛骨粗隆前移術', procedureId: 'PROC-TTA', description: '需完整幾何規劃。本版僅提供決策解說。' },
  { id: 'TX-FHNE', name: 'FHNE 股骨頭頸切除', procedureId: 'PROC-FHNE', description: '切除疼痛的股骨頭頸接觸，術後依賴疼痛控制與復健。' },
  { id: 'TX-THR', name: 'THR 全髖關節置換', procedureId: 'PROC-THR', description: '需骨量、植入物與專科評估；本版只顯示轉介路線。' },
  { id: 'TX-MPL-COMBO', name: '髕骨脫位組合矯正', procedureId: 'PROC-MPL-COMBO', description: '依所見組合滑車溝、脛骨粗隆與軟組織處置。' },
  { id: 'TX-SULCOPLASTY-ONLY', name: '只加深滑車溝', procedureId: 'PROC-SULCOPLASTY-ONLY', description: 'T03 的單一元件，非獨立模組。' },
  { id: 'TX-ORIF-PLATE', name: '開放復位骨板內固定（ORIF）', procedureId: 'PROC-ORIF-PLATE', description: '解剖復位後以骨板與螺釘固定。' },
  { id: 'TX-EXTERNAL-COAPTATION', name: '外固定（副木／夾板／包紮）', procedureId: null, description: '骨折外固定。原始資料誤用 T05（囊外固定）代表，已拆分。' },
  { id: 'TX-IM-PIN-ONLY', name: '單獨髓內釘', procedureId: null, description: '原始資料誤用 T06（TTA）代表，已拆分。' },
  { id: 'TX-IM-PIN-CERCLAGE', name: '髓內釘＋鋼線環扎', procedureId: null, description: '原始資料誤用 T06（TTA）代表，已拆分；適用條件待審閱。' },
  { id: 'TX-ANALGESIA-NO-FOLLOWUP', name: '僅止痛且無追蹤', procedureId: null, description: '未處理病因且無追蹤計畫。' },
  { id: 'TX-BRIDGE-REFERRAL', name: '短期管理並轉介（橋接）', procedureId: 'PROC-NONSURGICAL', description: '作為手術評估前的橋接，不宣稱可逆轉病變。' },
  { id: 'TX-OBSERVE-FOLLOWUP', name: '觀察、飼主教育與追蹤', procedureId: 'PROC-NONSURGICAL', description: '無症狀病例的監測計畫。' },
  { id: 'TX-RECHECK-ON-SIGNS', name: '有新症狀即回診', procedureId: 'PROC-NONSURGICAL', description: '追蹤計畫的一部分，需搭配基礎衛教。' },
  { id: 'TX-NO-FOLLOWUP', name: '不需任何追蹤', procedureId: null, description: '忽略未來症狀變化。' },
  { id: 'TX-OA-MULTIMODAL', name: '個別化慢性疼痛管理', procedureId: 'PROC-NONSURGICAL', description: '個別化止痛、體重管理與環境調整。' },
  { id: 'TX-LASER-ONLY', name: '僅雷射', procedureId: null, description: '輔助療法不能代表完整照護計畫。' },
  { id: 'TX-STRICT-CAGE-REST', name: '長期嚴格籠休', procedureId: null, description: '無急性需固定損傷時不宜一律長期不動。' },
  { id: 'TX-CAGE-REST-ANALGESIA-FRACTURE', name: '籠休＋止痛保守處理（骨折）', procedureId: null, description: '未復位、未固定移位骨折。' },
];

export interface OptionResolution {
  treatmentId: string;
  route: OptionRoute;
  categoryOverride?: AnswerCategory;
  scoreOverride?: null;
  missingInfo?: string[];
  feedbackOverride?: string;
  flags?: { code: string; message: string }[];
}

const retry: OptionRoute = { kind: 'retry' };

/** Per-option resolution. Keys are 判定ID (A01…). */
export const OPTION_RESOLUTION: Record<string, OptionResolution> = {
  A01: { treatmentId: 'TX-TPLO', route: { kind: 'module', procedureId: 'PROC-TPLO' } },
  A02: { treatmentId: 'TX-ECS', route: { kind: 'explain', procedureId: 'PROC-ECS' } },
  A03: { treatmentId: 'TX-TTA', route: retry, missingInfo: ['骨骼幾何量測與 TTA 規劃資料（本模擬病例未提供）', '依病例確認的適應條件'] },
  A04: { treatmentId: 'TX-ANALGESIA-NO-FOLLOWUP', route: retry },
  A05: { treatmentId: 'TX-TPLO', route: { kind: 'module', procedureId: 'PROC-TPLO' } },
  A06: { treatmentId: 'TX-ECS', route: { kind: 'explain', procedureId: 'PROC-ECS' } },
  A07: { treatmentId: 'TX-TTA', route: retry, missingInfo: ['完整幾何規劃（本模擬病例未提供）'] },
  A08: { treatmentId: 'TX-FHNE', route: retry },
  A09: { treatmentId: 'TX-FHNE', route: { kind: 'module', procedureId: 'PROC-FHNE' } },
  A10: { treatmentId: 'TX-THR', route: retry, missingInfo: ['骨量評估', '植入物適配', '骨骼成熟度', '專科評估'] },
  A11: { treatmentId: 'TX-BRIDGE-REFERRAL', route: { kind: 'explain', procedureId: 'PROC-NONSURGICAL' } },
  A12: { treatmentId: 'TX-TPLO', route: retry },
  A13: { treatmentId: 'TX-MPL-COMBO', route: { kind: 'module', procedureId: 'PROC-MPL-COMBO' } },
  A14: { treatmentId: 'TX-BRIDGE-REFERRAL', route: { kind: 'explain', procedureId: 'PROC-NONSURGICAL' } },
  A15: { treatmentId: 'TX-SULCOPLASTY-ONLY', route: retry },
  A16: { treatmentId: 'TX-TPLO', route: retry },
  A17: { treatmentId: 'TX-OBSERVE-FOLLOWUP', route: { kind: 'module', procedureId: 'PROC-NONSURGICAL' } },
  A18: { treatmentId: 'TX-MPL-COMBO', route: retry },
  A19: { treatmentId: 'TX-RECHECK-ON-SIGNS', route: { kind: 'module', procedureId: 'PROC-NONSURGICAL' } },
  A20: { treatmentId: 'TX-NO-FOLLOWUP', route: retry },
  A21: { treatmentId: 'TX-OA-MULTIMODAL', route: { kind: 'module', procedureId: 'PROC-NONSURGICAL' } },
  A22: { treatmentId: 'TX-THR', route: retry, missingInfo: ['確認主要疼痛來源', '保守管理反應', '植入條件與專科評估'] },
  A23: { treatmentId: 'TX-LASER-ONLY', route: retry },
  A24: { treatmentId: 'TX-STRICT-CAGE-REST', route: retry },
  A29: {
    treatmentId: 'TX-ORIF-PLATE',
    route: { kind: 'module', procedureId: 'PROC-ORIF-PLATE' },
    flags: [{ code: 'IMPLANT-SIZE', message: '骨板尺寸（2.0/2.4 mm）為本病例資料設定，不代表通用選配規則。' }],
  },
  A30: {
    treatmentId: 'TX-EXTERNAL-COAPTATION',
    route: retry,
    flags: [{ code: 'ID-T05-CONFLICT', message: '原始處置ID為 T05（術式表定義為關節囊外固定），此處實際語意為外副木；已改用 TX-EXTERNAL-COAPTATION，不連到囊外固定畫面。' }],
  },
  A31: {
    treatmentId: 'TX-IM-PIN-ONLY',
    route: retry,
    flags: [{ code: 'ID-T06-CONFLICT', message: '原始處置ID為 T06（術式表定義為 TTA），此處實際語意為髓內釘；已改用 TX-IM-PIN-ONLY。' }],
  },
  A32: { treatmentId: 'TX-CAGE-REST-ANALGESIA-FRACTURE', route: retry },
  A33: {
    treatmentId: 'TX-ORIF-PLATE',
    route: { kind: 'module', procedureId: 'PROC-ORIF-PLATE' },
    feedbackOverride: '股骨幹短斜骨折以骨板提供穩固的解剖固定，以抵抗強大肌拉力。本關以「每側 6 皮質」作為遊戲幾何門檻，並非通用臨床規則。',
    flags: [
      { code: 'PLATE-ROD-NOT-MODELED', message: '選項名稱包含 Plate-Rod 複合固定，本版操作模組只模擬骨板構型。' },
      { code: 'CORTEX-RULE', message: '原始敘述「每側骨段至少咬合 6 骨皮質」未找到直接支持前，不顯示為通用臨床規則。' },
    ],
  },
  A34: {
    treatmentId: 'TX-IM-PIN-CERCLAGE',
    route: retry,
    categoryOverride: 'insufficient',
    scoreOverride: null,
    missingInfo: [
      '折線長度與骨幹直徑之比：本例 X 光描述為「短斜骨折」，與此選項自身條件「斜折線長度需大於骨幹直徑 2 倍」衝突',
      '專科審閱確認此替代方案於本例是否成立',
    ],
    flags: [
      { code: 'A34-REVIEW', message: '原始答案類別為「可接受替代」（8 分）。因條件與本例短斜骨折矛盾，標示為「條件不足／待審閱」，不計分。' },
      { code: 'ID-T06-CONFLICT', message: '原始處置ID為 T06（術式表定義為 TTA），此處實際語意為髓內釘＋環扎；已改用 TX-IM-PIN-CERCLAGE。' },
    ],
  },
  A35: {
    treatmentId: 'TX-EXTERNAL-COAPTATION',
    route: retry,
    flags: [{ code: 'ID-T05-CONFLICT', message: '原始處置ID為 T05（術式表定義為關節囊外固定），此處實際語意為外夾板／包紮；已改用 TX-EXTERNAL-COAPTATION。' }],
  },
  A36: { treatmentId: 'TX-CAGE-REST-ANALGESIA-FRACTURE', route: retry },
};

/** Display overrides for clue text that contains claims not yet supported. */
export const CLUE_OVERRIDES: Record<string, { result: string; flag: string }> = {
  'C07-E4': {
    result: '小型玩具犬橈骨遠端髓腔狹窄、血供有限；單獨外副木固定的癒合風險較高，需考慮剛性內固定。',
    flag: '原始文字含「單獨外副木固定之不癒合率高達 70~80%」，尚未找到直接支持，暫不顯示為臨床數據（待審閱）。',
  },
};

export const ANSWER_CATEGORY_FROM_SOURCE: Record<string, AnswerCategory> = {
  本病例優先: 'preferred',
  可接受替代: 'alternative',
  條件不足: 'insufficient',
  不適合: 'unsuitable',
};
