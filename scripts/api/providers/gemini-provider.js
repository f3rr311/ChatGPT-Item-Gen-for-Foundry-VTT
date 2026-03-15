/**
 * Google Gemini text provider.
 * Uses Google's native generateContent REST API.
 */

// ─── Provider Definition ───

export const geminiProvider = {
  id: "gemini",
  name: "Google Gemini",
  requiresApiKey: true,
  supportsJsonMode: true,
  supportsImageGeneration: false,
  defaultEndpoint: "https://generativelanguage.googleapis.com/v1beta",
  defaultModels: { chat: "gemini-2.5-flash", light: "gemini-2.5-flash-lite" },
  modelChoices: {
    "gemini-2.5-pro":        "Gemini 2.5 Pro (Most Capable)",
    "gemini-2.5-flash":      "Gemini 2.5 Flash (Balanced)",
    "gemini-2.5-flash-lite": "Gemini 2.5 Flash Lite (Fast & Cheap)"
  },

  /**
   * Reinforce JSON output when JSON mode is requested.
   * @param {string} systemPrompt
   * @param {boolean} useJsonMode
   * @returns {string}
   */
  adjustSystemPrompt(systemPrompt, useJsonMode) {
    if (useJsonMode) {
      return systemPrompt + "\n\nIMPORTANT: Return ONLY valid JSON. No commentary, no markdown fences, no explanation before or after the JSON. Write detailed, evocative descriptions (2-3 paragraphs) but stay within token limits.";
    }
    return systemPrompt;
  },

  /**
   * Gemini uses API key as query parameter, not in headers.
   * @param {string} _apiKey — unused, key goes in URL
   * @returns {object}
   */
  getHeaders(_apiKey) {
    return {
      "Content-Type": "application/json"
    };
  },

  /**
   * Send a generateContent request to Google's Gemini API.
   * Translates OpenAI-style params to Gemini's format and back.
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

    const baseUrl = endpoint || this.defaultEndpoint;
    const adjustedSystem = this.adjustSystemPrompt(systemPrompt, useJsonMode);

    // Gemini API: key in query param, system instruction separate from messages
    const url = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;

    const body = {
      system_instruction: {
        parts: [{ text: adjustedSystem }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }]
        }
      ],
      generationConfig: {
        maxOutputTokens: maxTokens
      }
    };

    // Request JSON mime type when JSON mode is enabled
    if (useJsonMode) {
      body.generationConfig.responseMimeType = "application/json";
    }

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: this.getHeaders(apiKey),
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`Gemini API error ${response.status}: ${errorBody}`);
        return { text: null, usage: null };
      }

      const data = await response.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || null;

      // Map Gemini usage to OpenAI-style usage object
      const usageMetadata = data.usageMetadata;
      const usage = usageMetadata ? {
        prompt_tokens: usageMetadata.promptTokenCount || 0,
        completion_tokens: usageMetadata.candidatesTokenCount || 0,
        total_tokens: usageMetadata.totalTokenCount || 0
      } : null;

      return { text, usage };
    } catch (err) {
      console.error("Gemini chat request failed:", err.message);
      return { text: null, usage: null };
    }
  }
};
