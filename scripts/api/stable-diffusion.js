/**
 * Stable Diffusion image generation and polling.
 */

import { ensureFolder, saveImageLocally } from '../utils/file-utils.js';

export async function generateSDImage(prompt, config) {
  const sdAPIKey = game.settings.get("chatgpt-item-generator", "stableDiffusionAPIKey");
  const sdEndpoint = game.settings.get("chatgpt-item-generator", "stableDiffusionEndpoint");
  const sdMainPrompt = game.settings.get("chatgpt-item-generator", "sdMainPrompt");
  const sdNegativePrompt = game.settings.get("chatgpt-item-generator", "sdNegativePrompt");
  const sdSteps = game.settings.get("chatgpt-item-generator", "sdSteps");
  const sdCfgScale = game.settings.get("chatgpt-item-generator", "sdCfgScale");
  const sdSamplerName = game.settings.get("chatgpt-item-generator", "sdSamplerName");

  const payload = {
    prompt: sdMainPrompt.replace("{prompt}", prompt),
    negative_prompt: sdNegativePrompt,
    styles: [],
    seed: -1,
    subseed: -1,
    subseed_strength: 0,
    seed_resize_from_w: -1,
    seed_resize_from_h: -1,
    sampler_name: sdSamplerName,
    batch_size: 1,
    n_iter: 1,
    steps: sdSteps,
    cfg_scale: sdCfgScale,
    width: 1024,
    height: 1024,
    restore_faces: false,
    tiling: false,
    do_not_save_samples: false,
    do_not_save_grid: false,
    send_images: true,
    save_images: false
  };

  const response = await fetch(sdEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(sdAPIKey && { "Authorization": `Bearer ${sdAPIKey}` })
    },
    body: JSON.stringify(payload)
  });
  const data = await response.json();

  let imageBase64 = null;

  if (data && data.image) {
    imageBase64 = data.image;
  } else if (data && data.task_id) {
    console.log("Stable Diffusion image is being generated. Polling for result...");
    imageBase64 = await pollStableDiffusionStatus(data.task_id);
  }

  if (imageBase64) {
    const dataUrl = `data:image/png;base64,${imageBase64}`;
    const fileName = `${prompt.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.png`;
    const targetFolder = config.imageFolder;
    await ensureFolder(targetFolder);
    return await saveImageLocally(dataUrl, fileName, targetFolder);
  }

  return null;
}

async function pollStableDiffusionStatus(taskId) {
  const sdStatusEndpoint = `http://127.0.0.1:7860/sd-queue/${taskId}/status`;
  const maxAttempts = 60;
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      const response = await fetch(sdStatusEndpoint);
      const data = await response.json();
      if (data && data.status && data.status.toLowerCase() === "completed") {
        if (data.image) return data.image;
        if (data.images && data.images.length > 0) return data.images[0];
        if (data.result && data.result.images && data.result.images.length > 0) return data.result.images[0];
      }
    } catch (err) {
      console.error("Error polling stable diffusion status:", err);
    }
    await new Promise(resolve => setTimeout(resolve, 3000));
    attempt++;
  }
  return null;
}
