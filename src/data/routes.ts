// Content for "decision explanation / referral" routes: alternatives that are
// acceptable but have no playable module in this build. Nothing here pretends
// to be an operation; it explains the choice and the follow-up path.

export interface ExplainRoute {
  title: string;
  summary: string;
  nextSteps: string[];
  basis: string[];
}

export const EXPLAIN_ROUTES: Record<string, ExplainRoute> = {
  A02: {
    title: '關節囊外固定：決策解說路線',
    summary: '可接受替代，不等於醫療錯誤。此術式在原始資料中「固定點與張力示意待設計、完成條件待專科定義」，本版只提供決策解說，不提供操作畫面。',
    nextSteps: ['與飼主討論活動需求、構型與術者經驗（A02 必要條件）', '完成術前骨骼與麻醉評估', '若改走本病例優先方案，可返回決策區改選並進入 TPLO 概念操作'],
    basis: ['A02', 'T05（術式模組）'],
  },
  A06: {
    title: '關節囊外固定：決策解說路線',
    summary: '不因小型犬而強制只有囊外固定；需整合骨骼構型與功能需求。本版只提供決策解說，不提供操作畫面。',
    nextSteps: ['整合骨骼構型與功能需求（A06 必要條件）', '評估小型犬用植入物的可行性（C02-E4）', '可返回決策區改選本病例優先方案'],
    basis: ['A06', 'T05（術式模組）'],
  },
  A11: {
    title: '短期止痛並安排轉介：橋接路線',
    summary: '作為手術評估前的橋接，緩解症狀並持續處理原因；不得宣稱可逆轉股骨頭塌陷。',
    nextSteps: ['短期疼痛管理（藥物與劑量由獸醫依個體決定）', '安排轉介，討論 FHNE 與 THR 的差異（C03-E4）', '持續疼痛影響日常功能時，回到手術評估'],
    basis: ['A11', 'C03-E4', 'P02'],
  },
  A14: {
    title: '多模式管理並轉介：橋接路線',
    summary: '作為等待手術評估的橋接。有症狀病例需持續評估，不能只保證會自行好轉。',
    nextSteps: ['多模式管理（個別化止痛、活動調整）', '轉介評估組合矯正', '追蹤跳步頻率與功能；症狀加重提前回診'],
    basis: ['A14', 'P03'],
  },
};
