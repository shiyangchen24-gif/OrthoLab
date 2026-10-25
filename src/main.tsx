import { StrictMode, Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { StoreProvider } from './store';
import { clearAll } from './engine/storage';
import './styles.css';

class Boundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <main style={{ maxWidth: 640, margin: '40px auto', padding: 16 }}>
        <h1>畫面發生錯誤</h1>
        <p>可以重新整理再試一次。若持續發生，可清除本機存檔後重新開始。</p>
        <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{this.state.error.message}</pre>
        <button className="btn" onClick={() => location.reload()}>重新整理</button>{' '}
        <button className="btn danger" onClick={() => (clearAll(), location.reload())}>清除存檔並重新開始</button>
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
