/**
 * ChatGPT Item Generator — Entry point.
 * Registers settings, builds config, hooks into Foundry, and delegates to UI dialogs.
 */

import { registerSettings, MODULE_ID } from './settings.js';
import { openGenerateDialog } from './ui/generate-dialog.js';
import { openHistoryDialog } from './ui/history-dialog.js';
import { NAME_KEYWORDS } from './utils/type-keywords.js';

// ---------- Config Builder ----------

/**
 * @typedef {Object} GeneratorConfig
 * @property {string} apiKey — OpenAI API key for chat completions
 * @property {string} dalleApiKey — OpenAI API key for image generation
 * @property {string} chatModel — Primary GPT model (e.g. "gpt-4.1")
 * @property {string} lightModel — Lightweight GPT model for fixes/names
 * @property {string} imageModel — Image generation model (e.g. "gpt-image-1")
 * @property {string} imageFormat — Output format: "png", "webp", or "jpeg"
 * @property {string[]} keywords — Item keyword list for name forcing
 * @property {string} imageFolder — Foundry data folder for generated images
 * @property {boolean} isDnd5eV4 — true if dnd5e system version >= 4.0.0
 * @property {string|null} dnd5eVersion — dnd5e system version string, or null
 * @property {boolean} isV13Core — true if Foundry core version >= 13
 */

function buildConfig() {
  const isDnd5e = game.system.id === "dnd5e";
  const sysVer = isDnd5e ? game.system.version : "0.0.0";
  return {
    apiKey: game.settings.get(MODULE_ID, "openaiApiKey") || "",
    dalleApiKey: game.settings.get(MODULE_ID, "dalleApiKey") || "",
    chatModel: game.settings.get(MODULE_ID, "chatModel") || "gpt-4.1",
    lightModel: game.settings.get(MODULE_ID, "lightModel") || "gpt-4.1-mini",
    imageModel: game.settings.get(MODULE_ID, "imageModel") || "gpt-image-1",
    imageFormat: game.settings.get(MODULE_ID, "imageFormat") || "png",
    keywords: NAME_KEYWORDS,
    imageFolder: MODULE_ID,
    // isNewerVersion(a, b) returns true if a > b.
    // !isNewerVersion("4.0.0", sysVer) => sysVer >= "4.0.0"
    isDnd5eV4: isDnd5e && !foundry.utils.isNewerVersion("4.0.0", sysVer),
    dnd5eVersion: isDnd5e ? sysVer : null,
    isV13Core: game.release.generation >= 13
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

// ---------- Hooks ----------

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  // Expose a lightweight API object on game for backward compat
  game.chatGPTItemGenerator = {
    createFoundryAIObject: showGenerateDialog,
    openGenerateDialog: showGenerateDialog,
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
      `ChatGPT Item Generator: You are using ${imageModel}, which is deprecated and will stop working after May 12, 2026. Please switch to "GPT Image 1" in module settings.`,
      { permanent: true }
    );
  }

  const moduleVersion = game.modules.get(MODULE_ID)?.version ?? "unknown";
  console.log(`ChatGPT Item Generator v${moduleVersion} loaded`);
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
