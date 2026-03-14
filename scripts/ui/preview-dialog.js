/**
 * Item Preview Dialog — shows generated item data before creation.
 * Allows editing name/description, regenerating individual parts, and "Try Again".
 */

import { generateItemName } from '../generators/name-generator.js';
import { generateItemImage, generateItemJSON, apiEnsureItemName } from '../api/openai.js';
import { generateItemData, createItemFromData, parseItemJSON } from '../generators/item-generator.js';
import { showProgressBar, hideProgressBar, resolveHtmlRoot, initDialogRoot, enableSpellcheck } from '../utils/ui-utils.js';

// ---------- Stat Extraction ----------

/**
 * Extract type-specific stats from newItemData for display in the preview.
 * Returns an array of { label, value } pairs.
 */
function extractStats(data) {
  const stats = [];
  const sys = data.system || {};
  const type = data.type;

  // Activities & Effects count (dnd5e v4+)
  const actCount = sys.activities ? Object.keys(sys.activities).length : 0;
  const effCount = data.effects ? data.effects.length : 0;

  if (type === "weapon") {
    const dmg = sys.damage?.base || sys.damage;
    if (dmg) {
      const num = dmg.number || 1;
      const den = dmg.denomination || "?";
      const bonus = dmg.bonus ? `+${dmg.bonus}` : "";
      const types = dmg.types ? dmg.types.join(", ") : (dmg.type || "");
      stats.push({ label: "Damage", value: `${num}d${den}${bonus} ${types}`.trim() });
    }
    if (sys.type?.value) stats.push({ label: "Classification", value: sys.type.value });
    if (sys.type?.baseItem) stats.push({ label: "Base Item", value: sys.type.baseItem });
    if (sys.magicalBonus) stats.push({ label: "Magical Bonus", value: `+${sys.magicalBonus}` });
    if (sys.properties && (Array.isArray(sys.properties) ? sys.properties.length : sys.properties.size)) {
      const props = Array.isArray(sys.properties) ? sys.properties : [...sys.properties];
      stats.push({ label: "Properties", value: props.join(", ") });
    }
  } else if (type === "spell") {
    if (sys.level !== undefined) stats.push({ label: "Level", value: sys.level === 0 ? "Cantrip" : `${sys.level}` });
    if (sys.school) stats.push({ label: "School", value: sys.school });
    if (sys.activation?.type) stats.push({ label: "Casting Time", value: sys.activation.type });
    if (sys.range?.value) stats.push({ label: "Range", value: `${sys.range.value} ${sys.range.units || "ft"}` });
    if (sys.duration?.value) stats.push({ label: "Duration", value: `${sys.duration.value} ${sys.duration.units || ""}`.trim() });
    const comps = [];
    if (sys.components?.vocal) comps.push("V");
    if (sys.components?.somatic) comps.push("S");
    if (sys.components?.material) comps.push("M");
    if (sys.components?.concentration) comps.push("C");
    if (comps.length) stats.push({ label: "Components", value: comps.join(", ") });
  } else if (type === "equipment" && sys.armor?.value) {
    // Armor (stored as equipment type in dnd5e)
    stats.push({ label: "AC", value: `${sys.armor.value}` });
    if (sys.armor.magicalBonus) stats.push({ label: "Magical Bonus", value: `+${sys.armor.magicalBonus}` });
    if (sys.type?.value) stats.push({ label: "Armor Type", value: sys.type.value });
    if (sys.properties?.has?.("stealthDisadvantage") || sys.stealth === true) {
      stats.push({ label: "Stealth", value: "Disadvantage" });
    }
  } else if (type === "consumable") {
    if (sys.type?.value) stats.push({ label: "Subtype", value: sys.type.value });
    if (sys.uses?.max) stats.push({ label: "Uses", value: `${sys.uses.max}` });
  } else if (type === "feat") {
    if (sys.type?.value) stats.push({ label: "Feat Type", value: sys.type.value });
    if (sys.requirements) stats.push({ label: "Requirements", value: sys.requirements });
  }

  // Common stats
  if (sys.rarity) stats.push({ label: "Rarity", value: sys.rarity });
  if (sys.attunement) stats.push({ label: "Attunement", value: "Required" });
  if (actCount > 0) stats.push({ label: "Activities", value: `${actCount}` });
  if (effCount > 0) stats.push({ label: "Effects", value: `${effCount}` });

  return stats;
}

