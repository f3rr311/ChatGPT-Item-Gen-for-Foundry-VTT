/**
 * Ollama text provider — local inference, no API key required.
 * Fully OpenAI-compatible via /v1/chat/completions.
 */

import { makeOpenAICompatibleRequest } from './base-provider.js';

// ─── Provider Definition ───

export const ollamaProvider = {
  id: "ollama",
  name: "Ollama (Local)",
  requiresApiKey: false,
  supportsJsonMode: false,
  supportsImageGeneration: false,
  defaultEndpoint: "http://localhost:11434/v1/chat/completions",
  defaultModels: { chat: "llama3", light: "llama3" },
  modelChoices: {
    "llama3":        "Llama 3 (8B)",
    "llama3:70b":    "Llama 3 (70B)",
    "mistral":       "Mistral 7B",
    "deepseek-r1":   "DeepSeek R1",
    "qwen2.5":       "Qwen 2.5"
  },

  /**
   * Local models are weaker at following instructions — add stronger
   * JSON formatting instructions to help them stay on track.
   * @param {string} systemPrompt
   * @param {boolean} useJsonMode
   * @returns {string}
   */
  adjustSystemPrompt(systemPrompt, useJsonMode) {
    if (useJsonMode) {
      return "You MUST output strictly valid JSON. No commentary, no explanation, no markdown code fences before or after the JSON. " +
        "Use double-quoted property names. Start your response with { and end with }.\n\n" + systemPrompt;
    }
    return systemPrompt;
  },

  /**
   * Ollama requires no auth — just Content-Type.
   * @param {string} _apiKey — unused
   * @returns {object}
   */
  getHeaders(_apiKey) {
    return {
      "Content-Type": "application/json"
    };
  },

  /**
   * Send a chat completion request to the local Ollama instance.
   * @param {object} opts
   * @param {string} opts.model
   * @param {string} opts.systemPrompt
   * @param {string} opts.userPrompt
   * @param {number} opts.maxTokens
   * @param {boolean} [opts.useJsonMode=false]
   * @param {string} [opts.endpoint] — overridden by registry with config.ollamaEndpoint
   * @returns {Promise<{text: string|null, usage: object|null}>}
   */
  async chatCompletion({ model, systemPrompt, userPrompt, maxTokens, useJsonMode = false, endpoint }) {
    const finalEndpoint = endpoint || this.defaultEndpoint;

    return makeOpenAICompatibleRequest({
      endpoint: finalEndpoint,
      headers: this.getHeaders(),
      model,
      systemPrompt: this.adjustSystemPrompt(systemPrompt, useJsonMode),
      userPrompt,
      maxTokens,
      useJsonMode,
      providerName: "Ollama"
    });
  }
};
