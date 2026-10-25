// Tool interaction layer shared by the scene levels.
//
//   select a tool (tap/click/keyboard)  ─┐
//   or drag it out of the tray          ─┴─▶ use it on a target zone ─▶ scene handler
//
// Zones only accept the tools listed in `accepts`; everything else (hover,
// repeated taps, invalid drops) produces feedback but never progress.

import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react';
import { ToolIcon, type ToolIconId } from './art';

export interface ToolDef {
  id: string;
  icon: ToolIconId;
  name: string;
  purpose: string;
  /** where it can be used, shown when selected */
  where: string;
  /** null = available; string = why it is locked */
  locked?: string | null;
  done?: boolean;
}

export interface Feedback {
  kind: 'ok' | 'warn' | 'info';
  text: string;
  /** monotonically increasing id so identical messages still re-trigger the animation */
  n: number;
}

export function useFeedback() {
  const [fb, setFb] = useState<Feedback | null>(null);
  const n = useRef(0);
  const say = useCallback((kind: Feedback['kind'], text: string) => setFb({ kind, text, n: ++n.current }), []);
  return { fb, say, clear: () => setFb(null) };
}

// ---------------- drag from tray ----------------
export interface DragState {
  tool: string;
  x: number;
  y: number;
  moved: boolean;
  zone: string | null;
}

function zoneAt(x: number, y: number): string | null {
  const el = document.elementFromPoint(x, y);
  return (el?.closest('[data-zone]') as HTMLElement | SVGElement | null)?.getAttribute('data-zone') ?? null;
}

export function useTrayDrag(onDrop: (tool: string, zone: string) => void, onTap: (tool: string) => void) {
  const [drag, setDrag] = useState<DragState | null>(null);
  const start = useRef<{ x: number; y: number } | null>(null);
  const live = useRef<DragState | null>(null);

  useEffect(() => {
    if (!drag) return;
    const move = (e: globalThis.PointerEvent) => {
      const s = start.current!;
      const moved = live.current!.moved || Math.hypot(e.clientX - s.x, e.clientY - s.y) > 10;
      const next = { ...live.current!, x: e.clientX, y: e.clientY, moved, zone: moved ? zoneAt(e.clientX, e.clientY) : null };
      live.current = next;
      setDrag(next);
    };
    const up = (e: globalThis.PointerEvent) => {
      const d = live.current!;
      const zone = d.moved ? zoneAt(e.clientX, e.clientY) : null;
      live.current = null;
      setDrag(null);
      if (!d.moved) onTap(d.tool);
      else if (zone) onDrop(d.tool, zone);
      else onTap(d.tool); // dropped on nothing: just hold the tool
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
    };
  }, [drag !== null, onDrop, onTap]); // eslint-disable-line react-hooks/exhaustive-deps

  const begin = (tool: string) => (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    e.preventDefault();
    start.current = { x: e.clientX, y: e.clientY };
    const d = { tool, x: e.clientX, y: e.clientY, moved: false, zone: null };
    live.current = d;
    setDrag(d);
  };
  return { drag, begin };
}

export function DragGhost({ drag, tools }: { drag: DragState | null; tools: ToolDef[] }) {
  if (!drag || !drag.moved) return null;
  const t = tools.find((x) => x.id === drag.tool);
  if (!t) return null;
  return (
    <div className={`tool-ghost ${drag.zone ? 'over' : ''}`} style={{ left: drag.x, top: drag.y }} aria-hidden>
      <ToolIcon id={t.icon} size={64} />
    </div>
  );
}

// ---------------- tray ----------------
export function ToolTray({
  tools,
  selected,
  onSelect,
  begin,
}: {
  tools: ToolDef[];
  selected: string | null;
  onSelect: (id: string) => void;
  begin: (id: string) => (e: PointerEvent) => void;
}) {
  return (
    <nav className="tool-tray" aria-label="器械工具盤" data-testid="tool-tray">
      {tools.map((t) => {
        const isSel = selected === t.id;
        const cls = ['tool', isSel ? 'selected' : '', t.locked ? 'locked' : '', t.done ? 'done' : ''].join(' ');
        return (
          <button
            key={t.id}
            className={cls}
            aria-pressed={isSel}
            aria-disabled={!!t.locked}
            title={t.locked ?? `${t.name}：${t.purpose}`}
            onPointerDown={t.locked ? undefined : begin(t.id)}
            onClick={(e) => {
              // pointer users are handled by the drag layer; keyboard "click" (detail 0) selects
              if (e.detail === 0 && !t.locked) onSelect(t.id);
            }}
            data-testid={`tool-${t.id}`}
          >
            <span className="tool-icon">
              <ToolIcon id={t.icon} size={48} />
              {t.done && <span className="tool-check" aria-hidden>✓</span>}
              {t.locked && !t.done && <span className="tool-lock" aria-hidden>🔒</span>}
            </span>
            <span className="tool-name">{t.name}</span>
            {t.locked && <span className="sr-only">（尚未可用：{t.locked}）</span>}
          </button>
        );
      })}
    </nav>
  );
}

