/**
 * ChatGPT Item Generator — Entry point.
 * Registers settings, builds config, hooks into Foundry, and provides the generate dialog.
 */

import { registerSettings, MODULE_ID } from './settings.js';
import { generateItemData, parseItemJSON } from './generators/item-generator.js';
import { createFoundryRollTableFromDialog } from './generators/table-generator.js';
import { openPreviewDialog } from './ui/preview-dialog.js';
import { showProgressBar, hideProgressBar, estimateCost } from './utils/ui-utils.js';
import { generateItemName, ensureItemName } from './generators/name-generator.js';
import { generateItemImage, generateItemJSON } from './api/openai.js';

// ---------- Prompt Templates ----------

const PROMPT_TEMPLATES = [
  { label: "— Select a template —", prompt: "", objectType: "", explicitType: "", tableType: "" },
  { label: "Uncommon Weapon", prompt: "An uncommon magical weapon with a minor enchantment, suitable for a mid-level adventurer.", objectType: "item", explicitType: "Weapon", tableType: "" },
  { label: "Rare Armor", prompt: "A rare suit of magical armor with protective enchantments that shield the wearer from harm.", objectType: "item", explicitType: "Armor", tableType: "" },
  { label: "Legendary Wondrous Item", prompt: "A legendary wondrous item of immense power, coveted by heroes and villains alike.", objectType: "item", explicitType: "Equipment", tableType: "" },
  { label: "Healing Potion", prompt: "A potion of healing that restores hit points when consumed. Glows with a soft red light.", objectType: "item", explicitType: "Consumable", tableType: "" },
  { label: "3rd-Level Spell", prompt: "A 3rd-level spell with unique and creative magical effects.", objectType: "item", explicitType: "Spell", tableType: "" },
  { label: "Cursed Artifact", prompt: "A powerful cursed artifact with great power but a terrible drawback that haunts its wielder.", objectType: "item", explicitType: "", tableType: "" },
  { label: "Magical Staff", prompt: "A magical staff imbued with arcane power, capable of casting spells and channeling energy.", objectType: "item", explicitType: "Weapon", tableType: "" },
  { label: "Character Feat", prompt: "A unique feat that grants a special ability or combat technique to the character.", objectType: "item", explicitType: "Feat", tableType: "" },
  { label: "Random Loot Table", prompt: "A random loot table with assorted treasures, gems, art objects, and magical items found in a dragon's hoard.", objectType: "rolltable", explicitType: "", tableType: "items" },
  { label: "Wild Magic Table", prompt: "A wild magic surge table with chaotic and unpredictable random effects that occur when magic goes awry.", objectType: "rolltable", explicitType: "", tableType: "generic" }
];

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
 * @property {boolean} isDnd5eV5 — true if dnd5e system version >= 5.0.0
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

// ---------- History Dialog ----------

