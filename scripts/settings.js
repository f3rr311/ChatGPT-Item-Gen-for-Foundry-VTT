/**
 * Module settings registration for Bytes AI Foundry.
 */

export const MODULE_ID = "chatgpt-item-generator";

export function registerSettings() {
  // OpenAI & DALL-E API Keys
  game.settings.register(MODULE_ID, "openaiApiKey", {
    name: "OpenAI API Key",
    hint: "Enter your OpenAI API key to enable AI-generated item descriptions. (Changing this will reload the module.)",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "dalleApiKey", {
    name: "DALL\u00B7E API Key",
    hint: "Enter your OpenAI API key for DALL\u00B7E / GPT Image to enable AI-generated images. (Changing this will reload the module.)",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: value => window.location.reload()
  });

  // Model Selection
  game.settings.register(MODULE_ID, "chatModel", {
    name: "Primary Model (Item JSON & Roll Tables)",
    hint: "Used for the heavy lifting: generating item JSON and roll table JSON. Higher quality models produce better items.",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-4.1",
    choices: {
      "gpt-4.1": "GPT-4.1 (Best Quality)",
      "gpt-4.1-mini": "GPT-4.1 Mini (Good Quality, 5x Cheaper)",
      "gpt-4.1-nano": "GPT-4.1 Nano (Basic, 25x Cheaper)",
      "gpt-4o": "GPT-4o (Fast)",
      "gpt-4o-mini": "GPT-4o Mini (Fast, Cheap)",
      "gpt-4": "GPT-4 (Legacy)"
    },
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "lightModel", {
    name: "Lightweight Model (Names, Fixes, Properties)",
    hint: "Used for simpler tasks: name generation, JSON fixes, mismatch corrections, magical properties. Mini/Nano models work great here and save money.",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-4.1-mini",
    choices: {
      "gpt-4.1": "GPT-4.1 (Same as Primary)",
      "gpt-4.1-mini": "GPT-4.1 Mini (Recommended)",
      "gpt-4.1-nano": "GPT-4.1 Nano (Cheapest)",
      "gpt-4o": "GPT-4o",
      "gpt-4o-mini": "GPT-4o Mini",
      "gpt-4": "GPT-4 (Legacy)"
    },
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "imageModel", {
    name: "Image Generation Model",
    hint: "Select the OpenAI image model. DALL\u00B7E 2/3 are deprecated and will stop working after May 12, 2026.",
    scope: "world",
    config: true,
    type: String,
    default: "gpt-image-1",
    choices: {
      "gpt-image-1": "GPT Image 1 (Recommended)",
      "dall-e-3": "DALL\u00B7E 3 (Deprecated May 2026)",
      "dall-e-2": "DALL\u00B7E 2 (Deprecated May 2026)"
    },
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "imageFormat", {
    name: "Image Output Format",
    hint: "Format for generated images. PNG is lossless, WebP is smaller, JPEG is smallest.",
    scope: "world",
    config: true,
    type: String,
    default: "png",
    choices: {
      "png": "PNG (Lossless)",
      "webp": "WebP (Smaller)",
      "jpeg": "JPEG (Smallest)"
    },
    onChange: value => window.location.reload()
  });

  // Stable Diffusion settings
  game.settings.register(MODULE_ID, "stableDiffusionEnabled", {
    name: "Use Stable Diffusion for Image Generation",
    hint: "Toggle to use Stable Diffusion instead of OpenAI for generating item images.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false,
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "stableDiffusionAPIKey", {
    name: "Stable Diffusion API Key",
    hint: "Enter your Stable Diffusion API key (if required) for generating images.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "stableDiffusionEndpoint", {
    name: "Stable Diffusion API Endpoint",
    hint: "Enter the endpoint URL for your Stable Diffusion image generation service.",
    scope: "world",
    config: true,
    type: String,
    default: "http://127.0.0.1:7860/sd-queue/txt2img",
    onChange: value => window.location.reload()
  });

  // Stable Diffusion prompt settings
  game.settings.register(MODULE_ID, "sdMainPrompt", {
    name: "Stable Diffusion Main Prompt",
    hint: "Base prompt for image generation. Use {prompt} as a placeholder for dynamic item details. (Disclaimer: Editing this may affect image quality.)",
    scope: "world",
    config: true,
    type: String,
    default: "Refined, highly detailed, fantasy concept art for a DnD 5e item with these details: {prompt}. Do not include any text in the image.",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "sdNegativePrompt", {
    name: "Stable Diffusion Negative Prompt",
    hint: "Terms to exclude from the generated image. (Disclaimer: Editing this may affect image quality.)",
    scope: "world",
    config: true,
    type: String,
    default: "rough sketch, blurry, cartoonish, text, watermark, signature, low detail",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "sdSteps", {
    name: "Stable Diffusion Steps",
    hint: "Number of steps to generate the image. (Disclaimer: Higher values may increase generation time.)",
    scope: "world",
    config: true,
    type: Number,
    default: 70,
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "sdCfgScale", {
    name: "Stable Diffusion CFG Scale",
    hint: "Controls how strongly the model follows the prompt. (Disclaimer: Higher values enforce the prompt more strictly.)",
    scope: "world",
    config: true,
    type: Number,
    default: 9.0,
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "sdSamplerName", {
    name: "Stable Diffusion Sampler Name",
    hint: "Name of the sampler to use. (Disclaimer: Ensure this matches one available on your Stable Diffusion instance.)",
    scope: "world",
    config: true,
    type: String,
    default: "Euler",
    onChange: value => window.location.reload()
  });

  // ChatGPT prompt settings
  game.settings.register(MODULE_ID, "chatgptJSONPrompt", {
    name: "ChatGPT Item JSON Prompt (Editable Portion)",
    hint: "Enter any additional instructions for generating the item JSON. The essential JSON formatting is fixed and cannot be changed.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "chatgptRollTablePrompt", {
    name: "ChatGPT Item Roll Table JSON Prompt (Editable Portion)",
    hint: "Enter any additional instructions for generating the roll table JSON. The essential JSON formatting is fixed and cannot be changed.",
    scope: "world",
    config: true,
    type: String,
    default: "You are an expert in fantasy RPGs. Generate distinctive, evocative item names for the roll table",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "chatgptFixMismatchPrompt", {
    name: "ChatGPT Fix Mismatch Prompt (Editable Portion)",
    hint: "Enter any additional instructions for fixing the JSON mismatch. The essential JSON formatting is fixed and cannot be changed.",
    scope: "world",
    config: true,
    type: String,
    default: "",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "chatgptNamePrompt", {
    name: "ChatGPT Item Name Prompt (Editable Portion)",
    hint: "Enter any additional instructions for generating the item name. The fixed instruction 'Do not output JSON.' is enforced and cannot be changed.",
    scope: "world",
    config: true,
    type: String,
    default: "You are an expert in fantasy RPGs. Do not include the word 'dragon' unless explicitly requested.",
    onChange: value => window.location.reload()
  });
  game.settings.register(MODULE_ID, "dallePrompt", {
    name: "Image Prompt",
    hint: "Prompt for image generation. Use {prompt} as a placeholder for what you entered in the prompt dialog. (Disclaimer: Editing this may affect image output.)",
    scope: "world",
    config: true,
    type: String,
    default: "A dramatic dark-fantasy illustration of a single DnD 5e item: {prompt}. Rendered in a moody, atmospheric style with deep shadows, rich dark tones, and warm magical highlights or glowing enchantment effects. Highly detailed textures on metal, leather, gemstones, and magical auras. The item is the sole focus, displayed against a dark, shadowy background with subtle ambient lighting. Style of a dark fantasy collectible card or high-end RPG game asset. No text, no letters, no words, no labels, no writing anywhere in the image.",
    onChange: value => window.location.reload()
  });
}
