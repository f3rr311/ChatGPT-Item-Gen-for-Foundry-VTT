/**
 * JSON sanitization and extraction utilities.
 * Note: fixInvalidJSON lives in api/openai.js since it makes an API call.
 */

export function sanitizeJSON(jsonStr) {
  return jsonStr
    .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
    .replace(/(?<!\\)"/g, '\\"');
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
