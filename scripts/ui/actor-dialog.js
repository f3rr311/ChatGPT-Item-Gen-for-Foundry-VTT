/**
 * Actor generation dialog — UI for creating NPCs and Characters.
 */

import { generateActorData } from '../generators/actor-generator.js';
import { openActorPreviewDialog } from './actor-preview-dialog.js';
import { showProgressBar, hideProgressBar, resolveHtmlRoot, initDialogRoot, enableSpellcheck } from '../utils/ui-utils.js';
import { CREATURE_TYPES, getSubclasses, getSubclassLevel } from '../utils/actor-utils.js';

// ---------- Actor Templates ----------

const ACTOR_TEMPLATES = [
  { label: "— Select a template —", prompt: "", actorType: "" },
  { label: "Goblin Warband Leader", prompt: "A cunning goblin war chief who leads raiding parties. Wields a scimitar and commands lesser goblins through fear and cunning.", actorType: "npc", cr: 1, creatureType: "humanoid" },
  { label: "Ancient Dragon", prompt: "A fearsome ancient dragon with devastating breath weapons, legendary actions, and centuries of accumulated treasure and knowledge.", actorType: "npc", cr: 20, creatureType: "dragon" },
  { label: "Undead Knight", prompt: "A fallen paladin raised as an undead champion, still wearing their battered plate armor and wielding a cursed greatsword.", actorType: "npc", cr: 5, creatureType: "undead" },
  { label: "Mysterious Merchant", prompt: "A traveling merchant with a cart full of exotic wares. Not everything is as it seems — they may be more than they appear.", actorType: "npc", cr: 0.5, creatureType: "humanoid" },
  { label: "Forest Guardian", prompt: "An ancient fey protector of a sacred grove, wielding nature magic and commanding woodland creatures.", actorType: "npc", cr: 8, creatureType: "fey" },
  { label: "Human Fighter", prompt: "A battle-hardened human fighter with a sword-and-shield fighting style, veteran of many campaigns.", actorType: "character", level: 5, className: "fighter", race: "human" },
  { label: "Elven Wizard", prompt: "A scholarly high elf wizard specializing in evocation magic, carrying a spellbook filled with powerful arcane formulas.", actorType: "character", level: 5, className: "wizard", race: "elf" },
  { label: "Tiefling Warlock", prompt: "A charismatic tiefling warlock bound to a fiendish patron, wielding eldritch blast and dark charisma.", actorType: "character", level: 5, className: "warlock", race: "tiefling" },
  { label: "Dwarven Cleric", prompt: "A stout dwarven cleric of the forge domain, wielding a warhammer and heavy armor, devoted to crafting and battle.", actorType: "character", level: 5, className: "cleric", race: "dwarf" },
  { label: "Half-Orc Barbarian", prompt: "A fierce half-orc barbarian fueled by primal rage, wielding a greataxe with devastating power.", actorType: "character", level: 5, className: "barbarian", race: "half-orc" }
];

const CR_OPTIONS = [
  "0", "1/8", "1/4", "1/2",
  ...Array.from({ length: 30 }, (_, i) => String(i + 1))
];

// SRD-only classes (Artificer is NOT in the SRD)
const CLASS_OPTIONS = [
  "", "barbarian", "bard", "cleric", "druid", "fighter",
  "monk", "paladin", "ranger", "rogue", "sorcerer", "warlock", "wizard"
];

// SRD-only races/species — non-SRD content requires purchased books
const RACE_OPTIONS = [
  "", "human", "elf", "dwarf", "halfling", "gnome",
  "half-elf", "half-orc", "tiefling", "dragonborn",
  "orc", "goliath"
];

/**
 * Open the actor generation dialog.
 * @param {Function} buildConfig — returns fresh GeneratorConfig
 * @param {Function} openHistoryDialogFn — opens the history dialog
 */
