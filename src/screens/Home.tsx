import { useState } from 'react';
import { caseById, cases, diseaseById } from '../data';
import { Patient } from '../components/art/Patient';
import { Modal } from '../components/ui';
import { useStore } from '../store';
import { navigate } from '../router';
import { illust } from '../components/illustrations';
import { resolvePatientArt } from '../components/patientAssets';
import { sceneImage } from '../scenes/sceneAssets';

function ClinicScene() {
  return (
    <svg viewBox="0 0 420 260" width="100%" role="img" aria-label="OrthoLab 診所：獸醫與犬貓病患">
      <defs>
        <linearGradient id="wall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F1F5F9" />
          <stop offset="1" stopColor="#E0F2FE" />
        </linearGradient>
      </defs>
      <rect width="420" height="260" rx="18" fill="url(#wall)" />
      <rect y="196" width="420" height="64" fill="#F8FAFC" />
      <line x1="0" y1="196" x2="420" y2="196" stroke="#CBD5E1" strokeWidth="2" />
      {/* window + x-ray viewer */}
      <rect x="24" y="24" width="96" height="70" rx="8" fill="#BAE6FD" stroke="#0284C7" strokeWidth="2" />
      <path d="M72 24v70M24 59h96" stroke="#0284C7" strokeWidth="2" />
      <rect x="300" y="24" width="96" height="64" rx="6" fill="#0B1924" stroke="#334155" strokeWidth="2" />
      <path d="M332 34 L346 34 L350 52 Q344 58 338 56 Q332 58 330 52 Z M334 60 L348 60 L346 82 L338 82 Z" fill="#E2EDF8" />
      <text x="348" y="84" fontSize="7" fill="#94A3B8" textAnchor="middle">教學示意</text>
      {/* exam table */}
      <rect x="120" y="150" width="190" height="14" rx="7" fill="#0284C7" />
      <rect x="140" y="164" width="10" height="34" fill="#94A3B8" />
      <rect x="280" y="164" width="10" height="34" fill="#94A3B8" />
      {/* vet */}
      <g transform="translate(330 90)">
        <rect x="-22" y="40" width="44" height="66" rx="16" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2" />
        <rect x="-6" y="40" width="12" height="40" fill="#0284C7" opacity=".85" />
        <circle cx="0" cy="22" r="18" fill="#F5D0B5" />
        <path d="M-18 18 Q-16 0 0 2 Q16 0 18 18 Q10 8 -2 10 Q-12 10 -18 18Z" fill="#334155" />
        <circle cx="-6" cy="22" r="2" fill="#1F2937" />
        <circle cx="6" cy="22" r="2" fill="#1F2937" />
        <path d="M-5 30 q5 4 10 0" stroke="#7C2D12" strokeWidth="2" fill="none" strokeLinecap="round" />
        <path d="M-12 46 q-2 22 10 26 q8 2 8 -8" stroke="#475569" strokeWidth="2.4" fill="none" />
        <circle cx="6" cy="64" r="4" fill="#F97316" />
        <rect x="-22" y="106" width="18" height="10" rx="4" fill="#334155" />
        <rect x="4" y="106" width="18" height="10" rx="4" fill="#334155" />
      </g>
      <g transform="translate(118 58)">
        <Patient species="犬" breed="拉布拉多" pose="hind-lift" side="左後肢" size={180} label="拉布拉多犬病患" />
      </g>
      <g transform="translate(20 120)">
        <Patient species="貓" breed="短毛家貓" pose="sit-stiff" side="雙髖" size={120} label="貓病患" />
      </g>
    </svg>
  );
}

