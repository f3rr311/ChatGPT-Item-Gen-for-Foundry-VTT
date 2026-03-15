/**
 * Shared OpenAI-compatible request handler used by all text providers.
 */

// ─── OpenAI-Compatible Chat Completion ───

/**
 * Send a chat completion request to any OpenAI-compatible endpoint.
 * Handles body construction, fetch, response parsing, and error logging.
 *
 * @param {object} opts
 * @param {string} opts.endpoint — full URL to the chat completions endpoint
 * @param {object} opts.headers — pre-built headers (Content-Type + auth)
 * @param {string} opts.model — model name (e.g. "gpt-4.1", "claude-sonnet-4-20250514")
 * @param {string} opts.systemPrompt — system-level instructions
 * @param {string} opts.userPrompt — user-level prompt text
 * @param {number} opts.maxTokens — max tokens to generate
 * @param {boolean} [opts.useJsonMode=false] — request JSON response format
 * @param {string} [opts.providerName="API"] — provider name for error messages
 * @returns {Promise<{text: string|null, usage: object|null}>}
 */
export async function makeOpenAICompatibleRequest({
  endpoint, headers, model, systemPrompt, userPrompt,
  maxTokens, useJsonMode = false, providerName = "API"
}) {
  if (!model) return { text: null, usage: null };

  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: maxTokens
  };

  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`${providerName} chat API error ${response.status}: ${errorBody}`);
      return { text: null, usage: null };
    }

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content?.trim() || null;
    const usage = data.usage || null;

    return { text, usage };
  } catch (err) {
    console.error(`${providerName} chat request failed:`, err.message);
    return { text: null, usage: null };
  }
}
