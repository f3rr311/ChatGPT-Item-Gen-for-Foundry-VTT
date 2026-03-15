/**
 * Bytes AI Foundry — Entry point.
 * Registers settings, builds config, hooks into Foundry, and delegates to UI dialogs.
 */

import { registerSettings, migrateSettings, applyProviderDefaults, MODULE_ID } from './settings.js';
import { openGenerateDialog } from './ui/generate-dialog.js';
import { openHistoryDialog } from './ui/history-dialog.js';
import { openActorDialog } from './ui/actor-dialog.js';
import { NAME_KEYWORDS } from './utils/type-keywords.js';

// ---------- Config Builder ----------

/**
 * @typedef {Object} GeneratorConfig
 * @property {string} apiKey — OpenAI API key for chat completions
 * @property {string} dalleApiKey — OpenAI API key for image generation
 * @property {string} chatModel — Primary model name (provider-specific)
 * @property {string} lightModel — Lightweight model name for fixes/names
 * @property {string} imageModel — Image generation model
 * @property {string} imageFormat — Output format: "png", "webp", or "jpeg"
 * @property {string[]} keywords — Item keyword list for name forcing
 * @property {string} imageFolder — Foundry data folder for generated images
 * @property {boolean} isDnd5eV4 — true if dnd5e system version >= 4.0.0
 * @property {string|null} dnd5eVersion — dnd5e system version string, or null
 * @property {boolean} isV13Core — true if Foundry core version >= 13
 * @property {string} textProvider — "openai"|"anthropic"|"gemini"|"xai"|"ollama"|"custom"
 * @property {string} imageProvider — "openai"|"stable-diffusion"|"stability-ai"|"fal-ai"
 * @property {string} anthropicApiKey — Anthropic API key
 * @property {string} geminiApiKey — Google Gemini API key
 * @property {string} xaiApiKey — xAI API key
 * @property {string} customApiKey — Custom provider API key
 * @property {string} customEndpoint — Custom provider endpoint URL
 * @property {string} ollamaEndpoint — Ollama base URL
 * @property {string} stabilityApiKey — Stability AI API key
 * @property {string} falApiKey — FAL.ai API key
 */

function buildConfig() {
  const isDnd5e = game.system.id === "dnd5e";
  const sysVer = isDnd5e ? game.system.version : "0.0.0";
  return {
    // Existing fields (unchanged)
    apiKey: game.settings.get(MODULE_ID, "openaiApiKey") || "",
    dalleApiKey: game.settings.get(MODULE_ID, "dalleApiKey") || "",
    chatModel: game.settings.get(MODULE_ID, "chatModel") || "gpt-4.1",
    lightModel: game.settings.get(MODULE_ID, "lightModel") || "gpt-4.1-mini",
    imageModel: game.settings.get(MODULE_ID, "imageModel") || "gpt-image-1",
    imageFormat: game.settings.get(MODULE_ID, "imageFormat") || "png",
    keywords: NAME_KEYWORDS,
    imageFolder: MODULE_ID,
    isDnd5eV4: isDnd5e && !foundry.utils.isNewerVersion("4.0.0", sysVer),
    dnd5eVersion: isDnd5e ? sysVer : null,
    isV13Core: game.release.generation >= 13,

    // Provider selection
    textProvider: game.settings.get(MODULE_ID, "textProvider") || "openai",
    imageProvider: game.settings.get(MODULE_ID, "imageProvider") || "openai",

    // Per-provider API keys
    anthropicApiKey: game.settings.get(MODULE_ID, "anthropicApiKey") || "",
    geminiApiKey: game.settings.get(MODULE_ID, "geminiApiKey") || "",
    xaiApiKey: game.settings.get(MODULE_ID, "xaiApiKey") || "",
    customApiKey: game.settings.get(MODULE_ID, "customApiKey") || "",
    customEndpoint: game.settings.get(MODULE_ID, "customEndpoint") || "",
    ollamaEndpoint: game.settings.get(MODULE_ID, "ollamaEndpoint") || "http://localhost:11434",

    // Image provider keys
    stabilityApiKey: game.settings.get(MODULE_ID, "stabilityApiKey") || "",
    falApiKey: game.settings.get(MODULE_ID, "falApiKey") || ""
  };
}

