// Onboarding guide: derives ONE current action from the session, plus its
// completion condition and the next stage. No separate guide state machine:
// the guide can never disagree with what the game actually allows.

import { cluesForCase } from '../data';
import { activeProcedure, clueAvailable, isLocalized, missingRequiredClues, quizDone, quizQuestions, type CaseSession } from './session';
import { hasTploPlanning, planDone, type TploState } from './tploPlan';
import { dxItems } from '../data/tploDx';
import { dxDone, dxState } from './tploDx';

export const FLOW = ['接診', '患肢定位', '檢查與影像', '處置推理', '手術／管理', '照護', '結算'];
/** CrCL cases with a TPLO route add digital pre-operative planning before the surgery. */
export const FLOW_PLANNING = ['接診', '患肢定位', '檢查與影像', '處置推理', '術前規劃', '手術／管理', '照護', '結算'];

export const flowFor = (s: CaseSession) => (hasTploPlanning(s.caseId) ? FLOW_PLANNING : FLOW);

/** Index into flowFor(s). */
export function flowIndex(s: CaseSession): number {
  const planning = hasTploPlanning(s.caseId);
  const extra = planning ? 1 : 0;
  if (s.stage === 'results') return 6 + extra;
  if (s.stage === 'care') return 5 + extra;
  if (s.stage === 'explain') return 4 + extra;
  if (s.stage === 'procedure') {
    if (planning && activeProcedure(s) === 'PROC-TPLO' && !planDone(s.moduleState['PROC-TPLO'] as TploState | undefined)) return 4;
    return 4 + extra;
  }
  if (!isLocalized(s)) return 1;
  if (missingRequiredClues(s).length) return 2;
  return 3;
}

export interface GuideStep {
  stage: string;
  doNow: string;
  done: string;
  next: string;
  /** CSS selector of the single element to highlight. */
  target: string | null;
}

export function guideFor(s: CaseSession, hasVerdictWithRoute = false): GuideStep {
  const flow = flowFor(s);
  const raw = flowIndex(s);
  const next = flow[raw + 1] ?? '再練習或下一位病患';
  const stage = flow[raw];
  const planning = hasTploPlanning(s.caseId);
  if (planning && raw === 4 && s.stage === 'procedure')
    return { stage, doNow: '在數位術前規劃中依左側步驟完成量測與規劃，最後輸出術前規劃表。', done: '規劃表已輸出。', next, target: '[data-testid="plan-steps"]' };
  // map the planning flow back onto the shared cases below
  const i = planning && raw >= 4 ? raw - 1 : raw;
  switch (i) {
    case 1:
      return {
        stage,
        doNow: '閱讀主訴與步態，在俯視圖點選患肢（也可用文字按鈕），再按「確認患肢」。',
        done: '指出本病例的患肢。',
        next,
        target: '[data-guide="limb-confirm"]',
      };
    case 2: {
      const missing = missingRequiredClues(s);
      const clues = cluesForCase(s.caseId);
      const nextClue = missing.find((c) => clueAvailable(s, c.id)) ?? missing[0];
      const req = clues.filter((c) => c.required).length;
      return {
        stage,
        doNow: `進行檢查：「${nextClue.examName}」。結果會加入病歷，可隨時重讀。`,
        done: `必做檢查 ${req - missing.length}/${req}。`,
        next,
        target: `[data-testid="exam-${nextClue.id}"]`,
      };
    }
    case 3: {
      if (!dxDone(s)) {
        const q = dxItems(s.caseId).find((x) => !x.options.some((o) => o.correct && o.id === dxState(s).answers[x.id]))!;
        return { stage, doNow: `影像評估與診斷：「${q.prompt}」`, done: '影像評估、診斷與適應症都確認。', next: '推理判斷題', target: `[data-guide="dx-${q.id}"]` };
      }
      if (!quizDone(s)) {
        const q = quizQuestions(s).find((x) => !x.options.some((o) => o.correct && o.id === s.quiz?.answers[x.id]))!;
        return { stage, doNow: `回答判斷題：「${q.prompt}」`, done: '三題判斷題都答對（首次作答會記錄）。', next: '選擇處置', target: `[data-guide="quiz-${q.id}"]` };
      }
      return hasVerdictWithRoute
        ? { stage, doNow: '閱讀回饋與來源；若要採用此處置，按「進入」。', done: '選定一個可進行的處置。', next, target: '[data-testid="proceed"]' }
        : { stage, doNow: '選擇一個處置，閱讀回饋與理由。', done: '選定一個可進行的處置。', next, target: '[data-guide="options"]' };
    }
    case 4: {
      const proc = activeProcedure(s);
      if (s.stage === 'explain') return { stage, doNow: '閱讀解說與轉介路線，再選擇結算或返回改選。', done: '完成本路線。', next: '結算', target: '[data-testid="explain-finish"]' };
      if (proc === 'PROC-ORIF-PLATE')
        return { stage, doNow: '依操作區上方的「➜」指引完成目前步驟，再按「完成檢核」。', done: '五個手術步驟都通過檢核。', next, target: '[data-testid="coach-bar"]' };
      if (proc === 'PROC-TPLO' && planning)
        return { stage, doNow: '依術前規劃表完成手術步驟，每步完成後按「完成本步驟」。', done: '十個手術步驟與術後 X 光檢核都完成。', next, target: '[data-testid="surgery-steps"]' };
      if (proc === 'PROC-NONSURGICAL') return { stage, doNow: '選出適合本病例的管理卡，按「送出本回合」。', done: '三個回合都完成。', next: '結算', target: '[data-testid="deck-submit"]' };
      return { stage, doNow: '依操作區提示完成目前步驟，再按「完成檢核」。', done: '模組所有步驟都通過檢核。', next, target: null };
    }
    case 5:
      return { stage, doNow: '選出所有適合本病例的照護卡，按「送出本回合」。', done: '照護計畫正確。', next, target: '[data-testid="deck-submit"]' };
    default:
      return { stage: flow[flow.length - 1], doNow: '查看各階段表現與最值得改善的地方。', done: '—', next, target: '[data-guide="improve"]' };
  }
}