export function ToolInfo({ tool }: { tool: ToolDef | null }) {
  if (!tool) return <div className="tool-info muted">選一個工具：點選它，或直接把它拖到目標上。</div>;
  return (
    <div className="tool-info" role="status" data-testid="tool-info">
      <b>{tool.name}</b>
      <span>{tool.purpose}</span>
      <span className="where">可用區域：{tool.where}</span>
    </div>
  );
}

// ---------------- zones ----------------
export interface ZoneProps {
  id: string;
  label: string;
  accepts: string[];
  selected: string | null;
  hover: string | null;
  done?: boolean;
  /** the zone exists but is not usable in the current phase */
  inactive?: boolean;
  onUse: (zone: string) => void;
  children: ReactNode;
  /** extra pointer handlers (e.g. hold to drill) */
  onHoldStart?: (zone: string) => void;
  onHoldEnd?: () => void;
  pop?: boolean;
}

export function Zone(p: ZoneProps) {
  const valid = !p.inactive && !!p.selected && p.accepts.includes(p.selected);
  const cls = ['zone', valid ? 'zone-valid' : '', p.hover === p.id ? (valid ? 'zone-hover' : 'zone-nope') : '', p.done ? 'zone-done' : '', p.pop ? 'zone-pop' : '']
    .filter(Boolean)
    .join(' ');
  const keyDown = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    if (p.onHoldStart) {
      if (!e.repeat) p.onHoldStart(p.id);
    } else p.onUse(p.id);
  };
  const keyUp = (e: KeyboardEvent) => {
    if ((e.key === 'Enter' || e.key === ' ') && p.onHoldEnd) p.onHoldEnd();
  };
  return (
    <g
      className={cls}
      data-zone={p.id}
      role="button"
      tabIndex={p.inactive ? -1 : 0}
      aria-label={`${p.label}${valid ? '（可使用目前工具）' : ''}${p.done ? '（已完成）' : ''}`}
      onClick={p.onHoldStart ? undefined : () => p.onUse(p.id)}
      onPointerDown={
        p.onHoldStart
          ? (e) => {
              e.preventDefault();
              p.onHoldStart!(p.id);
            }
          : undefined
      }
      onPointerUp={p.onHoldEnd}
      onPointerLeave={p.onHoldEnd}
      onPointerCancel={p.onHoldEnd}
      onKeyDown={keyDown}
      onKeyUp={keyUp}
      data-testid={`zone-${p.id}`}
      data-valid={valid ? 'y' : 'n'}
    >
      {p.children}
    </g>
  );
}

/** Press-and-hold helper: progress 0..1, completes after `ms`; releasing early cancels. */
export function useHold(ms: number, onComplete: (target: string) => void) {
  const [state, setState] = useState<{ target: string; progress: number } | null>(null);
  const timer = useRef<number | null>(null);
  const t0 = useRef(0);
  const target = useRef<string | null>(null);
  const stop = useCallback(() => {
    if (timer.current) cancelAnimationFrame(timer.current);
    timer.current = null;
    target.current = null;
    setState(null);
  }, []);
  const begin = useCallback(
    (t: string) => {
      stop();
      target.current = t;
      t0.current = performance.now();
      const tick = () => {
        const p = Math.min(1, (performance.now() - t0.current) / ms);
        setState({ target: t, progress: p });
        if (p >= 1) {
          const done = target.current;
          stop();
          if (done) onComplete(done);
          return;
        }
        timer.current = requestAnimationFrame(tick);
      };
      timer.current = requestAnimationFrame(tick);
    },
    [ms, onComplete, stop],
  );
  useEffect(() => stop, [stop]);
  return { hold: state, begin, cancel: stop };
}

export function TaskHint({ text, fb }: { text: string; fb: Feedback | null }) {
  return (
    <div className="task-hint" role="status" aria-live="polite" data-testid="task-hint">
      <div className="task-now">
        <span aria-hidden>➜</span> <b data-testid="task-text">{text}</b>
      </div>
      {fb && (
        <div key={fb.n} className={`task-fb ${fb.kind}`} data-testid="task-feedback" data-kind={fb.kind}>
          <span aria-hidden>{fb.kind === 'ok' ? '✓' : fb.kind === 'warn' ? '△' : 'ℹ'}</span> {fb.text}
        </div>
      )}
    </div>
  );
}
