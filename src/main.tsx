import { StrictMode, Component, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import { clearAll } from './engine/storage';
import './styles.css';

declare global {
  interface Window {
    __orthoBooted?: boolean;
  }
}

/** Remove the static HTML boot screen once React has committed its first render. */
function markBooted() {
  window.__orthoBooted = true;
  document.getElementById('boot')?.remove();
}

function ClearSaveButton() {
  // two-step confirmation: saves are never deleted automatically
  const [armed, setArmed] = useState(false);
  return armed ? (
    <button className="btn danger" onClick={() => (clearAll(), location.reload())} data-testid="boundary-clear-confirm">
      確定刪除存檔並重新開始
    </button>
  ) : (
    <button className="btn ghost" onClick={() => setArmed(true)}>
      仍然無法使用？清除存檔…
    </button>
  );
}

export class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  componentDidMount() {
    markBooted();
  }
  componentDidCatch(error: Error) {
    console.warn('OrthoLab render error:', error.message);
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: 16 }} role="alert" data-testid="error-boundary">
        <h1>畫面發生錯誤</h1>
        <p>遊戲畫面遇到問題而停止。請重新載入；你的存檔與首次作答紀錄會保留。</p>
        <details>
          <summary>技術資訊</summary>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
        </details>
        <div className="row" style={{ marginTop: 12 }}>
          <button className="btn primary" onClick={() => location.reload()}>
            重新載入
          </button>
          <ClearSaveButton />
        </div>
      </main>
    );
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Boundary>
      <StoreProvider>
        <App />
      </StoreProvider>
    </Boundary>
  </StrictMode>,
);
