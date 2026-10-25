// Ranks what the player should improve first. Order reflects teaching
// priority (G01 design assumption): reasoning errors, then operation and care.

import { optionsForCase } from '../data';
import { ANSWER_LABEL } from '../types';
import { LEVEL_LABEL } from '../config/tolerances';
import { activeProcedure, quizQuestions, type CaseSession } from './session';
import type { ToleranceLevel } from '../types';

export interface Improvement {
  area: '推理' | '定位' | '操作' | '照護' | '檢查';
  text: string;
}

export function improvements(s: CaseSession): Improvement[] {
  const out: Improvement[] = [];
  const opts = optionsForCase(s.caseId);
  const scored = opts.find((o) => o.id === s.scoredOptionId);
  const preferred = opts.find((o) => o.category === 'preferred');
  if (scored && scored.category === 'unsuitable')
    out.push({ area: '推理', text: `首次計分的處置「${scored.name}」不適合本例：${scored.feedback} 本病例優先為「${preferred?.name}」。` });
  for (const q of quizQuestions(s)) {
    if (s.quiz?.first[q.id] === false) {
      const right = q.options.filter((o) => o.correct).map((o) => o.text).join('／');
      out.push({ area: '推理', text: `判斷題「${q.prompt}」首次未答對：答案為「${right}」（依據 ${q.basis.join('、')}）。` });
    }
  }
  if (s.localization?.firstCorrect === false) out.push({ area: '定位', text: '患肢定位首次未答對：先讀主訴與步態，並注意俯視圖左右＝病患左右。' });
  const parts = (s.moduleResult?.detail as { parts?: { label: string; level: ToleranceLevel }[] } | undefined)?.parts ?? [];
  for (const p of parts.filter((x) => x.level !== 'perfect'))
    out.push({ area: '操作', text: `「${p.label}」評價為 ${LEVEL_LABEL[p.level]}：可再練習微調到 PERFECT（遊戲幾何門檻）。` });
  // module notes: only actionable ones (first-attempt misses, attempted unsafe holes)
  const moduleArea = activeProcedure(s) === 'PROC-NONSURGICAL' ? '照護' : '操作';
  for (const n of s.moduleResult?.notes ?? []) if (/首次|曾嘗試/.test(n) && !/不影響分數|不計分/.test(n)) out.push({ area: moduleArea, text: n });
  for (const n of s.careResult?.notes ?? []) out.push({ area: '照護', text: n });
  if (scored && scored.category === 'alternative')
    out.push({ area: '推理', text: `「${scored.name}」是${ANSWER_LABEL.alternative}（不是錯誤）；本例的優先方案是「${preferred?.name}」。` });
  if (s.prematureDecisions) out.push({ area: '檢查', text: `有 ${s.prematureDecisions} 次在必做線索完成前作答：先蒐集線索再推理。` });
  for (const d of s.decisions.filter((x) => x.outcome === 'insufficient')) {
    const o = opts.find((x) => x.id === d.optionId);
    if (o) out.push({ area: '推理', text: `「${o.name}」為條件不足（不計分，不是錯誤）：${o.missingInfo.join('；')}` });
  }
  // de-duplicate by text
  return out.filter((x, i) => out.findIndex((y) => y.text === x.text) === i);
}