// ---------- HTML Building ----------

function buildPreviewHTML(result) {
  const { newItemData, imagePath, compendiumWarnings, duplicates } = result;
  const stats = extractStats(newItemData);
  const imgSrc = imagePath || "icons/svg/d20-highlight.svg";
  const desc = newItemData.system?.description?.value || "";

  const statsHTML = stats.map(s =>
    `<span class="chatgpt-stat-badge"><strong>${s.label}:</strong> ${s.value}</span>`
  ).join(" ");

  // Build warning banners for compendium validation
  let warningsHTML = "";
  if (duplicates && duplicates.length > 0) {
    const dupeList = duplicates.map(d => `"${d.name}" in ${d.pack}`).join(", ");
    warningsHTML += `<div class="chatgpt-warning-banner"><i class="fas fa-triangle-exclamation"></i> Duplicate found: ${dupeList}</div>`;
  }
  if (compendiumWarnings && compendiumWarnings.length > 0) {
    warningsHTML += compendiumWarnings.map(w =>
      `<div class="chatgpt-warning-banner"><i class="fas fa-circle-info"></i> ${w}</div>`
    ).join("");
  }

  return `
    <div class="chatgpt-gen-form">
      <div class="chatgpt-dialog-header">
        <i class="fas fa-eye"></i>
        <span>Item Preview</span>
      </div>
      <div class="chatgpt-preview-layout">
        <div class="chatgpt-preview-image">
          <img id="preview-img" src="${imgSrc}" alt="Item image">
          <button type="button" class="chatgpt-regen-btn" id="regen-image" title="Regenerate Image">
            <i class="fas fa-rotate"></i> Regen Image
          </button>
        </div>
        <div class="chatgpt-preview-details">
          <div class="chatgpt-preview-field">
            <label>Name</label>
            <input type="text" id="preview-name" class="chatgpt-preview-input" value="">
            <button type="button" class="chatgpt-regen-btn" id="regen-name" title="Regenerate Name">
              <i class="fas fa-rotate"></i> Regen Name
            </button>
          </div>
          <div class="chatgpt-preview-field">
            <label>Type: <strong>${newItemData.type}</strong></label>
          </div>
          <div class="chatgpt-preview-stats">
            ${statsHTML || '<span class="chatgpt-stat-badge">No additional stats</span>'}
          </div>
        </div>
      </div>
      <div class="chatgpt-preview-field" style="margin-top: 10px;">
        <label>Description</label>
        <textarea id="preview-desc" class="chatgpt-preview-input chatgpt-preview-textarea"></textarea>
        <button type="button" class="chatgpt-regen-btn" id="regen-desc" title="Regenerate Description">
          <i class="fas fa-rotate"></i> Regen Description
        </button>
      </div>
      ${warningsHTML}
    </div>
  `;
}

// ---------- Preview Dialog ----------

/**
 * Open the item preview dialog. Returns a Promise that resolves with the
 * created Item document, or null if the user cancels.
 *
 * @param {object} result — the object returned by generateItemData()
 * @returns {Promise<Item|null>}
 */
