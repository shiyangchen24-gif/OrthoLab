import { useState } from 'react';
import { Modal } from '../components/ui';
import { useStore } from '../store';
import { SAVE_VERSION } from '../engine/storage';
import { sound } from '../audio';

export function Settings() {
  const { data, updateSettings, clearAll } = useStore();
  const st = data.settings;
  const [confirm, setConfirm] = useState(false);
  const [cleared, setCleared] = useState(false);
  return (
    <div className="stack" style={{ maxWidth: 720 }}>
      <h1>設定</h1>
      <section className="card stack">
        <h3>音效</h3>
        <label className="row">
          <input type="checkbox" checked={st.sound} onChange={(e) => updateSettings({ sound: e.target.checked })} data-testid="set-sound" /> 開啟輕柔音效
        </label>
        <label className="row">
          音量
          <input type="range" min={0} max={100} value={Math.round(st.volume * 100)} disabled={!st.sound} onChange={(e) => updateSettings({ volume: Number(e.target.value) / 100 })} aria-label="音量" />
          <button className="btn sm" disabled={!st.sound} onClick={() => sound.play('success')}>試聽</button>
        </label>
      </section>
      <section className="card stack">
        <h3>動態效果</h3>
        <label className="row">
          減少動態效果
          <select value={st.reducedMotion} onChange={(e) => updateSettings({ reducedMotion: e.target.value as typeof st.reducedMotion })} data-testid="set-motion">
            <option value="system">跟隨系統</option>
            <option value="on">開啟（減少動畫）</option>
            <option value="off">關閉（保留動畫）</option>
          </select>
        </label>
      </section>
      <section className="card stack">
        <h3>手術輔助</h3>
        <label className="row">
          <input type="checkbox" checked={st.snapAssist} onChange={(e) => updateSettings({ snapAssist: e.target.checked })} data-testid="set-snap" /> 磁吸對齊輔助（T09 復位；使用次數會記錄，不扣分，不會鎖死微調）
        </label>
      </section>
      <section className="card stack">
        <h3>紀錄</h3>
        <p className="small">
          首次作答 {Object.keys(data.first).length} 筆、練習 {data.practice.length} 筆。存檔格式版本 v{SAVE_VERSION}（瀏覽器 localStorage）。
        </p>
        <button className="btn danger" onClick={() => setConfirm(true)} data-testid="clear-records">
          清除所有紀錄
        </button>
        {cleared && <div className="banner ok" role="status">已清除所有紀錄與進行中的病例。</div>}
      </section>
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
