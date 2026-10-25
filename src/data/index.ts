// Normalises the extracted workbook (generated/source.json) into typed records.
// Raw IDs are preserved; review overrides come from ./mapping.ts.

import raw from './generated/source.json';
import type {
  Asset,
  CarePlan,
  Case,
  Clue,
  ClueCategory,
  Disease,
  EvidenceClass,
  ModuleStatus,
  PatientPose,
  ProcedureId,
  ProcedureModule,
  ProcedureStep,
  Reference,
  ReviewFlag,
  Species,
  TreatmentOption,
} from '../types';
import {
  ANSWER_CATEGORY_FROM_SOURCE,
  CLUE_OVERRIDES,
  MODULE_RAW_TO_PROCEDURE,
  OPTION_RESOLUTION,
  TECHNIQUES,
} from './mapping';

type Row = Record<string, string | number | null | undefined>;

const s = (v: unknown): string => (v === null || v === undefined ? '' : String(v));
const ids = (v: unknown): string[] =>
  s(v)
    .split(/[;；]/)
    .map((x) => x.trim())
    .filter(Boolean);
const num = (v: unknown): number => {
  if (typeof v === 'number') return v;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`expected number, got ${String(v)}`);
  return n;
};
const numOrNull = (v: unknown): number | null =>
  v === null || v === undefined || v === '' ? null : num(v);

const src = raw as unknown as Record<string, Row[]> & { _meta: { sheetNames: string[] } };

export const SOURCE_SHEETS: string[] = src._meta.sheetNames;

// ---------- cases ----------
const POSES: Record<string, PatientPose> = {
  C01: 'hind-lift',
  C02: 'hind-lift',
  C03: 'hind-lift',
  C04: 'hind-lift',
  C05: 'stand-alert',
  C06: 'sit-stiff',
  C07: 'fore-lift',
  C08: 'crouch',
};

export const cases: Case[] = src.cases.map((r) => {
  const id = s(r['病例ID']);
  const rawModuleId = s(r['建議模組ID']);
  return {
    id,
    diseaseId: s(r['疾病ID']),
    species: s(r['物種']) as Species,
    breed: s(r['品種']),
    ageMonths: num(r['月齡']),
    weightKg: num(r['體重kg']),
    bcs9: num(r['BCS_9分']),
    side: s(r['患側']),
    complaint: s(r['主訴與病程']),
    systemicStatus: s(r['全身及麻醉狀態']),
    difficulty: s(r['難度']),
    rawModuleId,
    procedureId: MODULE_RAW_TO_PROCEDURE[rawModuleId],
    dataNature: s(r['資料性質']),
    referenceIds: ids(r['來源ID']),
    fictional: true,
    pose: POSES[id] ?? 'stand-alert',
  };
});

// ---------- diseases ----------
const DISEASE_FLAGS: Record<string, ReviewFlag[]> = {
  D09: [
    { code: 'CORTEX-RULE', message: '「每側至少咬合 6 骨皮質」與「2.0/2.7/3.5 mm LCP」為原始資料敘述，尚未找到直接支持，不作為通用臨床規則。' },
    { code: 'NONUNION-RATE', message: '原始資料提及副木不癒合率，數字未經查證，不顯示。' },
  ],
  D10: [{ code: 'NO-CASE', message: '來源標示第一版，但沒有病例、線索與操作資料；本版只列入知識庫。' }],
};

export const diseases: Disease[] = src.diseases.map((r) => {
  const id = s(r['疾病ID']);
  const hasPlayableCase = cases.some((c) => c.diseaseId === id);
  const flags = [...(DISEASE_FLAGS[id] ?? [])];
  if (!hasPlayableCase && s(r['版本範圍']) === '第一版' && !flags.some((f) => f.code === 'NO-CASE')) {
    flags.push({ code: 'NO-CASE', message: '來源標示第一版，但沒有病例與操作資料；本版只列入知識庫。' });
  }
  return {
    id,
    name: s(r['名稱']),
    species: s(r['物種適用']),
    region: s(r['部位']),
    presentation: s(r['常見表現']),
    diagnosticFlow: s(r['診斷流程']),
    differentials: s(r['鑑別診斷']),
    treatmentDirection: s(r['處置方向']),
    selectionCriteria: s(r['選術條件']),
    limitations: s(r['限制與修正']),
    referenceIds: ids(r['來源ID']),
    versionScope: s(r['版本範圍']),
    hasPlayableCase,
    reviewFlags: flags,
  };
});

