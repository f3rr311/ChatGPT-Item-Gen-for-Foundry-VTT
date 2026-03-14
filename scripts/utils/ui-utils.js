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
 * Model names can be passed explicitly or default to game.settings values.
 * @param {object} costObj — token/image generation counts
 * @param {object} [models] — optional model name overrides
 * @param {string} [models.chatModel] — primary GPT model name
 * @param {string} [models.lightModel] — lightweight GPT model name
 * @param {string} [models.imageModel] — image generation model name
 * @returns {number} estimated cost in USD
 */
export function estimateCost(costObj, models = {}) {
  if (!costObj) return 0;
  const chatModel = models.chatModel || game.settings.get(MODULE_ID, "chatModel") || "gpt-4.1";
  const lightModel = models.lightModel || game.settings.get(MODULE_ID, "lightModel") || "gpt-4.1-mini";
  const imageModel = models.imageModel || game.settings.get(MODULE_ID, "imageModel") || "gpt-image-1";

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

/**
 * Normalize a Foundry dialog html parameter to a native DOM element.
 * v12 passes jQuery, v13 passes native DOM — this handles both.
 * @param {jQuery|HTMLElement} html — the html parameter from Dialog render/callback
 * @returns {HTMLElement} native DOM element
 */
export function resolveHtmlRoot(html) {
  return html instanceof jQuery ? html[0] : html;
}

/**
 * Common dialog initialization: resolve jQuery/DOM, locate the `.dialog`
 * wrapper, apply the `chatgpt-dialog` class, and set `height: auto`.
 * Returns `{ root, dialog }` for callers that need further customization.
 * @param {jQuery|HTMLElement} html — the html parameter from Dialog render callback
 * @returns {{ root: HTMLElement, dialog: HTMLElement|null }}
 */
export function initDialogRoot(html) {
  const root = resolveHtmlRoot(html);
  const dialog = root.closest('.dialog');
  if (dialog) {
    dialog.classList.add('chatgpt-dialog');
    dialog.style.height = 'auto';
  }
  return { root, dialog };
}

/**
 * Wrap a button click handler with disable/spinner/restore boilerplate.
 * Used by regen buttons in preview and history dialogs.
 * @param {HTMLButtonElement} btn — the button element
 * @param {Function} asyncFn — async function to execute while button is disabled
 */
export async function withRegenSpinner(btn, asyncFn) {
  btn.disabled = true;
  const origHTML = btn.innerHTML;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
  try {
    await asyncFn();
  } catch (err) {
    console.error("Regeneration failed:", err);
    ui.notifications.error(`Regeneration failed: ${err.message}`);
  }
  btn.disabled = false;
  btn.innerHTML = origHTML;
}

/**
 * Enable native browser spellcheck and right-click context menu on input elements.
 * Foundry VTT intercepts contextmenu events; stopPropagation lets the browser handle them.
 * @param {HTMLElement} root — the dialog root element
 * @param {string} selector — CSS selector for inputs to enable spellcheck on
 */
export function enableSpellcheck(root, selector) {
  root.querySelectorAll(selector).forEach(el => {
    el.setAttribute("spellcheck", "true");
    el.addEventListener("contextmenu", e => e.stopPropagation());
  });
}

/**
 * Reset the per-item cost tracker to zero for a new generation cycle.
 * Call this at the start of each item generation, before showProgressBar().
 */
export function resetItemCostTracker() {
  if (game.chatGPTItemGenerator?.currentCost) {
    const c = game.chatGPTItemGenerator.currentCost;
    c.promptTokens = 0;
    c.completionTokens = 0;
    c.totalTokens = 0;
    c.apiCalls = 0;
    c.imageGenerations = 0;
  }
}

export function showProgressBar() {
  resetItemCostTracker();

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