export function openActorDialog(buildConfig, openHistoryDialogFn) {
  const config = buildConfig();

  const creatureTypeOptions = ["", ...CREATURE_TYPES].map(t =>
    `<option value="${t}">${t || "Auto (from prompt)"}</option>`
  ).join("");

  new Dialog({
    title: "Generate AI Actor",
    content: `
      <div class="chatgpt-gen-form">
        <div class="chatgpt-dialog-header">
          <i class="fas fa-users"></i>
          <span>AI Actor Generator</span>
        </div>
        <form>
          <div class="form-group">
            <label>Actor Type</label>
            <select id="ai-actor-type">
              <option value="npc">NPC (Monster / Creature)</option>
              <option value="character">Character (Player Character)</option>
            </select>
          </div>

          <!-- NPC Options -->
          <div id="npc-options">
            <div class="form-group">
              <label>Challenge Rating</label>
              <select id="ai-actor-cr">
                ${CR_OPTIONS.map(cr => `<option value="${cr}" ${cr === "1" ? "selected" : ""}>${cr}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Creature Type</label>
              <select id="ai-creature-type">
                ${creatureTypeOptions}
              </select>
            </div>
          </div>

          <!-- Character Options -->
          <div id="character-options" style="display: none;">
            <div class="form-group">
              <label>Ruleset</label>
              <select id="ai-actor-ruleset">
                <option value="all">Both (2014 + 2024)</option>
                <option value="2024" selected>2024 PHB (XPHB)</option>
                <option value="2014">2014 PHB (Legacy)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Level</label>
              <select id="ai-actor-level">
                ${Array.from({ length: 20 }, (_, i) => `<option value="${i + 1}" ${i + 1 === 5 ? "selected" : ""}>${i + 1}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Class</label>
              <select id="ai-actor-class">
                ${CLASS_OPTIONS.map(c => `<option value="${c}">${c || "Auto (from prompt)"}</option>`).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Subclass</label>
              <select id="ai-actor-subclass">
                <option value="">Auto (from prompt)</option>
              </select>
            </div>
            <div class="form-group">
              <label>Race</label>
              <select id="ai-actor-race">
                ${RACE_OPTIONS.map(r => `<option value="${r}">${r || "Auto (from prompt)"}</option>`).join("")}
              </select>
            </div>
          </div>

          <div class="form-group">
            <label>Name Override</label>
            <input id="ai-actor-name" type="text" placeholder="Leave blank to auto-generate" />
          </div>
          <div class="form-group">
            <label>Template</label>
            <select id="ai-actor-template">
              ${ACTOR_TEMPLATES.map((t, i) => `<option value="${i}">${t.label}</option>`).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Prompt</label>
            <textarea id="ai-actor-prompt" rows="4" placeholder="e.g., A cunning goblin shaman who leads a small cult in the sewers beneath a port city..."></textarea>
          </div>
        </form>
      </div>
    `,
    buttons: {
      generate: {
        icon: '<i class="fas fa-wand-magic-sparkles"></i>',
        label: "Generate",
        callback: async (html) => {
          const root = resolveHtmlRoot(html);
          const actorType = root.querySelector("#ai-actor-type").value;
          const prompt = root.querySelector("#ai-actor-prompt").value;
          const nameOverride = root.querySelector("#ai-actor-name").value;

          if (!prompt) return ui.notifications.error("Prompt is required");

          const options = { nameOverride: nameOverride || null };

          if (actorType === "npc") {
            const crStr = root.querySelector("#ai-actor-cr").value;
            options.cr = crStr.includes("/")
              ? { "1/8": 0.125, "1/4": 0.25, "1/2": 0.5 }[crStr] || 1
              : parseFloat(crStr);
            options.creatureType = root.querySelector("#ai-creature-type").value || null;
          } else {
            options.level = parseInt(root.querySelector("#ai-actor-level").value, 10) || 5;
            options.className = root.querySelector("#ai-actor-class").value || null;
            options.subclass = root.querySelector("#ai-actor-subclass").value || null;
            options.race = root.querySelector("#ai-actor-race").value || null;
            options.ruleset = root.querySelector("#ai-actor-ruleset").value || "all";
          }

          const result = await generateActorData(prompt, config, actorType, options);
          if (result) {
            await openActorPreviewDialog(result, buildConfig);
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
      const { root, dialog } = initDialogRoot(html);
      // Ensure dialog content is scrollable when it exceeds viewport height.
      // Foundry's setPosition() replaces style.cssText after render, so we
      // defer and re-apply whenever content changes (e.g. NPC→Character switch).
      const applyScrollFix = () => {
        if (!dialog) return;
        setTimeout(() => {
          dialog.style.setProperty('height', 'auto', 'important');
          dialog.style.setProperty('max-height', '90vh', 'important');
          const windowContent = dialog.querySelector('.window-content');
          if (windowContent) {
            windowContent.style.setProperty('overflow-y', 'auto', 'important');
            windowContent.style.setProperty('max-height', '75vh', 'important');
          }
        }, 0);
      };

      if (dialog) {
        dialog.style.minWidth = '450px';
        applyScrollFix();
      }

      const actorTypeSelect = root.querySelector("#ai-actor-type");
      const npcOptions = root.querySelector("#npc-options");
      const charOptions = root.querySelector("#character-options");

      const updateVisibility = () => {
        if (actorTypeSelect.value === "npc") {
          npcOptions.style.display = "";
          charOptions.style.display = "none";
        } else {
          npcOptions.style.display = "none";
          charOptions.style.display = "";
        }
        applyScrollFix();
      };

      updateVisibility();
      actorTypeSelect.addEventListener("change", updateVisibility);

      enableSpellcheck(root, "#ai-actor-prompt, #ai-actor-name");

      // Subclass dropdown — updates when class, level, or ruleset changes
      const classSelect = root.querySelector("#ai-actor-class");
      const subclassSelect = root.querySelector("#ai-actor-subclass");
      const levelSelect = root.querySelector("#ai-actor-level");
      const rulesetSelect = root.querySelector("#ai-actor-ruleset");

      const updateSubclassOptions = () => {
        const cls = classSelect.value;
        const ruleset = rulesetSelect.value;
        const level = parseInt(levelSelect.value, 10) || 1;
        const subLevel = cls ? getSubclassLevel(cls) : 3;

        subclassSelect.innerHTML = '<option value="">Auto (from prompt)</option>';
        if (cls && level >= subLevel) {
          const subs = getSubclasses(cls, ruleset, { srdOnly: true });
          for (const sub of subs) {
            subclassSelect.insertAdjacentHTML("beforeend",
              `<option value="${sub}">${sub}</option>`);
          }
        }
      };

      classSelect.addEventListener("change", updateSubclassOptions);
      levelSelect.addEventListener("change", updateSubclassOptions);
      rulesetSelect.addEventListener("change", updateSubclassOptions);

      // Template handling
      const templateSelect = root.querySelector("#ai-actor-template");
      const promptTextarea = root.querySelector("#ai-actor-prompt");

      templateSelect.addEventListener("change", () => {
        const idx = parseInt(templateSelect.value, 10);
        const tpl = ACTOR_TEMPLATES[idx];
        if (!tpl || idx === 0) return;

        promptTextarea.value = tpl.prompt;

        if (tpl.actorType) {
          actorTypeSelect.value = tpl.actorType;
          updateVisibility();
        }

        if (tpl.actorType === "npc") {
          if (tpl.cr != null) {
            const crStr = tpl.cr < 1
              ? { 0.125: "1/8", 0.25: "1/4", 0.5: "1/2" }[tpl.cr] || String(tpl.cr)
              : String(tpl.cr);
            root.querySelector("#ai-actor-cr").value = crStr;
          }
          if (tpl.creatureType) {
            root.querySelector("#ai-creature-type").value = tpl.creatureType;
          }
        } else if (tpl.actorType === "character") {
          if (tpl.level) root.querySelector("#ai-actor-level").value = String(tpl.level);
          if (tpl.className) root.querySelector("#ai-actor-class").value = tpl.className;
          if (tpl.race) root.querySelector("#ai-actor-race").value = tpl.race;
        }
      });
    }
  }, { classes: ["chatgpt-dialog"], resizable: true }).render(true);
}
