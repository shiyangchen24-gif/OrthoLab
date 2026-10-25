// Core domain types for OrthoLab. Data (src/data) and UI (src/screens, src/modules)
// only meet through these shapes.

export type Species = '犬' | '貓';

/** Review status attached to any record whose source data has a known issue. */
export interface ReviewFlag {
  code: string;
  message: string;
}

export interface Disease {
  id: string;
  name: string;
  species: string;
  region: string;
  presentation: string;
  diagnosticFlow: string;
  differentials: string;
  treatmentDirection: string;
  selectionCriteria: string;
  limitations: string;
  referenceIds: string[];
  versionScope: string;
  /** Derived: true only if a playable case exists in this build. */
  hasPlayableCase: boolean;
  reviewFlags: ReviewFlag[];
}

export type ClueCategory = 'history' | 'ortho' | 'imaging' | 'supplement';

export interface Clue {
  id: string;
  caseId: string;
  examName: string;
  category: ClueCategory;
  result: string;
  required: boolean;
  /** Empty array means available from the start (原始值「開始」). */
  prerequisiteIds: string[];
  imageId: string | null;
  assetStatus: string;
  referenceIds: string[];
  reviewFlags: ReviewFlag[];
}

export interface Case {
  id: string;
  diseaseId: string;
  species: Species;
  breed: string;
  ageMonths: number;
  weightKg: number;
  bcs9: number;
  side: string;
  complaint: string;
  systemicStatus: string;
  difficulty: string;
  /** Original 建議模組ID cell, kept for traceability. */
  rawModuleId: string;
  /** Resolved unique procedure id of the case's preferred playable module. */
  procedureId: ProcedureId;
  dataNature: string;
  referenceIds: string[];
  /** Every case in this game is fictional teaching material. */
  fictional: true;
  pose: PatientPose;
}

export type PatientPose = 'hind-lift' | 'fore-lift' | 'crouch' | 'stand-alert' | 'sit-stiff';

export type AnswerCategory = 'preferred' | 'alternative' | 'insufficient' | 'unsuitable';

export const ANSWER_LABEL: Record<AnswerCategory, string> = {
  preferred: '本病例優先',
  alternative: '可接受替代',
  insufficient: '條件不足',
  unsuitable: '不適合',
};

/** Unique, semantic treatment ids (one per distinct technique / plan). */
export type TreatmentId = string;

/** Unique procedure (module) ids; decoupled from the overloaded raw T05/T06. */
export type ProcedureId =
  | 'PROC-TPLO'
  | 'PROC-FHNE'
  | 'PROC-MPL-COMBO'
  | 'PROC-NONSURGICAL'
  | 'PROC-ORIF-PLATE'
  | 'PROC-ECS'
  | 'PROC-TTA'
  | 'PROC-THR'
  | 'PROC-SULCOPLASTY-ONLY'
  | 'PROC-ANESTHESIA';

export interface TreatmentTechnique {
  id: TreatmentId;
  name: string;
  /** Procedure module that teaches it, or null when no module exists. */
  procedureId: ProcedureId | null;
  description: string;
}

export interface TreatmentOption {
  id: string; // 判定ID, e.g. A01
  caseId: string;
  /** Original 處置ID cell (T05 / T06 are overloaded in the source). */
  rawProcedureId: string;
  treatmentId: TreatmentId;
  name: string;
  category: AnswerCategory;
  /** Category as written in the source sheet, before review overrides. */
  sourceCategory: AnswerCategory;
  requiredConditions: string;
  commonThreshold: string;
  /** Teaching score for this level only; null stays null (never 0). */
  score: number | null;
  sourceScore: number | null;
  feedback: string;
  scoreSourceId: string;
  referenceIds: string[];
  /** For 'insufficient': what else would be needed. */
  missingInfo: string[];
  /** Where the player goes after choosing this option. */
  route: OptionRoute;
  reviewFlags: ReviewFlag[];
}

export type OptionRoute =
  | { kind: 'module'; procedureId: ProcedureId }
  | { kind: 'explain'; procedureId: ProcedureId | null }
  | { kind: 'retry' };

