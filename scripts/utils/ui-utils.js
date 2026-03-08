/**
 * Progress bar UI helpers.
 * Uses native DOM (no jQuery) for v12+v13 compatibility.
 */

export function showProgressBar() {
  // Reset per-item cost tracker at the start of each generation
  if (game.chatGPTItemGenerator?.currentCost) {
    const c = game.chatGPTItemGenerator.currentCost;
    c.promptTokens = 0;
    c.completionTokens = 0;
    c.totalTokens = 0;
    c.apiCalls = 0;
    c.imageGenerations = 0;
  }

  if (!document.getElementById('ai-progress-container')) {
    const container = document.createElement('div');
    container.id = 'ai-progress-container';
    Object.assign(container.style, {
      position: 'fixed', top: '20%', left: '50%',
      transform: 'translateX(-50%)', width: '340px',
      padding: '10px', background: '#222', color: '#fff',
      border: '1px solid #000', borderRadius: '5px', zIndex: '10000'
    });
    container.innerHTML = `
      <h3 style="margin:0 0 10px;">Generating AI Object...</h3>
      <div style="background:#ccc; border-radius:5px; width:100%; height:20px;">
        <div id="ai-progress-bar" style="background:#09f; width:0%; height:100%; border-radius:5px;"></div>
      </div>
      <p id="ai-progress-text" style="text-align:center; margin:5px 0 0;">0%</p>
      <p id="ai-session-cost" style="text-align:center; margin:2px 0 0; font-size:0.75rem; color:#aaa;"></p>
    `;
    document.body.appendChild(container);
  }
  updateSessionCostDisplay();
}

export function updateProgressBar(value) {
  const bar = document.getElementById('ai-progress-bar');
  const text = document.getElementById('ai-progress-text');
  if (bar) bar.style.width = `${value}%`;
  if (text) {
    let label = `${value}%`;
    // Show per-item cost in the main progress text
    if (game.chatGPTItemGenerator?.currentCost) {
      const c = game.chatGPTItemGenerator.currentCost;
      if (c.apiCalls > 0) {
        label += ` | ${c.totalTokens.toLocaleString()} tokens | ${c.apiCalls} calls | ${c.imageGenerations} img`;
      }
    }
    text.textContent = label;
  }
  updateSessionCostDisplay();
}

function updateSessionCostDisplay() {
  const el = document.getElementById('ai-session-cost');
  if (el && game.chatGPTItemGenerator?.sessionCost) {
    const c = game.chatGPTItemGenerator.sessionCost;
    if (c.apiCalls > 0 || c.imageGenerations > 0) {
      el.textContent = `Session: ${c.totalTokens.toLocaleString()} tokens, ${c.apiCalls} API calls, ${c.imageGenerations} images`;
    }
  }
}

export function hideProgressBar() {
  const container = document.getElementById('ai-progress-container');
  if (container) container.remove();
}
