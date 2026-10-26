import { useEffect } from 'react';
import { useRoute, navigate } from './router';
import { MainNav, NAV } from './components/nav';
import { useStore } from './store';
import { Home } from './screens/Home';
import { CaseSelect } from './screens/CaseSelect';
import { Play } from './screens/Play';
import { Knowledge } from './screens/Knowledge';
import { References } from './screens/References';
import { Settings } from './screens/Settings';
import { About } from './screens/About';
import { Modal } from './components/ui';
import { PatientGallery } from './screens/PatientGallery';


export function App() {
  const { route } = useRoute();
  const { data, ackDisclaimer, loadMessage, dismissLoadMessage } = useStore();
  useEffect(() => {
    document.title = `OrthoLab・${NAV.find((n) => n.route === route)?.label ?? ''}`;
  }, [route]);
  return (
    <>
      <header className="topbar">
        <button className="brand" onClick={() => navigate('home')} aria-label="OrthoLab 首頁">
          <img src="./favicon.svg" width="28" height="28" alt="" />
          <span>
            Ortho<b>Lab</b>
          </span>
        </button>
        <MainNav route={route} />
      </header>
      <main>
        {loadMessage && (
          <div className="banner warn" role="alert" style={{ marginBottom: 12 }}>
            <span aria-hidden>⚠</span>
            <span style={{ flex: 1 }}>{loadMessage}</span>
            <button className="btn sm" onClick={dismissLoadMessage}>知道了</button>
          </div>
        )}
        {import.meta.env.DEV && window.location.hash === '#/gallery' ? <PatientGallery /> : route === 'home' && <Home />}
        {route === 'cases' && <CaseSelect />}
        {route === 'play' && <Play />}
        {route === 'kb' && <Knowledge />}
        {route === 'refs' && <References />}
        {route === 'settings' && <Settings />}
        {route === 'about' && <About />}
      </main>
      <footer className="site">OrthoLab・教學模擬，非實際臨床決策工具・病例皆為虛構教學設定</footer>
      {!data.disclaimerAck && (
        <Modal
          title="歡迎來到 OrthoLab"
          onClose={ackDisclaimer}
          actions={
            <button className="btn primary" onClick={ackDisclaimer} data-testid="ack">
              我了解，開始
            </button>
          }
        >
          <p>
            這是<b>教學模擬，非實際臨床決策工具</b>。其餘限制說明放在「說明」與「參考來源」頁。
          </p>
        </Modal>
      )}
    </>
  );
}
