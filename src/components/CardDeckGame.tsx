import { useState, type ReactNode } from 'react';
import { scoreRound, type CareCard, type CareDeck } from '../data/careDecks';
import { illust } from './illustrations';
import { ModuleShell } from './ModuleShell';
import { useModuleState } from './useModuleState';
import { RefChips } from './ui';
import { sound } from '../audio';
import type { ModuleResult } from '../engine/session';

interface DeckState {
  round: number;
  picks: Record<string, string[]>;
  feedback: Record<string, boolean>;
  completed: boolean;
}

/** Illustration for a card, chosen by its category only (correct cards and distractors share them). */
function cardArt(card: CareCard): string | null {
  switch (card.tag) {
    case '活動':
      return illust('care/activity');
    case '追蹤':
      return illust('care/recheck');
    case '警訊':
      return illust('care/warning');
    case '傷口與疼痛':
      return illust(/傷口/.test(card.text) ? 'care/wound' : 'care/pain');
    default:
      return null;
  }
}

/**
 * Multi-round care-card builder. Each round is scored on its FIRST submission
 * (kept in sticky storage); later submissions only unlock progress.
 */
export function CardDeckGame({ deck, stateKey, title, subtitle, onDone, theme = 'clinic', intro }: { deck: CareDeck; stateKey: string; title: string; subtitle?: string; onDone: (r: ModuleResult) => void; theme?: 'clinic' | 'surgery'; intro?: ReactNode }) {
  const ms = useModuleState<DeckState>(stateKey, () => ({ round: 0, picks: {}, feedback: {}, completed: false }));
  const s = ms.state;
  const round = deck.rounds[Math.min(s.round, deck.rounds.length - 1)];
  const picks = s.picks[round.id] ?? [];
  const shown = s.feedback[round.id] ?? false;
  const res = scoreRound(round, picks);
  const [announce, setAnnounce] = useState('');

  const toggle = (id: string) => {
    if (shown && res.passed) return;
    ms.set((p) => {
      const cur = p.picks[round.id] ?? [];
      const next = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
      return { ...p, picks: { ...p.picks, [round.id]: next }, feedback: { ...p.feedback, [round.id]: false } };
    });
  };

  const submit = () => {
    ms.recordFirst(round.id, res.score);
    ms.set((p) => ({ ...p, feedback: { ...p.feedback, [round.id]: true } }));
    sound.play(res.passed ? 'success' : 'warn');
    setAnnounce(res.passed ? '本回合完成' : `還有 ${res.missed.length} 張適合的卡未選、${res.wrong.length} 張不適合的卡被選`);
  };

  const next = () => {
    if (s.round + 1 < deck.rounds.length) {
      ms.set((p) => ({ ...p, round: p.round + 1 }));
      setAnnounce('');
      return;
    }
    ms.set((p) => ({ ...p, completed: true }));
    const firsts = deck.rounds.map((r) => (typeof ms.sticky[r.id] === 'number' ? (ms.sticky[r.id] as number) : r.id === round.id ? res.score : 0));
    const score = Math.round(firsts.reduce((a, b) => a + b, 0) / firsts.length);
    const notes = deck.rounds
      .map((r, i) => (firsts[i] < 100 ? `「${r.title}」首次作答 ${firsts[i]} 分：回顧卡片說明。` : null))
      .filter((x): x is string => !!x);
    onDone({ score, notes, detail: { firsts } });
  };

  return (
    <ModuleShell
      title={title}
      subtitle={subtitle}
      steps={deck.rounds.map((r) => r.title)}
      current={s.completed ? deck.rounds.length : s.round}
      done={(i) => s.completed || i < s.round}
      hint={<p>每張卡都對應原始資料的照護建議或限制。選出所有適合本病例的卡，不適合的不要選。</p>}
      onUndo={ms.undo}
      onReset={ms.reset}
      canUndo={ms.canUndo}
      onHint={ms.countHint}
      theme={theme}
    >
      <div className="care-board">
        {intro && <div className="care-patient">{intro}</div>}
        <section className="care-plan" aria-label="照護計畫" data-testid="care-plan">
          <h4>🐾 照護計畫・{round.title}</h4>
          {picks.length ? (
            <ul>
              {round.cards
                .filter((c) => picks.includes(c.id))
                .map((c) => (
                  <li key={c.id}>
                    <span className="tag">{c.tag}</span> {c.text}
                  </li>
                ))}
            </ul>
          ) : (
            <p className="small muted">尚未加入卡片：從下方選出適合本病例的照護項目。</p>
          )}
        </section>
      </div>
      <p>{round.prompt}</p>
      <div className="deck" role="group" aria-label={round.title}>
        {round.cards.map((card) => {
          const on = picks.includes(card.id);
          let cls = '';
          if (shown) cls = on ? (card.correct ? 'right' : 'wrong') : card.correct ? 'missed' : '';
          return (
            <button key={card.id} className={`care-card ${cls}`} aria-pressed={on} onClick={() => toggle(card.id)} data-testid={`card-${card.id}`} data-correct={card.correct ? 'y' : 'n'}>
              {cardArt(card) && <img className="care-card-art" src={cardArt(card)!} alt="" aria-hidden loading="lazy" />}
              <span className="tag">{card.tag}</span>
              <b>{card.text}</b>
              {shown && (on || card.correct) && (
                <span className="why">
                  {on && card.correct && '✓ 適合：'}
                  {on && !card.correct && '✕ 不適合：'}
                  {!on && card.correct && '△ 漏選：'}
                  {card.reason}（依據 {card.basis}）
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="row" style={{ marginTop: 12 }}>
        <button className="btn primary" onClick={submit} disabled={picks.length === 0 || (shown && res.passed)} data-testid="deck-submit">
          送出本回合
        </button>
        {shown && res.passed && (
          <button className="btn accent" onClick={next} disabled={s.completed} data-testid="deck-next">
            {s.round + 1 < deck.rounds.length ? '下一回合 →' : '完成'}
          </button>
        )}
        <span className="small muted" aria-live="polite">
          {announce}
          {shown && !res.passed && '：請調整後再送出（首次作答已記錄）。'}
        </span>
        <span className="spacer" />
        <RefChips ids={round.referenceIds} />
      </div>
    </ModuleShell>
  );
}