function openHistoryDialog() {
  const history = game.chatGPTItemGenerator?.history || [];

  let rows = "";
  if (history.length === 0) {
    rows = `<tr><td colspan="5" style="text-align:center; color:#888;">No items generated this session.</td></tr>`;
  } else {
    for (let i = history.length - 1; i >= 0; i--) {
      const entry = history[i];
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const typeIcon = entry.itemType === "rolltable" ? "fa-dice-d20" : "fa-scroll";
      const display = entry.entryCount ? `${entry.itemName} (${entry.entryCount} entries)` : entry.itemName;
      const isRollTable = entry.itemType === "rolltable";
      const regenButtons = isRollTable ? "—" : `
        <button class="regen-btn" data-action="name" data-idx="${i}" title="Regenerate Name"><i class="fas fa-pen"></i></button>
        <button class="regen-btn" data-action="image" data-idx="${i}" title="Regenerate Image"><i class="fas fa-image"></i></button>
        <button class="regen-btn" data-action="description" data-idx="${i}" title="Regenerate Description"><i class="fas fa-file-alt"></i></button>
      `;
      rows += `<tr>
        <td><i class="fas ${typeIcon}"></i> ${display}</td>
        <td>${entry.itemType}</td>
        <td>${entry.rarity || "—"}</td>
        <td>${time}</td>
        <td>${regenButtons}</td>
      </tr>`;
    }
  }

  // Session cost summary
  const cost = game.chatGPTItemGenerator?.sessionCost;
  let costLine = "";
  if (cost && (cost.apiCalls > 0 || cost.imageGenerations > 0)) {
    const dollars = estimateCost(cost);
    const dollarStr = dollars < 0.01 ? "<$0.01" : `~$${dollars.toFixed(2)}`;
    costLine = `<p style="text-align:center; font-size:0.8rem; color:#aaa; margin:8px 0 0;">Session: <strong>${dollarStr}</strong> | ${cost.totalTokens.toLocaleString()} tokens | ${cost.apiCalls} API calls | ${cost.imageGenerations} images</p>`;
  }

  new Dialog({
    title: "Generation History",
    content: `
      <div class="chatgpt-gen-form">
        <div class="chatgpt-dialog-header">
          <i class="fas fa-clock-rotate-left"></i>
          <span>Session History (${history.length} items)</span>
        </div>
        <div class="chatgpt-history-scroll">
          <table class="chatgpt-history-table" style="width:100%; border-collapse:collapse;">
            <thead>
              <tr style="border-bottom:1px solid #444;">
                <th style="text-align:left; padding:4px 8px;">Name</th>
                <th style="text-align:left; padding:4px 8px;">Type</th>
                <th style="text-align:left; padding:4px 8px;">Rarity</th>
                <th style="text-align:left; padding:4px 8px;">Time</th>
                <th style="text-align:left; padding:4px 8px;">Actions</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        ${costLine}
      </div>
    `,
    buttons: {
      back: {
        icon: '<i class="fas fa-arrow-left"></i>',
        label: "Back",
        callback: () => openGenerateDialog()
      }
    },
    default: "back",
    render: (html) => {
      const root = html instanceof jQuery ? html[0] : html;
      const dialog = root.closest('.dialog');
      if (dialog) {
        dialog.classList.add('chatgpt-dialog');
        dialog.style.height = 'auto';
        dialog.style.minWidth = '580px';
      }

      // Attach regen button click handlers
      root.querySelectorAll(".regen-btn").forEach(btn => {
        btn.addEventListener("click", async (e) => {
          const action = btn.dataset.action;
          const idx = parseInt(btn.dataset.idx, 10);
          const entry = history[idx];
          if (!entry) return;

          // Find the existing item in the world
          const item = game.items.get(entry.itemId);
          if (!item) {
            ui.notifications.warn(`Item "${entry.itemName}" no longer exists in this world.`);
            return;
          }

          // Use fresh config for current settings
          const config = buildConfig();
          const combined = entry.prompt + (entry.explicitType ? " - " + entry.explicitType : "");

          // Disable button and show spinner
          btn.disabled = true;
          const origHTML = btn.innerHTML;
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';

          try {
            if (action === "name") {
              const newName = await generateItemName(combined, config);
              const refined = await ensureItemName(newName, item.system.description.value, config);
              await item.update({ name: refined });
              entry.itemName = refined;
              ui.notifications.info(`Name updated: ${refined}`);
            } else if (action === "image") {
              const newPath = await generateItemImage(combined, config);
              if (newPath) {
                await item.update({ img: newPath });
                entry.imagePath = newPath;
                ui.notifications.info(`Image updated for "${item.name}"`);
              } else {
                ui.notifications.warn("Image regeneration failed.");
              }
            } else if (action === "description") {
              const rawJSON = await generateItemJSON(combined, config, entry.explicitType || "");
              const parsed = await parseItemJSON(rawJSON, config);
              if (parsed.description) {
                await item.update({ "system.description.value": parsed.description });
                ui.notifications.info(`Description updated for "${item.name}"`);
              } else {
                ui.notifications.warn("Description regeneration returned empty.");
              }
            }
          } catch (err) {
            console.error(`History regen (${action}) failed:`, err);
            ui.notifications.error(`Regeneration failed: ${err.message}`);
          }

          btn.disabled = false;
          btn.innerHTML = origHTML;
        });
      });
    }
  }, { classes: ["chatgpt-dialog"], resizable: true }).render(true);
}

// ---------- Generate Dialog ----------

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
            <label>Template</label>
            <select id="ai-template">
              ${PROMPT_TEMPLATES.map((t, i) => `<option value="${i}">${t.label}</option>`).join("")}
            </select>
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
            // Generate item data, then show preview dialog for user approval
            showProgressBar();
            const result = await generateItemData(desc, config, nameOverride, explicitType);
            hideProgressBar();
            await openPreviewDialog(result);
          }
        }
      },
      history: {
        icon: '<i class="fas fa-clock-rotate-left"></i>',
        label: "History",
        callback: () => openHistoryDialog()
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

      // Enable native right-click spellcheck on text fields
      root.querySelectorAll("#ai-description, #ai-name-override").forEach(el => {
        el.setAttribute("spellcheck", "true");
        el.addEventListener("contextmenu", e => e.stopPropagation());
      });

      // Template dropdown — populate fields on selection
      const templateSelect = root.querySelector("#ai-template");
      const promptTextarea = root.querySelector("#ai-description");
      const explicitTypeSelect = root.querySelector("#ai-explicit-type");

      templateSelect.addEventListener("change", () => {
        const idx = parseInt(templateSelect.value, 10);
        const tpl = PROMPT_TEMPLATES[idx];
        if (!tpl || idx === 0) return; // "Select a template" placeholder

        // Fill the prompt textarea
        promptTextarea.value = tpl.prompt;

        // Switch object type (item vs rolltable)
        if (tpl.objectType) {
          objectTypeSelect.value = tpl.objectType;
          updateVisibility();
        }

        // Set explicit item type for single items
        if (tpl.objectType === "item" && tpl.explicitType) {
          explicitTypeSelect.value = tpl.explicitType;
        } else if (tpl.objectType === "item") {
          explicitTypeSelect.value = "";
        }

        // Set roll table mode
        if (tpl.objectType === "rolltable" && tpl.tableType) {
          tableTypeSelect.value = tpl.tableType;
        }
      });
    }
  }, { classes: ["chatgpt-dialog"], resizable: true }).render(true);
}

// ---------- Hooks ----------

Hooks.once("init", () => {
  registerSettings();
});

Hooks.once("ready", () => {
  // Expose a lightweight API object on game for backward compat
  game.chatGPTItemGenerator = {
    createFoundryAIObject: openGenerateDialog,
    openGenerateDialog,
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
    button.click(() => openGenerateDialog());
  } else {
    const buttonHTML = `<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>`;
    html.querySelector(".directory-footer").insertAdjacentHTML('beforeend', buttonHTML);
    html.querySelector(".directory-footer button:last-child").addEventListener("click", () => openGenerateDialog());
  }
});