export function Home() {
  const { data, startCase } = useStore();
  const [confirm, setConfirm] = useState(false);
  const firstDone = Object.keys(data.first).length;
  const inProgress = data.session && !data.session.settled ? data.session : null;
  // first visit: the polished C07 demo level; afterwards the first unfinished case
  const demo = cases.find((c) => c.id === 'C07')!;
  const nextCase = firstDone === 0 ? demo : cases.find((c) => !data.first[c.id]) ?? cases[0];

  const begin = () => {
    if (inProgress && inProgress.caseId !== nextCase.id) return setConfirm(true);
    if (!inProgress) startCase(nextCase.id);
    navigate('play');
  };

  const room = illust('home/hero-room');
  const vet = sceneImage('vet');
  const dog = resolvePatientArt('犬', '瑪爾濟斯')?.urls.sit;
  const cat = illust('home/hero-cat');
  const painted = !!(room && vet && dog);
  const FEATURES = [
    { title: '檢查與推理', text: '從問診、檢查到鑑別診斷，培養臨床思考力', art: 'home/card-exam', go: () => navigate('cases') },
    { title: '手術操作', text: '透過互動步驟學習骨科手術關鍵（教學幾何）', art: 'home/card-surgery', go: () => navigate('kb') },
    { title: '照護與追蹤', text: '術後照護、復健與追蹤的衛教重點', art: 'home/card-care', go: () => navigate('kb') },
  ];

  return (
    <div className="stack">
      <section className={painted ? 'home-hero' : 'hero'}>
        <div className="home-hero-text">
          <span className="tag info">獸醫骨科互動教學模擬</span>
          <h1 className="home-title">
            Ortho<b>Lab</b>
          </h1>
          <p className="home-sub">🐾 獸醫骨科互動教學</p>
          <p className="lead">扮演獸醫：接診 → 蒐集檢查線索 → 臨床推理 → 選擇處置 → 手術操作或非手術管理 → 術後照護 → 學習回饋。</p>
          <div className="menu-grid">
            <button className="btn primary lg" onClick={begin} data-testid="start">
              🐾 {firstDone === 0 && !inProgress ? '開始示範關卡（C07）' : `開始接診${!inProgress ? `（${nextCase.id}）` : ''}`}
            </button>
            <button className="btn lg" onClick={() => navigate('cases')} data-testid="menu-cases">
              📁 病例選擇
            </button>
            <button className="btn lg" disabled={!inProgress} onClick={() => navigate('play')} data-testid="continue">
              📊 繼續進度{inProgress ? `（${inProgress.caseId}）` : ''}
            </button>
          </div>
          <div className="home-progress" aria-label={`已完成首次作答 ${firstDone}/${cases.length} 病例`}>
            <span className="small">已完成 {firstDone} / {cases.length}</span>
            <div className="progress" aria-hidden>
              <i style={{ width: `${(firstDone / cases.length) * 100}%` }} />
            </div>
          </div>
          <p className="small muted home-links">
            <button className="btn ghost sm" onClick={() => navigate('kb')}>📚 知識庫</button>
            <button className="btn ghost sm" onClick={() => navigate('refs')}>🔗 參考來源</button>
            <button className="btn ghost sm" onClick={() => navigate('settings')}>⚙ 設定</button>
            <button className="btn ghost sm" onClick={() => navigate('about')}>說明與限制</button>
          </p>
          <p className="small muted">8 個虛構教學病例・5 個可操作模組・所有評分皆為本遊戲教學評分。</p>
        </div>
        {painted ? (
          <div className="home-stage" style={{ backgroundImage: `url(${room})` }} aria-hidden>
            {/* the vet stands behind the painted table: clipped at the table top */}
            <div className="home-vet-clip">
              <img src={vet!} alt="" />
            </div>
            <img className="home-dog" src={dog!} alt="" />
            {cat && <img className="home-cat" src={cat} alt="" />}
          </div>
        ) : (
          <ClinicScene />
        )}
      </section>
      {painted && (
        <section className="home-features" aria-label="學習內容">
          {FEATURES.map((f) => (
            <button key={f.title} className="home-feature" onClick={f.go}>
              {illust(f.art) && <img src={illust(f.art)!} alt="" aria-hidden />}
              <span>
                <b>{f.title}</b>
                <span className="small muted">{f.text}</span>
              </span>
              <span aria-hidden className="chev">›</span>
            </button>
          ))}
        </section>
      )}
      {inProgress && (
        <div className="banner">
          <span aria-hidden>⏸</span>
          <span>
            有進行中的病例 {inProgress.caseId}（{diseaseById(caseById(inProgress.caseId)!.diseaseId)?.name}），重新整理後仍會保留。
          </span>
        </div>
      )}
      {confirm && inProgress && (
        <Modal
          title="開始新病患？"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn" onClick={() => (setConfirm(false), navigate('play'))}>
                繼續目前病例
              </button>
              <button className="btn danger" onClick={() => (startCase(nextCase.id), setConfirm(false), navigate('play'))}>
                開始 {nextCase.id}
              </button>
            </>
          }
        >
          <p>開始新病患會清除目前病例 {inProgress.caseId} 的操作狀態（已結算的紀錄不受影響）。</p>
        </Modal>
      )}
    </div>
  );
}
