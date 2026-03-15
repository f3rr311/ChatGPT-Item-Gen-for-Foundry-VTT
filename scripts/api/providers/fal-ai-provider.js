/**
 * FAL.ai image provider.
 * Generates images via FAL.ai's synchronous API (FLUX, Recraft, Ideogram models).
 */

import { ensureFolder, saveImageLocally } from '../../utils/file-utils.js';

const DEFAULT_MODEL = "fal-ai/flux/dev";

// ─── Provider Definition ───

export const falAIProvider = {
  id: "fal-ai",
  name: "FAL.ai",
  requiresApiKey: true,

  /**
   * Generate an image using the FAL.ai synchronous API.
   * @param {string} prompt — item description for image generation
   * @param {GeneratorConfig} config — module config with falApiKey, imageModel, imageFormat, imageFolder
   * @returns {Promise<string|null>} path to saved image file, or null on failure
   */
  async generateImage(prompt, config) {
    if (!config.falApiKey) {
      console.error("FAL.ai: no API key configured.");
      return null;
    }

    // Use imageModel if it looks like a FAL model ID, otherwise use default
    const model = config.imageModel?.startsWith("fal-ai/") ? config.imageModel : DEFAULT_MODEL;
    const endpoint = `https://fal.run/${model}`;
    const outputFormat = config.imageFormat === "jpeg" ? "jpeg" : "png";

    const requestBody = {
      prompt,
      image_size: "square_hd",
      num_images: 1,
      output_format: outputFormat,
      enable_safety_checker: true
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Key ${config.falApiKey}`
        },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "");
        console.error(`FAL.ai API error ${response.status}: ${errorBody}`);
        return null;
      }

      const data = await response.json();
      const imageUrl = data.images?.[0]?.url;

      if (!imageUrl) {
        console.error("FAL.ai: no image URL in response.");
        return null;
      }

      // Download the image from the FAL media URL and save locally
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        console.error(`FAL.ai: failed to download image from ${imageUrl}`);
        return null;
      }

      const blob = await imageResponse.blob();
      const reader = new FileReader();
      const dataUrl = await new Promise((resolve, reject) => {
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      const ext = outputFormat === "jpeg" ? "jpg" : "png";
      const shortName = prompt.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("_").toLowerCase();
      const fileName = `${shortName}_${Date.now()}.${ext}`;
      const targetFolder = config.imageFolder;
      await ensureFolder(targetFolder);

      return await saveImageLocally(dataUrl, fileName, targetFolder);
    } catch (err) {
      console.error("FAL.ai request failed:", err.message);
      return null;
    }
  }
};