// ---------- clues ----------
const CLUE_CATEGORY: Record<string, ClueCategory> = {
  '步態／病史': 'history',
  骨科觸診: 'ortho',
  'X 光判讀': 'imaging',
  處置補充資訊: 'supplement',
};

export const clues: Clue[] = src.clues.map((r) => {
  const id = s(r['線索ID']);
  const pre = s(r['前置解鎖ID']);
  const img = s(r['圖片ID']);
  const override = CLUE_OVERRIDES[id];
  const category = CLUE_CATEGORY[s(r['檢查名稱'])];
  if (!category) throw new Error(`unknown exam category for ${id}`);
  return {
    id,
    caseId: s(r['病例ID']),
    examName: s(r['檢查名稱']),
    category,
    result: override ? override.result : s(r['提供結果']),
    required: s(r['必做']) === '是',
    prerequisiteIds: pre === '開始' || pre === '' ? [] : ids(pre),
    imageId: img === '' || img === '不適用' ? null : img,
    assetStatus: s(r['素材狀態']),
    referenceIds: ids(r['來源ID']),
    reviewFlags: override ? [{ code: 'CLAIM-UNVERIFIED', message: override.flag }] : [],
  };
});

// ---------- treatment options ----------
export const techniques = TECHNIQUES;

export const options: TreatmentOption[] = src.treatments.map((r) => {
  const id = s(r['判定ID']);
  const res = OPTION_RESOLUTION[id];
  if (!res) throw new Error(`no resolution for option ${id}`);
  const sourceCategory = ANSWER_CATEGORY_FROM_SOURCE[s(r['答案類別'])];
  if (!sourceCategory) throw new Error(`unknown category for ${id}`);
  const sourceScore = numOrNull(r['處置分_提案']);
  const category = res.categoryOverride ?? sourceCategory;
  const score = 'scoreOverride' in res ? null : sourceScore;
  return {
    id,
    caseId: s(r['病例ID']),
    rawProcedureId: s(r['處置ID']),
    treatmentId: res.treatmentId,
    name: s(r['選項名稱']),
    category,
    sourceCategory,
    requiredConditions: s(r['必要條件']),
    commonThreshold: s(r['共通門檻']),
    score,
    sourceScore,
    feedback: res.feedbackOverride ?? s(r['理由與回饋']),
    scoreSourceId: s(r['分數來源']),
    referenceIds: ids(r['醫療來源ID']),
    missingInfo: res.missingInfo ?? [],
    route: res.route,
    reviewFlags: res.flags ?? [],
  };
});

// ---------- procedure modules ----------
const MODULE_STATUS: Record<ProcedureId, { status: ModuleStatus; note: string }> = {
  'PROC-TPLO': { status: 'playable', note: '概念操作：規劃核對、截骨旋轉示意、範本固定與影像檢核；截骨旋轉不做數值判分。' },
  'PROC-FHNE': { status: 'playable', note: '獨立流程：辨識、切除示意、殘留撞擊檢查與復健路線。' },
  'PROC-MPL-COMBO': { status: 'playable', note: '辨識排列 → 依所見選組合 → 操作示意 → 屈伸軌跡檢核。' },
  'PROC-NONSURGICAL': { status: 'playable', note: 'C05 觀察追蹤與 C06 慢性疼痛管理使用不同照護卡。' },
  'PROC-ORIF-PLATE': { status: 'playable', note: '主打模組：幾何復位、骨鉗、骨板定位、鑽孔量深鎖釘與雙視角檢核（2D 示意）。' },
  'PROC-ECS': { status: 'decision-only', note: '原始資料「待補／待專科定義」：只提供決策解說，不提供操作畫面。' },
  'PROC-TTA': { status: 'decision-only', note: '原始資料「待補」：需補適應條件與病例，只提供決策解說。' },
  'PROC-THR': { status: 'decision-only', note: '植入物與骨量評估資料不足：只顯示轉介路線。' },
  'PROC-SULCOPLASTY-ONLY': { status: 'component', note: '作為 T03 組合矯正的一個元件，非獨立模組。' },
  'PROC-ANESTHESIA': { status: 'not-implemented', note: '未提供完整麻醉事件資料：手術中只顯示模擬監測狀態，不產生隨機事件。' },
};