// ---------- Dialog Wiring ----------

// Mutually recursive: generate <-> history dialogs reference each other.
// We pass buildConfig and the counterpart opener as callbacks to break the cycle.

function showGenerateDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can use the item generator.");
    return;
  }
  openGenerateDialog(buildConfig, showHistoryDialog);
}

function showHistoryDialog() {
  openHistoryDialog(buildConfig, showGenerateDialog);
}

function showActorDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can use the actor generator.");
    return;
  }
  openActorDialog(buildConfig, showHistoryDialog);
}

// ---------- Hooks ----------

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", async () => {
  // Run one-time settings migration, then apply provider defaults
  await migrateSettings();
  await applyProviderDefaults();

  // Expose a lightweight API object on game for backward compat
  game.chatGPTItemGenerator = {
    createFoundryAIObject: showGenerateDialog,
    openGenerateDialog: showGenerateDialog,
    openActorDialog: showActorDialog,
    sessionCost: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      apiCalls: 0,
      imageGenerations: 0
    },
    currentCost: {
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      apiCalls: 0,
      imageGenerations: 0
    },
    history: []
  };

  // Warn about deprecated image models
  const imageModel = game.settings.get(MODULE_ID, "imageModel");
  if (imageModel.startsWith("dall-e")) {
    ui.notifications.warn(
      `Bytes AI Foundry: You are using ${imageModel}, which is deprecated and will stop working after May 12, 2026. Please switch to "GPT Image 1" in module settings.`,
      { permanent: true }
    );
  }

  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "unknown";
  console.log(`Bytes AI Foundry v${moduleVersion} loaded`);
});

// Inject subtitle below the module title in Settings
Hooks.on("renderSettingsConfig", (app, html) => {
  const root = html instanceof jQuery ? html[0] : html;
  const header = root.querySelector(`[data-category="${MODULE_ID}"] h2, h2.module-header[data-module-id="${MODULE_ID}"]`);
  if (!header) {
    // v13 group-based layout — find our module heading by text content
    const allHeaders = root.querySelectorAll("h2");
    for (const h of allHeaders) {
      if (h.textContent.trim() === "Bytes AI Foundry") {
        const sub = document.createElement("p");
        sub.style.cssText = "margin: -4px 0 8px 0; font-size: 12px; color: #aaa; font-style: italic;";
        sub.textContent = "Multi-provider AI item, NPC, character, and roll table generator for D&D 5e";
        h.after(sub);
        break;
      }
    }
  } else {
    const sub = document.createElement("p");
    sub.style.cssText = "margin: -4px 0 8px 0; font-size: 12px; color: #aaa; font-style: italic;";
    sub.textContent = "Multi-provider AI item, NPC, character, and roll table generator for D&D 5e";
    header.after(sub);
  }
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  // v13 passes a native element, v12 passes jQuery
  if (game.release.generation < 13) {
    const button = $("<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>");
    html.find(".directory-footer").append(button);
    button.click(() => showGenerateDialog());
  } else {
    const buttonHTML = `<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>`;
    html.querySelector(".directory-footer").insertAdjacentHTML('beforeend', buttonHTML);
    html.querySelector(".directory-footer button:last-child").addEventListener("click", () => showGenerateDialog());
  }
});

Hooks.on("renderActorDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  if (game.release.generation < 13) {
    const button = $("<button><i class='fas fa-users'></i> Generate AI (NPC or Character)</button>");
    html.find(".directory-footer").append(button);
    button.click(() => showActorDialog());
  } else {
    const buttonHTML = `<button><i class='fas fa-users'></i> Generate AI (NPC or Character)</button>`;
    html.querySelector(".directory-footer").insertAdjacentHTML('beforeend', buttonHTML);
    html.querySelector(".directory-footer button:last-child").addEventListener("click", () => showActorDialog());
  }
});
