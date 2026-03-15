/**
 * xAI Grok text provider.
 * Fully OpenAI-compatible endpoint — drop-in URL swap.
 */

import { makeOpenAICompatibleRequest } from './base-provider.js';

// ─── Provider Definition ───

export const xaiProvider = {
  id: "xai",
  name: "xAI Grok",
  requiresApiKey: true,
  supportsJsonMode: false,
  supportsImageGeneration: false,
  defaultEndpoint: "https://api.x.ai/v1/chat/completions",
  defaultModels: { chat: "grok-4-0709", light: "grok-4-1-fast-non-reasoning" },
  modelChoices: {
    "grok-4-0709":                    "Grok 4 (Flagship)",
    "grok-4-1-fast-non-reasoning":    "Grok 4.1 Fast (Balanced)",
    "grok-3":                         "Grok 3"
  },

  /**
   * Grok's JSON mode may be unreliable — belt-and-suspenders approach:
   * always reinforce JSON-only output in the system prompt.
   * @param {string} systemPrompt
   * @param {boolean} useJsonMode
   * @returns {string}
   */
  adjustSystemPrompt(systemPrompt, useJsonMode) {
    if (useJsonMode) {
      return systemPrompt + "\n\nCRITICAL: Output ONLY valid JSON. No text before or after the JSON object. No markdown fences. Double-quoted property names only.";
    }
    return systemPrompt;
  },

  /**
   * Standard Bearer auth headers.
   * @param {string} apiKey
   * @returns {object}
   */
  getHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    };
  },

  /**
   * Send a chat completion request to xAI.
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {string} opts.systemPrompt
   * @param {string} opts.userPrompt
   * @param {number} opts.maxTokens
   * @param {boolean} [opts.useJsonMode=false]
   * @returns {Promise<{text: string|null, usage: object|null}>}
   */
  async chatCompletion({ apiKey, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false }) {
    if (!apiKey) return { text: null, usage: null };

    return makeOpenAICompatibleRequest({
      endpoint: this.defaultEndpoint,
      headers: this.getHeaders(apiKey),
      model,
      systemPrompt: this.adjustSystemPrompt(systemPrompt, useJsonMode),
      userPrompt,
      maxTokens,
      useJsonMode,
      providerName: "xAI"
    });
  }
};
