/**
 * Custom text provider — user-defined OpenAI-compatible endpoint.
 * Allows connecting to any service that speaks the OpenAI chat completions format.
 */

import { makeOpenAICompatibleRequest } from './base-provider.js';

// ─── Provider Definition ───

export const customProvider = {
  id: "custom",
  name: "Custom (OpenAI-Compatible)",
  requiresApiKey: false,
  supportsJsonMode: false,
  supportsImageGeneration: false,
  defaultEndpoint: "",
  defaultModels: { chat: "", light: "" },
  modelChoices: {},

  /**
   * No prompt adjustments — treated as a standard OpenAI-compatible endpoint.
   * @param {string} systemPrompt
   * @param {boolean} _useJsonMode
   * @returns {string}
   */
  adjustSystemPrompt(systemPrompt, _useJsonMode) {
    return systemPrompt;
  },

  /**
   * Bearer auth if an API key is provided, otherwise just Content-Type.
   * @param {string} apiKey
   * @returns {object}
   */
  getHeaders(apiKey) {
    const headers = { "Content-Type": "application/json" };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }
    return headers;
  },

  /**
   * Send a chat completion request to a user-defined endpoint.
   * @param {object} opts
   * @param {string} [opts.apiKey]
   * @param {string} opts.model
   * @param {string} opts.systemPrompt
   * @param {string} opts.userPrompt
   * @param {number} opts.maxTokens
   * @param {boolean} [opts.useJsonMode=false]
   * @param {string} opts.endpoint — user-configured endpoint URL
   * @returns {Promise<{text: string|null, usage: object|null}>}
   */
  async chatCompletion({ apiKey, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false, endpoint }) {
    if (!endpoint) {
      console.error("Custom provider: no endpoint configured. Set a Custom Provider Endpoint in module settings.");
      return { text: null, usage: null };
    }

    return makeOpenAICompatibleRequest({
      endpoint,
      headers: this.getHeaders(apiKey),
      model,
      systemPrompt: this.adjustSystemPrompt(systemPrompt, useJsonMode),
      userPrompt,
      maxTokens,
      useJsonMode,
      providerName: "Custom"
    });
  }
};
