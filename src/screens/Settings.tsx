import { useState } from 'react';
import { Modal } from '../components/ui';
import { useStore } from '../store';
import { SAVE_VERSION } from '../engine/storage';
import { sound } from '../audio';
import { resolvePatientArt } from '../components/patientAssets';
import { sceneImage } from '../scenes/sceneAssets';

export function Settings() {
  const { data, updateSettings, clearAll } = useStore();
  const st = data.settings;
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  const vet = sceneImage('vet');
  const dog = resolvePatientArt('犬', '瑪爾濟斯')?.urls.sit;
  return (
    <div className="settings-page">
      <div className="settings-panel">
        <h1>
          <span className="settings-icon" aria-hidden>⚙</span> 設定
        </h1>
        <section className="settings-group" aria-label="偏好設定">
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden>🔊</span>
            <label htmlFor="set-sound">音效<span className="small muted">輕柔提示音</span></label>
            <input id="set-sound" className="switch" type="checkbox" checked={st.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} data-testid="set-sound" />
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden>📶</span>
            <label htmlFor="set-volume">音量</label>
            <span className="settings-control">
              <input id="set-volume" type="range" min={0} max={100} value={Math.round(st.volume * 100)} disabled={!st.sound} onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })} aria-label="音量" />
              <span className="small">{Math.round(st.volume * 100)}%</span>
              <button className="btn sm" disabled={!st.sound} onClick={() => sound.play('success')}>試聽</button>
            </span>
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden>✨</span>
            <label htmlFor="set-motion">減少動態效果</label>
            <select id="set-motion" value={st.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.value as typeof st.reducedMotion })} data-testid="set-motion">
              <option value="system">跟隨系統</option>
              <option value="on">開啟（減少動畫）</option>
              <option value="off">關閉（保留動畫）</option>
            </select>
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden>🧲</span>
            <label htmlFor="set-snap">
              磁吸輔助<span className="small muted">T09 復位；使用次數會記錄，不扣分，不會鎖死微調</span>
            </label>
            <input id="set-snap" className="switch" type="checkbox" checked={st.snapAssist} onChange={(e) => updateSettings({ snapAssist: e.target.checked })} data-testid="set-snap" />
          </div>
          <div className="settings-row">
            <span className="settings-row-icon" aria-hidden>📖</span>
            <span className="settings-label">
              新手引導<span className="small muted">每次只提示目前可做的一個主要動作</span>
            </span>
            <span className="settings-control seg" role="group" aria-label="新手引導">
              <button className="btn sm" onClick={() => updateSettings({ guide: 'on' })} aria-pressed={st.guide === 'on'} data-testid="guide-rewatch">
                重看引導
              </button>
              <button className="btn sm" onClick={() => updateSettings({ guide: 'auto' })} aria-pressed={st.guide === 'auto'}>
                自動
              </button>
              <button className="btn sm" onClick={() => updateSettings({ guide: 'off' })} aria-pressed={st.guide === 'off'}>
                關閉
              </button>
            </span>
          </div>
        </section>
        <section className="settings-group" aria-label="學習紀錄">
          <h3>🎓 學習紀錄</h3>
          <div className="settings-records">
            <div className="settings-count"><span className="small muted">首次作答</span><b>{Object.keys(data.first).length}</b></div>
            <div className="settings-count"><span className="small muted">練習</span><b>{data.practice.length}</b></div>
            <button className="btn danger" onClick={() => setConfirm(true)} data-testid="clear-records">
              🗑 清除紀錄
            </button>
          </div>
          <p className="small muted">存檔格式版本 v{SAVE_VERSION}（瀏覽器 localStorage）。</p>
          {cleared && <div className="banner ok" role="status">已清除所有紀錄與進行中的病例。</div>}
        </section>
      </div>
      {(vet || dog) && (
        <div className="settings-art" aria-hidden>
          {vet && <img className="settings-vet" src={vet} alt="" />}
          {dog && <img className="settings-dog" src={dog} alt="" />}
        </div>
      )}
      {confirm && (
        <Modal
          title="確定清除所有紀錄？"
          onClose={() => setConfirm(false)}
          actions={
            <>
              <button className="btn" onClick={() => setConfirm(false)}>取消</button>
              <button
                className="btn danger"
                onClick={() => {
                  clearAll();
                  setConfirm(false);
                  setCleared(true);
                }}
                data-testid="confirm-clear"
              >
                確定清除
              </button>
            </>
          }
        >
          <p>首次作答、練習紀錄、進行中的病例與設定都會被清除，無法復原。</p>
        </Modal>
      )}
    </div>
  );
}
