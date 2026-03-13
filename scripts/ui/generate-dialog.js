/**
 * Generate dialog — main UI for creating items and roll tables.
 */

import { generateItemData } from '../generators/item-generator.js';
import { createFoundryRollTableFromDialog } from '../generators/table-generator.js';
import { openPreviewDialog } from './preview-dialog.js';
import { showProgressBar, hideProgressBar } from '../utils/ui-utils.js';

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

/**
 * @param {Function} buildConfig — returns a fresh GeneratorConfig
 * @param {Function} openHistoryDialogFn — opens the history dialog
 */
export function openGenerateDialog(buildConfig, openHistoryDialogFn) {
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
        callback: () => openHistoryDialogFn()
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