export type ModuleStatus = 'playable' | 'decision-only' | 'component' | 'not-implemented';

export interface ProcedureModule {
  procedureId: ProcedureId;
  rawIds: string[];
  name: string;
  version: string;
  caseIds: string[];
  flow: string;
  requiredAssets: string;
  completion: string;
  limitations: string;
  stepMapping: string;
  referenceIds: string[];
  status: ModuleStatus;
  statusNote: string;
}

export interface ProcedureStep {
  id: string;
  procedureId: ProcedureId;
  rawProcedureId: string;
  prerequisite: string;
  action: string;
  interaction: string;
  successCriteria: string;
  errorHint: string;
  retryRule: string;
  pendingLimits: string;
  designSourceId: string;
  referenceIds: string[];
  /** false when the source explicitly forbids numeric scoring of the step. */
  numericScoringAllowed: boolean;
}

export interface CarePlan {
  id: string;
  /** Raw 對應ID: a module id (T01…) or a case id (C05/C06). */
  targetRawId: string;
  procedureId: ProcedureId | null;
  caseId: string | null;
  stage: string;
  activity: string;
  woundPain: string;
  followUp: string;
  warnings: string;
  feedbackFocus: string;
  referenceIds: string[];
  status: string;
}

export interface Asset {
  id: string;
  targetRawId: string;
  usage: string;
  content: string;
  licenseNote: string;
  acceptance: string;
  pitfalls: string;
  feedback: string;
  filePath: string | null;
  license: string;
  referenceIds: string[];
  status: string;
  /** True when this build renders an in-app teaching vector for it. */
  renderedInApp: boolean;
}

export type EvidenceClass =
  | 'systematic-review'
  | 'clinical-guideline'
  | 'monograph'
  | 'society-education'
  | 'university-education'
  | 'narrative-review'
  | 'design-assumption'
  | 'source-request';

export const EVIDENCE_LABEL: Record<EvidenceClass, string> = {
  'systematic-review': '系統性回顧',
  'clinical-guideline': '臨床指引',
  monograph: '專著',
  'society-education': '學會衛教',
  'university-education': '大學獸醫衛教',
  'narrative-review': '敘述性回顧',
  'design-assumption': '遊戲設計假設',
  'source-request': '原始需求資料（非醫療證據）',
};

export interface Reference {
  id: string;
  title: string;
  evidenceTypeRaw: string;
  evidenceClass: EvidenceClass;
  species: string;
  supports: string;
  url: string | null;
  checkedDate: string | null;
  limitation: string;
  /** 'citation' = specific article; 'landing-page' = only a homepage, chapter/page unconfirmed. */
  locatorStatus: 'citation' | 'landing-page' | 'not-applicable';
  locatorNote: string;
}

export type ToleranceLevel = 'perfect' | 'pass' | 'adjust' | 'fail';

/**
 * One metric's complete banding. Bands are evaluated in order and must
 * cover the full real line (validated in tests) so there are no scoring holes.
 */
export interface ToleranceBand {
  level: ToleranceLevel;
  /** inclusive lower bound (or -Infinity) */
  min: number;
  /** exclusive upper bound unless maxInclusive */
  max: number;
  minInclusive: boolean;
  maxInclusive: boolean;
}

export interface ToleranceConfig {
  id: string;
  label: string;
  unit: string;
  sourceParamId: string | null;
  /** 'lower-better' or 'higher-better' just for display. */
  direction: 'lower-better' | 'higher-better';
  bands: ToleranceBand[];
  points: number;
  note: string;
}

export interface StageScores {
  exam: number | null;
  reasoning: number | null;
  operation: number | null;
  care: number | null;
}

export interface LearningRecord {
  eventId: string;
  caseId: string;
  kind: 'first' | 'practice';
  completedAt: string;
  optionId: string | null;
  decisionCategory: AnswerCategory | null;
  route: 'module' | 'explain';
  procedureId: ProcedureId | null;
  scores: StageScores;
  total: number | null;
  hintsUsed: number;
  snapUsed: boolean;
  prematureDecisions: number;
  insufficientChoices: string[];
  notes: string[];
  elapsedSec: number;
}
