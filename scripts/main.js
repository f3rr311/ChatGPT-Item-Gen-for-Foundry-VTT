/**
 * ChatGPT Item Generator — Entry point.
 * Registers settings, builds config, hooks into Foundry, and provides the generate dialog.
 */

import { registerSettings } from './settings.js';
import { createUniqueItemDoc } from './generators/item-generator.js';
import { createFoundryRollTableFromDialog } from './generators/table-generator.js';

const MODULE_ID = "chatgpt-item-generator";

// ---------- Config Builder ----------

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
    keywords: ["ring", "amulet", "dagger", "sword", "shield", "gloves", "cloak", "potion"],
    imageFolder: MODULE_ID,
    // isNewerVersion(a, b) returns true if a > b.
    // !isNewerVersion("4.0.0", sysVer) => sysVer >= "4.0.0"
    isDnd5eV4: isDnd5e && !foundry.utils.isNewerVersion("4.0.0", sysVer),
    isDnd5eV5: isDnd5e && !foundry.utils.isNewerVersion("5.0.0", sysVer),
    dnd5eVersion: isDnd5e ? sysVer : null,
    isV13Core: game.release.generation >= 13
  };
}

// ---------- Dialog ----------

function openGenerateDialog() {
  const config = buildConfig();

  new Dialog({
    title: "Generate AI Object",
    content: `
      <div class="chatgpt-gen-form">
        <div class="chatgpt-dialog-header">
          <i class="fas fa-wand-magic-sparkles"></i>
          <span>AI Generator</span>
        </div>
        <form>
          <div class="form-group">
            <label>Generate</label>
            <select id="ai-object-type">
              <option value="item">Item</option>
              <option value="rolltable">Roll Table</option>
            </select>
          </div>
          <div class="form-group" id="explicit-type-group">
            <label>Item Type</label>
            <select id="ai-explicit-type">
              <option value="">Auto-detect (from prompt)</option>
              <option value="Weapon">Weapon</option>
              <option value="Armor">Armor</option>
              <option value="Equipment">Equipment</option>
              <option value="Consumable">Consumable</option>
              <option value="Tool">Tool</option>
              <option value="Loot">Loot</option>
              <option value="Spell">Spell</option>
              <option value="Feat">Feat</option>
              <option value="Container">Container</option>
              <option value="Background">Background</option>
            </select>
          </div>
          <div class="form-group" id="table-type-group" style="display: none;">
            <label>Roll Table Mode</label>
            <select id="ai-table-type">
              <option value="items">Items (creates actual items)</option>
              <option value="generic">Text/Effects (random effects, events, encounters)</option>
            </select>
          </div>
          <div class="form-group" id="table-count-group" style="display: none;">
            <label>Number of Entries</label>
            <input id="ai-table-count" type="number" min="1" max="50" value="10" />
          </div>
          <div class="form-group" id="name-override-group">
            <label>Name Override</label>
            <input id="ai-name-override" type="text" placeholder="Leave blank to auto-generate" />
          </div>
          <div class="form-group">
            <label>Prompt</label>
            <textarea id="ai-description" rows="4" placeholder="e.g., A flaming longsword that deals extra fire damage to undead creatures..."></textarea>
          </div>
        </form>
      </div>
    `,
    buttons: {
      generate: {
        icon: '<i class="fas fa-wand-magic-sparkles"></i>',
        label: "Generate",
        callback: async (html) => {
          // Normalize html for both v12 (jQuery) and v13 (native element)
          const root = html instanceof jQuery ? html[0] : html;
          const objectType = root.querySelector("#ai-object-type").value;
          const desc = root.querySelector("#ai-description").value;
          const explicitType = root.querySelector("#ai-explicit-type").value;
          const nameOverride = root.querySelector("#ai-name-override").value;

          if (!desc) return ui.notifications.error("Description is required");

          if (objectType === "rolltable") {
            const tableMode = root.querySelector("#ai-table-type").value;
            const entryCount = parseInt(root.querySelector("#ai-table-count").value, 10) || 10;
            // Roll tables don't use the global explicit type — GPT decides per-entry
            await createFoundryRollTableFromDialog(`${desc} -- tableType=${tableMode}`, "", config, entryCount);
          } else {
            await createUniqueItemDoc(desc, config, nameOverride, explicitType);
          }
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "generate",
    render: (html) => {
      // Normalize html for both v12 (jQuery) and v13 (native element)
      const root = html instanceof jQuery ? html[0] : html;
      const dialog = root.closest('.dialog');
      if (dialog) {
        dialog.classList.add('chatgpt-dialog');
        dialog.style.height = 'auto';
        dialog.style.maxHeight = 'none';
        dialog.style.minWidth = '420px';
      }

      const objectTypeSelect = root.querySelector("#ai-object-type");
      const tableTypeSelect = root.querySelector("#ai-table-type");
      const tableTypeGroup = root.querySelector("#table-type-group");
      const tableCountGroup = root.querySelector("#table-count-group");
      const nameOverrideGroup = root.querySelector("#name-override-group");
      const explicitTypeGroup = root.querySelector("#explicit-type-group");

      const updateVisibility = () => {
        const objectType = objectTypeSelect.value;
        const tableMode = tableTypeSelect.value;

        if (objectType === "rolltable") {
          tableTypeGroup.style.display = "";
          tableCountGroup.style.display = "";
          nameOverrideGroup.style.display = "none";
        } else {
          tableTypeGroup.style.display = "none";
          tableCountGroup.style.display = "none";
          nameOverrideGroup.style.display = "";
        }

        // Item type dropdown only shows for single item generation, NOT roll tables
        // (roll tables let GPT decide the correct type per entry)
        if (objectType === "item") {
          explicitTypeGroup.style.display = "";
        } else {
          explicitTypeGroup.style.display = "none";
        }
      };

      updateVisibility();
      objectTypeSelect.addEventListener("change", updateVisibility);
      tableTypeSelect.addEventListener("change", updateVisibility);
    }
  }).render(true);
}

// ---------- Hooks ----------

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  // Expose a lightweight API object on game for backward compat
  game.chatGPTItemGenerator = {
    createFoundryAIObject: openGenerateDialog,
    openGenerateDialog
  };

  // Warn about deprecated image models
  const imageModel = game.settings.get(MODULE_ID, "imageModel");
  if (imageModel.startsWith("dall-e")) {
    ui.notifications.warn(
      `ChatGPT Item Generator: You are using ${imageModel}, which is deprecated and will stop working after May 12, 2026. Please switch to "GPT Image 1" in module settings.`,
      { permanent: true }
    );
  }

  console.log("ChatGPT Item Generator v2.0.0 loaded");
});

Hooks.on("renderItemDirectory", (app, html, data) => {
  if (!game.user.isGM) return;

  // v13 passes a native element, v12 passes jQuery
  if (game.release.generation < 13) {
    const button = $("<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>");
    html.find(".directory-footer").append(button);
    button.click(() => openGenerateDialog());
  } else {
    const buttonHTML = `<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>`;
    html.querySelector(".directory-footer").insertAdjacentHTML('beforeend', buttonHTML);
    html.querySelector(".directory-footer button:last-child").addEventListener("click", () => openGenerateDialog());
  }
});
