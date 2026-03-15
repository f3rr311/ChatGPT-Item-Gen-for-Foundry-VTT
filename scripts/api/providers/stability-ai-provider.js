/**
 * Stability AI image provider.
 * Generates images via the Stability AI v2beta REST API (Stable Image Core).
 */

import { ensureFolder, saveImageLocally } from '../../utils/file-utils.js';

const DEFAULT_ENDPOINT = "https://api.stability.ai/v2beta/stable-image/generate/core";

// ─── Provider Definition ───

export const stabilityAIProvider = {
  id: "stability-ai",
  name: "Stability AI",
  requiresApiKey: true,

  /**
   * Generate an image using the Stability AI v2beta API (Stable Image Core).
   * Uses multipart/form-data as required by the v2beta endpoint.
   * @param {string} prompt — item description for image generation
   * @param {GeneratorConfig} config — module config with stabilityApiKey, imageFolder
   * @returns {Promise<string|null>} path to saved image file, or null on failure
   */
  async generateImage(prompt, config) {
    if (!config.stabilityApiKey) {
      console.error("Stability AI: no API key configured.");
      return null;
    }

    // Wrap raw prompt with item-icon framing so the model generates a focused
    // item illustration rather than a full landscape scene.
    const imagePrompt = `A single DnD 5e item: ${prompt}. Centered on a dark, shadowy background. Highly detailed textures on metal, leather, gemstones, and magical auras. Style of a dark fantasy RPG inventory icon. No text, no letters, no words.`;

    const formData = new FormData();
    formData.append("prompt", imagePrompt);
    formData.append("negative_prompt", "blurry, bad quality, text, watermark, signature, low detail, landscape, scenery, multiple objects, background characters");
    formData.append("aspect_ratio", "1:1");
    formData.append("style_preset", "digital-art");
    formData.append("output_format", "png");

    try {
      const response = await fetch(DEFAULT_ENDPOINT, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${config.stabilityApiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`Stability AI API error ${response.status}: ${errorBody}`);
        return null;
      }

      const data = await response.json();

      if (!data.image || data.finish_reason !== "SUCCESS") {
        console.error("Stability AI: no valid image in response.", data.finish_reason || "");
        return null;
      }

      // Save base64 image locally
      const dataUrl = `data:image/png;base64,${data.image}`;
      const shortName = prompt.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("_").toLowerCase();
      const fileName = `${shortName}_${Date.now()}.png`;
      const targetFolder = config.imageFolder;
      await ensureFolder(targetFolder);

      return await saveImageLocally(dataUrl, fileName, targetFolder);
    } catch (err) {
      console.error("Stability AI request failed:", err.message);
      return null;
    }
  }
};
