/**
 * Anthropic Claude text provider.
 * Uses Anthropic's native Messages API with browser CORS support.
 */

// ─── Provider Definition ───

export const anthropicProvider = {
  id: "anthropic",
  name: "Anthropic Claude",
  requiresApiKey: true,
  supportsJsonMode: true,
  supportsImageGeneration: false,
  defaultEndpoint: "https://api.anthropic.com/v1/messages",
  defaultModels: { chat: "claude-sonnet-4-20250514", light: "claude-haiku-4-5-20251001" },
  modelChoices: {
    "claude-opus-4-20250514":    "Claude Opus 4 (Most Capable)",
    "claude-sonnet-4-20250514":  "Claude Sonnet 4 (Balanced)",
    "claude-haiku-4-5-20251001": "Claude Haiku 4.5 (Fast & Cheap)"
  },

  /**
   * Claude tends to be verbose — append conciseness instruction.
   * Reinforce JSON-only output when JSON mode is requested.
   * @param {string} systemPrompt
   * @param {boolean} useJsonMode
   * @returns {string}
   */
  adjustSystemPrompt(systemPrompt, useJsonMode) {
    let adjusted = systemPrompt;
    if (useJsonMode) {
      adjusted += "\n\nIMPORTANT: Return ONLY valid JSON. No commentary, no markdown fences, no explanation before or after the JSON.";
    }
    adjusted += "\nBe concise and direct.";
    return adjusted;
  },

  /**
   * Anthropic uses x-api-key header + browser CORS opt-in.
   * @param {string} apiKey
   * @returns {object}
   */
  getHeaders(apiKey) {
    return {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    };
  },

  /**
   * Send a chat completion request to Anthropic's native Messages API.
   * Translates OpenAI-style params to Anthropic's format and back.
   * @param {object} opts
   * @param {string} opts.apiKey
   * @param {string} opts.model
   * @param {string} opts.systemPrompt
   * @param {string} opts.userPrompt
   * @param {number} opts.maxTokens
   * @param {boolean} [opts.useJsonMode=false]
   * @param {string} [opts.endpoint]
   * @returns {Promise<{text: string|null, usage: object|null}>}
   */
  async chatCompletion({ apiKey, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false, endpoint }) {
    if (!apiKey) return { text: null, usage: null };

    const url = endpoint || this.defaultEndpoint;
    const adjustedSystem = this.adjustSystemPrompt(systemPrompt, useJsonMode);

    const body = {
      model,
      max_tokens: maxTokens,
      system: adjustedSystem,
      messages: [
        { role: "user", content: userPrompt }
      ]
    };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`Anthropic API error ${response.status}: ${errorBody}`);
        return { text: null, usage: null };
      }

      const data = await response.json();
      const text = data.content?.[0]?.text?.trim() || null;

      // Map Anthropic usage to OpenAI-style usage object
      const usage = data.usage ? {
        prompt_tokens: data.usage.input_tokens || 0,
        completion_tokens: data.usage.output_tokens || 0,
        total_tokens: (data.usage.input_tokens || 0) + (data.usage.output_tokens || 0)
      } : null;

      return { text, usage };
    } catch (err) {
      console.error("Anthropic chat request failed:", err.message);
      return { text: null, usage: null };
    }
  }
};
