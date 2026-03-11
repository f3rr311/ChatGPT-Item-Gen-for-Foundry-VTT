/**
 * JSON sanitization and extraction utilities.
 * Note: fixInvalidJSON lives in api/openai.js since it makes an API call.
 */

/**
 * Attempt to parse a JSON string, recovering from common issues like
 * markdown fences, trailing commas, or unescaped characters.
 * @param {string} jsonStr — raw string that should contain JSON
 * @returns {string} cleaned JSON string (parseable), or the original if unrecoverable
 */
export function sanitizeJSON(jsonStr) {
  // Fast path: already valid
  try {
    JSON.parse(jsonStr);
    return jsonStr;
  } catch {
    // continue to recovery
  }

  let cleaned = jsonStr;

  // Strip markdown code fences (```json ... ``` or ``` ... ```)
  cleaned = cleaned.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  // Remove trailing commas before } or ]
  cleaned = cleaned.replace(/,(?=\s*[}\]])/g, "");

  // Try again after cleanup
  try {
    JSON.parse(cleaned);
    return cleaned;
  } catch {
    // Return cleaned version — extractValidJSON may still salvage it downstream
    return cleaned;
  }
}

export function extractValidJSON(raw) {
  // First try to find a complete JSON object
  const match = raw.match(/{[\s\S]*}/);
  if (match) {
    let jsonText = match[0];
    // Remove trailing commas before } or ]
    jsonText = jsonText.replace(/,(?=\s*[}\]])/g, "");
    return jsonText;
  }

  // If no closing brace found, the JSON was likely truncated mid-stream.
  // Try to salvage by closing open brackets.
  const openMatch = raw.match(/{[\s\S]*/);
  if (openMatch) {
    let jsonText = openMatch[0];
    // Remove any trailing incomplete entry (text after the last complete object/value)
    // Find the last complete entry by looking for the last "}," or "}" in an array context
    const lastCompleteEntry = jsonText.lastIndexOf("}");
    if (lastCompleteEntry > 0) {
      jsonText = jsonText.substring(0, lastCompleteEntry + 1);
    }
    // Remove trailing commas
    jsonText = jsonText.replace(/,(?=\s*$)/g, "");
    // Count unclosed brackets and close them
    const openBraces = (jsonText.match(/{/g) || []).length;
    const closeBraces = (jsonText.match(/}/g) || []).length;
    const openBrackets = (jsonText.match(/\[/g) || []).length;
    const closeBrackets = (jsonText.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) jsonText += "]";
    for (let i = 0; i < openBraces - closeBraces; i++) jsonText += "}";
    return jsonText;
  }

  return raw;
}
