/**
 * xAI Grok image provider.
 * Uses xAI's OpenAI-compatible image generation endpoint (grok-imagine-image).
 */

import { ensureFolder, saveImageLocally } from '../../utils/file-utils.js';

const IMAGE_ENDPOINT = "https://api.x.ai/v1/images/generations";
const DEFAULT_MODEL = "grok-imagine-image";

// ─── Provider Definition ───

export const xaiImageProvider = {
  id: "xai",
  name: "xAI Grok",
  requiresApiKey: true,

  /**
   * Generate an image using xAI's image generation API.
   * @param {string} prompt — item description for image generation
   * @param {GeneratorConfig} config — module config with xaiApiKey, imageFolder
   * @returns {Promise<string|null>} path to saved image file, or null on failure
   */
  async generateImage(prompt, config) {
    if (!config.xaiApiKey) {
      console.error("xAI Image: no API key configured.");
      return null;
    }

    // Wrap prompt with item-icon framing for focused D&D item art
    const imagePrompt = `A single DnD 5e item: ${prompt}. Centered on a dark, shadowy background. Highly detailed textures on metal, leather, gemstones, and magical auras. Style of a dark fantasy RPG inventory icon. No text, no letters, no words.`;

    const requestBody = {
      model: DEFAULT_MODEL,
      prompt: imagePrompt,
      n: 1,
      response_format: "b64_json",
      aspect_ratio: "1:1"
    };

    try {
      const response = await fetch(IMAGE_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.xaiApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`xAI image API error ${response.status}: ${errorBody}`);
        return null;
      }

      const data = await response.json();

      if (data.error) {
        console.error("xAI image generation error:", data.error);
        return null;
      }

      const b64 = data.data?.[0]?.b64_json;
      if (!b64) {
        console.error("xAI Image: no image data in response.");
        return null;
      }

      const dataUrl = `data:image/png;base64,${b64}`;
      const shortName = prompt.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("_").toLowerCase();
      const fileName = `${shortName}_${Date.now()}.png`;
      const targetFolder = config.imageFolder;
      await ensureFolder(targetFolder);

      return await saveImageLocally(dataUrl, fileName, targetFolder);
    } catch (err) {
      console.error("xAI image request failed:", err.message);
      return null;
    }
  }
};