export const modules: ProcedureModule[] = src.modules.map((r) => {
  const raw = s(r['術式ID']);
  const procedureId = MODULE_RAW_TO_PROCEDURE[raw];
  const st = MODULE_STATUS[procedureId];
  return {
    procedureId,
    rawIds: [raw],
    name: s(r['名稱']),
    version: s(r['版本']),
    caseIds: ids(r['病例對應']),
    flow: s(r['互動流程']),
    requiredAssets: s(r['所需素材']),
    completion: s(r['完成條件']),
    limitations: s(r['限制與修正']),
    stepMapping: s(r['步驟對應']),
    referenceIds: ids(r['來源ID']),
    status: st.status,
    statusNote: st.note,
  };
});

// ---------- steps ----------
const STEP_TEXT_OVERRIDES: Record<string, Partial<Pick<ProcedureStep, 'successCriteria'>>> = {
  'T09-S1': { successCriteria: '各視角成角偏差與軸向／側向位移誤差達到容差設定（單一設定檔 src/config/tolerances.ts）' },
  'T09-S4': { successCriteria: '完成本病例預設螺釘構型；有效螺釘須避開骨折線安全距與關節面（遊戲幾何門檻）' },
};

export const steps: ProcedureStep[] = src.steps.map((r) => {
  const id = s(r['步驟ID']);
  const rawProc = s(r['術式ID']);
  const success = s(r['成功條件']);
  const err = s(r['錯誤提示']);
  return {
    id,
    procedureId: MODULE_RAW_TO_PROCEDURE[rawProc],
    rawProcedureId: rawProc,
    prerequisite: s(r['前置依賴']),
    action: s(r['教學操作']),
    interaction: s(r['互動方式']),
    successCriteria: STEP_TEXT_OVERRIDES[id]?.successCriteria ?? success,
    errorHint: err,
    retryRule: s(r['重試規則']),
    pendingLimits: s(r['待補限制']),
    designSourceId: s(r['設計來源']),
    referenceIds: ids(r['醫療來源ID']),
    numericScoringAllowed: !/禁止上線判分/.test(err),
  };
});

// ---------- resources: care plans & assets ----------
const RENDERED_ASSETS = new Set(['C01-IMG', 'C02-IMG', 'C03-IMG', 'C04-IMG', 'C05-IMG', 'C06-IMG', 'C07-IMG', 'C08-IMG', 'T09-AST1', 'T09-AST2']);

export const carePlans: CarePlan[] = [];
export const assets: Asset[] = [];
for (const r of src.resources) {
  const id = s(r['資源ID']);
  const target = s(r['對應ID']);
  if (s(r['類型']) === '照護') {
    const isCase = /^C\d+$/.test(target);
    carePlans.push({
      id,
      targetRawId: target,
      procedureId: isCase ? 'PROC-NONSURGICAL' : MODULE_RAW_TO_PROCEDURE[target] ?? null,
      caseId: isCase ? target : null,
      stage: s(r['階段或用途']),
      activity: s(r['活動或素材內容']),
      woundPain: s(r['傷口及疼痛／授權']),
      followUp: s(r['追蹤或驗收']),
      warnings: s(r['警訊或限制']),
      feedbackFocus: s(r['回饋重點']),
      referenceIds: ids(r['來源ID']),
      status: s(r['狀態']),
    });
  } else {
    const fp = s(r['檔案路徑']);
    assets.push({
      id,
      targetRawId: target,
      usage: s(r['階段或用途']),
      content: s(r['活動或素材內容']),
      licenseNote: s(r['傷口及疼痛／授權']),
      acceptance: s(r['追蹤或驗收']),
      pitfalls: s(r['警訊或限制']),
      feedback: s(r['回饋重點']),
      filePath: fp === '' || fp === '待提供' || fp === '無' ? null : fp,
      license: s(r['素材授權']),
      referenceIds: ids(r['來源ID']),
      status: s(r['狀態']),
      renderedInApp: RENDERED_ASSETS.has(id),
    });
  }
}

