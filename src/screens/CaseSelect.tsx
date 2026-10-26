import { useState } from 'react';
import { cases, diseaseById, moduleById } from '../data';
import { Patient } from '../components/art/Patient';
import { CasePortrait } from '../components/CasePortrait';
import { Modal } from '../components/ui';
import { useStore } from '../store';
import { navigate } from '../router';

export function CaseSelect() {
  const { data, startCase } = useStore();
  const [pending, setPending] = useState<string | null>(null);
  const inProgress = data.session && !data.session.settled ? data.session : null;

  const go = (id: string) => {
    if (inProgress && inProgress.caseId !== id) return setPending(id);
    if (inProgress && inProgress.caseId === id) return navigate('play');
    startCase(id);
    navigate('play');
  };

  return (
    <div className="stack">
      <h1>病例選擇</h1>
      <p className="muted">所有病例均為虛構教學病例，依附件資料設定，不是真實臨床紀錄。</p>
      <div className="grid cols-3">
        {cases.map((c) => {
          const d = diseaseById(c.diseaseId)!;
          const mod = moduleById(c.procedureId)!;
          const first = data.first[c.id];
          const practice = data.practice.filter((r) => r.caseId === c.id).length;
          return (
            <article key={c.id} className="card case-card" data-testid={`case-${c.id}`}>
              <div className="row">
                <h3 style={{ margin: 0 }}>{c.id}</h3>
                <span className="tag fiction">虛構教學病例</span>
                <span className="tag">難度 {c.difficulty}</span>
              </div>
              <div className="art">
                <CasePortrait caseId={c.id} species={c.species} breed={c.breed} size={136} fallback={<Patient species={c.species} breed={c.breed} pose={c.pose} side={c.side} size={170} />} />
              </div>
              <dl>
                <dt>病患</dt>
                <dd>{c.species}・{c.breed}・{c.ageMonths} 月齡</dd>
                <dt>體重／BCS</dt>
                <dd>{c.weightKg} kg・{c.bcs9}/9</dd>
                <dt>患側</dt>
                <dd>{c.side}</dd>
                <dt>主訴</dt>
                <dd>{c.complaint}</dd>
                <dt>模組</dt>
                <dd>{mod.rawIds[0]} {mod.name}</dd>
              </dl>
              <p className="small muted" style={{ margin: 0 }}>知識庫分類：{d.region}</p>
              <div className="row" style={{ marginTop: 'auto' }}>
                <span className="small">{first ? `首次紀錄：${first.total ?? '—'} 分` : '尚未完成'}{practice ? `・練習 ${practice} 次` : ''}</span>
                <span className="spacer" />
                <button className="btn primary sm" onClick={() => go(c.id)} data-testid={`start-${c.id}`}>
                  {inProgress?.caseId === c.id ? '繼續' : first ? '練習' : '接診'}
                </button>
              </div>
            </article>
          );
        })}
      </div>
      {pending && inProgress && (
        <Modal
          title="開始新病患？"
          onClose={() => setPending(null)}
          actions={
            <>
              <button className="btn" onClick={() => setPending(null)}>取消</button>
              <button className="btn danger" onClick={() => (startCase(pending), setPending(null), navigate('play'))} data-testid="confirm-new">
                開始 {pending}
              </button>
            </>
          }
        >
          <p>目前病例 {inProgress.caseId} 尚未完成。開始新病患會清除它的操作狀態（已結算紀錄不受影響）。</p>
        </Modal>
      )}
    </div>
  );
}
