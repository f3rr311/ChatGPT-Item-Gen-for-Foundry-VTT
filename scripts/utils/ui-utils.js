/**
 * Progress bar UI helpers and cost estimation.
 * Uses native DOM (no jQuery) for v12+v13 compatibility.
 */

import { MODULE_ID } from '../settings.js';

// OpenAI pricing per 1M tokens (USD) — updated March 2026
const MODEL_PRICING = {
  "gpt-4.1":       { input: 2.00, output: 8.00 },
  "gpt-4.1-mini":  { input: 0.40, output: 1.60 },
  "gpt-4.1-nano":  { input: 0.10, output: 0.40 },
  "gpt-4o":        { input: 2.50, output: 10.00 },
  "gpt-4o-mini":   { input: 0.15, output: 0.60 },
};
const IMAGE_PRICING = {
  "gpt-image-1": 0.04,   // 1024x1024 low quality
  "dall-e-3":    0.04,
  "dall-e-2":    0.02,
};

/**
 * Estimate USD cost from a cost tracker object.
 * Uses the user's configured models from game settings.
 */
export function estimateCost(costObj) {
  if (!costObj) return 0;
  const chatModel = game.settings.get(MODULE_ID, "chatModel") || "gpt-4.1";
  const lightModel = game.settings.get(MODULE_ID, "lightModel") || "gpt-4.1-mini";
  const imageModel = game.settings.get(MODULE_ID, "imageModel") || "gpt-image-1";

  // Blend chat + light model pricing (most calls use chatModel, name gen uses lightModel)
  // Approximate: ~70% of tokens go to chatModel, ~30% to lightModel
  const chatRate = MODEL_PRICING[chatModel] || MODEL_PRICING["gpt-4.1"];
  const lightRate = MODEL_PRICING[lightModel] || MODEL_PRICING["gpt-4.1-mini"];
  const blendedInput = chatRate.input * 0.7 + lightRate.input * 0.3;
  const blendedOutput = chatRate.output * 0.7 + lightRate.output * 0.3;

  const textCost = (costObj.promptTokens * blendedInput + costObj.completionTokens * blendedOutput) / 1_000_000;
  const imgRate = IMAGE_PRICING[imageModel] || IMAGE_PRICING["gpt-image-1"];
  const imgCost = (costObj.imageGenerations || 0) * imgRate;

  return textCost + imgCost;
}

/** Format a dollar amount for display */
function formatCost(dollars) {
  if (dollars < 0.01) return "<$0.01";
  return `~$${dollars.toFixed(2)}`;
}

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
        const cost = estimateCost(c);
        label += ` | ${formatCost(cost)} | ${c.totalTokens.toLocaleString()} tokens`;
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
      const sessionCost = estimateCost(c);
      el.textContent = `Session: ${formatCost(sessionCost)} | ${c.totalTokens.toLocaleString()} tokens | ${c.apiCalls} API calls | ${c.imageGenerations} images`;
    }
  }
}

export function hideProgressBar() {
  const container = document.getElementById('ai-progress-container');
  if (container) container.remove();
}