// ---------- references ----------
const EVIDENCE: Record<string, EvidenceClass> = {
  系統性回顧: 'systematic-review',
  專科學會衛教: 'society-education',
  大學獸醫衛教: 'university-education',
  臨床指引: 'clinical-guideline',
  臨床敘述性回顧: 'narrative-review',
  權威專著指引: 'monograph',
  專科學會指引: 'monograph',
  設計假設: 'design-assumption',
  原始需求與資料: 'source-request',
};

const LANDING_PAGE_IDS = new Set(['R13', 'R14']);

export const references: Reference[] = src.references.map((r) => {
  const id = s(r['來源ID']);
  const evidenceTypeRaw = s(r['證據／資料類型']);
  const url = s(r['網址']);
  const evidenceClass = EVIDENCE[evidenceTypeRaw];
  if (!evidenceClass) throw new Error(`unknown evidence type ${evidenceTypeRaw}`);
  let locatorStatus: Reference['locatorStatus'] = 'citation';
  let locatorNote = '';
  if (evidenceClass === 'design-assumption' || evidenceClass === 'source-request') {
    locatorStatus = 'not-applicable';
    locatorNote = evidenceClass === 'source-request' ? '原始需求檔的私人連結，非公開醫療來源。' : '遊戲設計提案，不是醫療證據。';
  } else if (LANDING_PAGE_IDS.has(id)) {
    locatorStatus = 'landing-page';
    locatorNote = '網址只指向出版社／學會首頁：章節／頁碼待確認，尚未逐項驗證其支持的數字。';
  } else if (id === 'R12') {
    locatorNote = '原始資料未列作者；以 PMID 為準，作者待補。';
  }
  return {
    id,
    title: s(r['完整文獻或資源名稱']),
    evidenceTypeRaw,
    evidenceClass,
    species: s(r['適用物種']),
    supports: s(r['支持敘述與用途']),
    url: url === '' || url === '不適用' ? null : url,
    checkedDate: s(r['查核日期']) || null,
    limitation: s(r['證據限制']),
    locatorStatus,
    locatorNote,
  };
});

export interface RawToleranceRow {
  id: string;
  name: string;
  parsed: { ideal: number[]; pass: number[]; perfect: number[]; fail: number[]; points: number[] };
  rawPass: string;
  rawPerfect: string;
  rawFail: string;
}
export const rawTolerances: RawToleranceRow[] = src.tolerances.map((r) => ({
  id: s(r['參數ID']),
  name: s(r['參數名稱']),
  parsed: (r as unknown as { _parsed: RawToleranceRow['parsed'] })._parsed,
  rawPass: s(r['及格合格容差 (Pass)']),
  rawPerfect: s(r['完美評價容差 (Perfect)']),
  rawFail: s(r['失敗/扣分條件 (Fail)']),
}));

export interface ArtStyle {
  id: string;
  scene: string;
  style: string;
  background: string;
  accent: string;
}
export const artStyles: ArtStyle[] = src.artStyles.map((r) => ({
  id: s(r['風格模組ID']),
  scene: s(r['適用畫面與場景']),
  style: s(r['設計定位與風格']),
  background: s(r['背景主色碼 (HEX)']),
  accent: s(r['主體與重點色碼 (HEX)']),
}));

// ---------- lookups ----------
export const caseById = (id: string) => cases.find((c) => c.id === id);
export const diseaseById = (id: string) => diseases.find((d) => d.id === id);
export const cluesForCase = (id: string) => clues.filter((c) => c.caseId === id);
export const optionsForCase = (id: string) => options.filter((o) => o.caseId === id);
export const referenceById = (id: string) => references.find((r) => r.id === id);
export const moduleById = (id: ProcedureId) => modules.find((m) => m.procedureId === id);
export const stepsForProcedure = (id: ProcedureId) => steps.filter((st) => st.procedureId === id);
export const techniqueById = (id: string) => techniques.find((t) => t.id === id);
export const assetById = (id: string) => assets.find((a) => a.id === id);
export const carePlanForProcedure = (id: ProcedureId) => carePlans.find((p) => p.procedureId === id && p.caseId === null);
export const carePlanForCase = (caseId: string) => carePlans.find((p) => p.caseId === caseId);
