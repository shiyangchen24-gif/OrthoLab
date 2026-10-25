import review from '../../docs/data-review.md?raw';

export function About() {
  return (
    <div className="stack" style={{ maxWidth: 900 }}>
      <h1>說明與限制</h1>
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
        </ul>
      </section>
      <section className="card stack">
        <h3>資料審閱紀錄（docs/data-review.md）</h3>
        <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: '.88rem', margin: 0 }}>{review}</pre>
      </section>
    </div>
  );
}