export function openPreviewDialog(result) {
  return new Promise((resolve) => {
    let currentResult = result;
    let dialogInstance = null;
    let resolved = false;
    let isRerendering = false; // Prevents close handler from resolving during Try Again
    const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    function renderDialog() {
      const content = buildPreviewHTML(currentResult);

      // Close previous dialog instance if re-rendering (Try Again)
      if (dialogInstance) {
        isRerendering = true;
        dialogInstance.close({ force: true });
        isRerendering = false;
      }

      dialogInstance = new Dialog({
        title: "Item Preview",
        content,
        buttons: {
          tryAgain: {
            icon: '<i class="fas fa-rotate"></i>',
            label: "Try Again",
            callback: async () => {
              // Flag to prevent close handler from resolving during re-generation
              isRerendering = true;
              showProgressBar();
              try {
                currentResult = await generateItemData(
                  currentResult.prompt,
                  currentResult.config,
                  null, // don't force the old name
                  currentResult.explicitType
                );
              } catch (err) {
                console.error("Try Again generation failed:", err);
                ui.notifications.error("Generation failed — try again.");
              }
              hideProgressBar();
              isRerendering = false;
              renderDialog();
            }
          },
          confirm: {
            icon: '<i class="fas fa-check"></i>',
            label: "Confirm",
            callback: async (html) => {
              const root = resolveHtmlRoot(html);
              // Apply user edits to the item data
              const editedName = root.querySelector("#preview-name")?.value || currentResult.newItemData.name;
              const editedDesc = root.querySelector("#preview-desc")?.value || "";
              currentResult.newItemData.name = editedName;
              currentResult.refinedName = editedName;
              currentResult.newItemData.system.description.value = editedDesc;

              // Create the item
              const item = await createItemFromData(currentResult);
              ui.notifications.info(`New D&D 5e item created: ${item.name}`);
              safeResolve(item);
            }
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: "Cancel",
            callback: () => safeResolve(null)
          }
        },
        default: "confirm",
        close: () => {
          // If dialog is closed via X button, treat as cancel.
          // Skip during Try Again re-renders (isRerendering flag).
          if (!isRerendering) safeResolve(null);
        },
        render: (html) => {
          const { root, dialog } = initDialogRoot(html);
          if (dialog) {
            dialog.style.maxHeight = 'none';
            dialog.style.minWidth = '600px';
          }

          // ---------- Populate fields & enable native right-click spellcheck ----------
          const nameInput = root.querySelector("#preview-name");
          if (nameInput) nameInput.value = currentResult.newItemData.name;
          const descInput = root.querySelector("#preview-desc");
          if (descInput) descInput.value = currentResult.newItemData.system?.description?.value || "";

          enableSpellcheck(root, "#preview-name, #preview-desc");

          // ---------- Regen button handlers ----------

          const regenName = root.querySelector("#regen-name");
          const regenImage = root.querySelector("#regen-image");
          const regenDesc = root.querySelector("#regen-desc");

          if (regenName) {
            regenName.addEventListener("click", async () => {
              regenName.disabled = true;
              regenName.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              try {
                const combined = currentResult.prompt + (currentResult.explicitType ? " - " + currentResult.explicitType : "");
                const newName = await generateItemName(combined, currentResult.config);
                const desc = currentResult.newItemData.system.description.value;
                const refined = await apiEnsureItemName(newName, desc, currentResult.config);
                root.querySelector("#preview-name").value = refined;
              } catch (err) {
                console.error("Name regeneration failed:", err);
                ui.notifications.error("Name regeneration failed.");
              }
              regenName.disabled = false;
              regenName.innerHTML = '<i class="fas fa-rotate"></i> Regen Name';
            });
          }

          if (regenImage) {
            regenImage.addEventListener("click", async () => {
              regenImage.disabled = true;
              regenImage.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
              try {
                const combined = currentResult.prompt + (currentResult.explicitType ? " - " + currentResult.explicitType : "");
                const newPath = await generateItemImage(combined, currentResult.config);
                if (newPath) {
                  currentResult.imagePath = newPath;
                  currentResult.newItemData.img = newPath;
                  const img = root.querySelector("#preview-img");
                  if (img) img.src = newPath;
                } else {
                  ui.notifications.warn("Image regeneration failed — keeping current image.");
                }
              } catch (err) {
                console.error("Image regeneration failed:", err);
                ui.notifications.error("Image regeneration failed.");
              }
              regenImage.disabled = false;
              regenImage.innerHTML = '<i class="fas fa-rotate"></i> Regen Image';
            });
          }

          if (regenDesc) {
            regenDesc.addEventListener("click", async () => {
              regenDesc.disabled = true;
              regenDesc.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
              try {
                const combined = currentResult.prompt + (currentResult.explicitType ? " - " + currentResult.explicitType : "");
                const rawJSON = await generateItemJSON(combined, currentResult.config, currentResult.explicitType) ?? "{}";
                // Parse the JSON to extract just the description
                const parsed = await parseItemJSON(rawJSON, currentResult.config);
                if (parsed.description) {
                  const textarea = root.querySelector("#preview-desc");
                  if (textarea) textarea.value = parsed.description;
                } else {
                  ui.notifications.warn("Description regeneration returned empty — keeping current.");
                }
              } catch (err) {
                console.error("Description regeneration failed:", err);
                ui.notifications.error("Description regeneration failed.");
              }
              regenDesc.disabled = false;
              regenDesc.innerHTML = '<i class="fas fa-rotate"></i> Regen Description';
            });
          }
        }
      }, { classes: ["chatgpt-dialog"], resizable: true }).render(true);
    }

    renderDialog();
  });
}
