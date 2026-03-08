/**
 * Progress bar UI helpers.
 * Uses native DOM (no jQuery) for v12+v13 compatibility.
 */

export function showProgressBar() {
  if (!document.getElementById('ai-progress-container')) {
    const container = document.createElement('div');
    container.id = 'ai-progress-container';
    Object.assign(container.style, {
      position: 'fixed', top: '20%', left: '50%',
      transform: 'translateX(-50%)', width: '300px',
      padding: '10px', background: '#222', color: '#fff',
      border: '1px solid #000', borderRadius: '5px', zIndex: '10000'
    });
    container.innerHTML = `
      <h3 style="margin:0 0 10px;">Generating AI Object...</h3>
      <div style="background:#ccc; border-radius:5px; width:100%; height:20px;">
        <div id="ai-progress-bar" style="background:#09f; width:0%; height:100%; border-radius:5px;"></div>
      </div>
      <p id="ai-progress-text" style="text-align:center; margin:5px 0 0;">0%</p>
    `;
    document.body.appendChild(container);
  }
}

export function updateProgressBar(value) {
  const bar = document.getElementById('ai-progress-bar');
  const text = document.getElementById('ai-progress-text');
  if (bar) bar.style.width = `${value}%`;
  if (text) text.textContent = `${value}%`;
}

export function hideProgressBar() {
  const container = document.getElementById('ai-progress-container');
  if (container) container.remove();
}
