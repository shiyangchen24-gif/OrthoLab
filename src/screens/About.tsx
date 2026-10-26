import { useState } from 'react';
import review from '../../docs/data-review.md?raw';
import { illust } from '../components/illustrations';
import { resolvePatientArt } from '../components/patientAssets';
import { sceneImage } from '../scenes/sceneAssets';
import { navigate } from '../router';

const STEPS = [
  { n: 1, title: '接診', text: '聽飼主主訴，標記患肢。', art: 'guide/step1' },
  { n: 2, title: '檢查', text: '步態觀察、骨科觸診與補充資訊。', art: 'guide/step2' },
  { n: 3, title: '推理', text: '判讀 X 光，整理線索並選擇處置。', art: 'guide/step3' },
  { n: 4, title: '手術', text: '依步驟完成復位與固定（教學幾何）。', art: 'guide/step4' },
  { n: 5, title: '照護', text: '建立術後照護與衛教計畫。', art: 'guide/step5' },
  { n: 6, title: '回饋', text: '檢視各階段表現與下次練習重點。', art: 'guide/step6' },
];

const TABS = [
  { id: 'intro', label: '遊戲介紹', icon: '📖' },
  { id: 'controls', label: '操作方式', icon: '🎮' },
  { id: 'limits', label: '教學限制', icon: '⚠' },
  { id: 'review', label: '資料審閱', icon: '📄' },
] as const;
type Tab = (typeof TABS)[number]['id'];

export function About() {
  const [tab, setTab] = useState<Tab>('intro');
  const vet = sceneImage('vet');
  const dog = resolvePatientArt('犬', '瑪爾濟斯')?.urls.sit;
  return (
    <div className="about-page">
      <nav className="about-nav" role="tablist" aria-label="說明分類">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={tab === t.id ? 'on' : ''} onClick={() => setTab(t.id)} data-testid={`about-tab-${t.id}`}>
            <span aria-hidden>{t.icon}</span> {t.label} <span aria-hidden className="chev">›</span>
          </button>
        ))}
      </nav>
      <div className="about-main" role="tabpanel">
        <h1>
          說明與限制 <span aria-hidden className="paw">🐾</span>
        </h1>
        {tab === 'intro' && (
          <>
            <p className="muted">OrthoLab 讓你扮演獸醫，依序完成六個階段。每一步都只用病例提供的資料作判斷。</p>
            <ol className="about-steps">
              {STEPS.map((s) => (
                <li key={s.n} className="about-step">
                  <div className="about-step-head">
                    <span className={`about-num n${s.n}`}>{s.n}</span>
                    <b>{s.title}</b>
                  </div>
                  {illust(s.art) && <img src={illust(s.art)!} alt="" aria-hidden loading="lazy" />}
                  <p className="small">{s.text}</p>
                </li>
              ))}
            </ol>
          </>
        )}
        {tab === 'controls' && (
          <section className="card stack">
            <h3>操作方式</h3>
            <ul>
              <li>診間：從下方工具盤<b>點選工具，再點目標</b>；也可以直接<b>把工具拖到目標</b>上。鍵盤可用 Tab 移動、Enter 使用。</li>
              <li>病患面向你：<b>病患左側在畫面右側</b>。標記與觸診都要放在正確的肢體上。</li>
              <li>手術：拖曳骨段或骨板對位，可用微調按鈕與放大檢視；「撤銷」「重設」「提示」隨時可用。</li>
              <li>每一題以<b>首次作答</b>計分；之後改選只用來繼續流程，不重複計分。</li>
              <li>設定頁可開啟「減少動態效果」，或跟隨系統設定；動畫關閉時改用文字或靜態框線提示。</li>
            </ul>
          </section>
        )}
        {tab === 'limits' && (
          <section className="card stack">
            <h3>定位</h3>
            <p>
              OrthoLab 是給獸醫學生及相關學習者的<b>簡化教學模擬</b>，<b>不是實際臨床決策工具</b>。病例均為依附件資料設定的虛構教學病例，不是真實臨床紀錄。
            </p>
            <ul>
              <li>處置分沿用附件提案，屬本關教學評分，不代表治療成功率。</li>
              <li>T09 的角度、位移、跨距、皮質數與距離是<b>遊戲幾何門檻</b>，不是臨床標準，也不能推論必然骨不癒合或其他併發症。</li>
              <li>手術畫面為 2D 教學示意；兩個視角共用同一份模型狀態，未驗證完整三維固定。</li>
              <li>影像為本專案繪製的高對比灰階教學示意，非臨床影像、非 DICOM；標尺使用模型比例。</li>
              <li>本遊戲不提供藥物劑量、發生率、手術禁忌或保證預後；追蹤結果皆標示為模擬情境。</li>
              <li>未提供完整麻醉事件資料：手術中只顯示模擬監測狀態，不產生影響判分的隨機事件；計時只作提示。</li>
              <li>沒有完整病例與操作資料的術式（囊外固定、TTA、THR 等）只提供決策解說與轉介路線，不提供假操作畫面。</li>
              <li>插畫（人物、病患、場景、卡片）由 ChatGPT 生成，僅作教學情境示意，不代表解剖或臨床細節。</li>
            </ul>
          </section>
        )}
        {tab === 'review' && (
          <section className="card stack">
            <h3>資料審閱紀錄（docs/data-review.md）</h3>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.88rem', margin: 0 }}>{review}</pre>
          </section>
        )}
        <div className="about-cta">
          <span className="about-cta-icon" aria-hidden>!</span>
          <div>
            <b>教學模擬，非實際臨床決策工具</b>
            <div className="row" style={{ marginTop: 6 }}>
              <span className="tag info">虛構病例</span>
              <span className="tag ok">示意影像</span>
            </div>
          </div>
          <span className="spacer" />
          <button className="btn primary lg" onClick={() => navigate('cases')} data-testid="about-start">
            開始教學 ›
          </button>
        </div>
      </div>
      {(vet || dog) && (
        <div className="about-art" aria-hidden>
          {vet && <img className="about-vet" src={vet} alt="" />}
          {dog && <img className="about-dog" src={dog} alt="" />}
        </div>
      )}
    </div>
  );
}
