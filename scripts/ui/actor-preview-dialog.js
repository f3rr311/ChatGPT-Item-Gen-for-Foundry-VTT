/**
 * Actor Preview Dialog — shows generated actor data before creation.
 * Displays portrait/token, stats, embedded items, corrections/warnings.
 * Supports regen for name, portrait, token, description, and stats.
 */

import {
  createActorFromData, regenActorName, regenPortrait, regenToken, regenStats,
  generateActorData
} from '../generators/actor-generator.js';
import {
  resolveHtmlRoot, initDialogRoot, enableSpellcheck, withRegenSpinner,
  showProgressBar, hideProgressBar
} from '../utils/ui-utils.js';
import { ABILITY_KEYS, abilityMod } from '../utils/actor-utils.js';

// ─── Stat Display ───

function buildAbilityHTML(abilities) {
  return ABILITY_KEYS.map(key => {
    const score = abilities?.[key] ?? 10;
    const mod = abilityMod(score);
    const sign = mod >= 0 ? "+" : "";
    return `<span class="chatgpt-stat-badge"><strong>${key.toUpperCase()}</strong> ${score} (${sign}${mod})</span>`;
  }).join(" ");
}

function buildNPCStatsHTML(data) {
  const badges = [];
  if (data.cr != null) badges.push(`<span class="chatgpt-stat-badge"><strong>CR</strong> ${data.cr}</span>`);
  if (data.ac != null) badges.push(`<span class="chatgpt-stat-badge"><strong>AC</strong> ${data.ac}${data.acType ? ` (${data.acType})` : ""}</span>`);
  if (data.hp != null) badges.push(`<span class="chatgpt-stat-badge"><strong>HP</strong> ${data.hp}${data.hitDice ? ` (${data.hitDice})` : ""}</span>`);
  if (data.proficiencyBonus) badges.push(`<span class="chatgpt-stat-badge"><strong>Prof</strong> +${data.proficiencyBonus}</span>`);
  if (data.speed?.walk) badges.push(`<span class="chatgpt-stat-badge"><strong>Speed</strong> ${data.speed.walk} ft.</span>`);
  if (data.xp) badges.push(`<span class="chatgpt-stat-badge"><strong>XP</strong> ${data.xp}</span>`);
  return badges.join(" ");
}

function buildCharacterStatsHTML(data) {
  const badges = [];
  if (data.level) badges.push(`<span class="chatgpt-stat-badge"><strong>Level</strong> ${data.level}</span>`);
  if (data.className || data.class) badges.push(`<span class="chatgpt-stat-badge"><strong>Class</strong> ${data.className || data.class}</span>`);
  if (data.subclass) badges.push(`<span class="chatgpt-stat-badge"><strong>Subclass</strong> ${data.subclass}</span>`);
  if (data.race) badges.push(`<span class="chatgpt-stat-badge"><strong>Species</strong> ${data.race}</span>`);
  if (data.background) badges.push(`<span class="chatgpt-stat-badge"><strong>Background</strong> ${data.background}</span>`);
  if (data.hp) badges.push(`<span class="chatgpt-stat-badge"><strong>HP</strong> ${data.hp}</span>`);
  if (data.proficiencyBonus) badges.push(`<span class="chatgpt-stat-badge"><strong>Prof</strong> +${data.proficiencyBonus}</span>`);
  if (data.xp) badges.push(`<span class="chatgpt-stat-badge"><strong>XP</strong> ${data.xp}</span>`);
  return badges.join(" ");
}

function buildEmbeddedItemsHTML(items) {
  if (!items?.length) return "";
  const listItems = items.map(item => {
    const name = item.name || "Unknown";
    const type = item.type || "item";
    const icon = item._fromCompendium ? "fa-book" : "fa-cube";
    return `<li style="color: #ddd;"><i class="fas ${icon}"></i> ${name} <small style="color: #aaa;">(${type})</small></li>`;
  }).join("");
  return `
    <div class="chatgpt-preview-field" style="margin-top: 8px;">
      <label style="color: #ccc;">Embedded Items (${items.length})</label>
      <ul class="chatgpt-embedded-list" style="max-height: 120px; overflow-y: auto; padding-left: 20px; margin: 4px 0; font-size: 12px;">${listItems}</ul>
    </div>
  `;
}

// ─── HTML Building ───

function buildActorPreviewHTML(result) {
  const { validation, actorType, portraitPath, tokenPath, embeddedItems } = result;
  const data = validation.data;
  const corrections = validation.corrections || [];
  const warnings = validation.warnings || [];

  const portraitSrc = portraitPath || "icons/svg/mystery-man.svg";
  const tokenSrc = tokenPath || portraitPath || "icons/svg/mystery-man.svg";
  const desc = data.description || "";

  const statsHTML = actorType === "npc"
    ? buildNPCStatsHTML(data)
    : buildCharacterStatsHTML(data);

  const abilityHTML = buildAbilityHTML(data.abilities);
  const itemsHTML = buildEmbeddedItemsHTML(embeddedItems);

  let bannersHTML = "";
  if (corrections.length) {
    bannersHTML += `<div class="chatgpt-warning-banner" style="background: #2a3a2a; border-left: 3px solid #4a8; padding: 6px 10px; margin: 6px 0; font-size: 12px;">
      <i class="fas fa-wrench"></i> <strong>Auto-corrections (${corrections.length}):</strong><br>${corrections.map(c => `&bull; ${c}`).join("<br>")}
    </div>`;
  }
  if (warnings.length) {
    bannersHTML += `<div class="chatgpt-warning-banner" style="border-left: 3px solid #c84; padding: 6px 10px; margin: 6px 0; font-size: 12px;">
      <i class="fas fa-triangle-exclamation"></i> <strong>Warnings (${warnings.length}):</strong><br>${warnings.map(w => `&bull; ${w}`).join("<br>")}
    </div>`;
  }

  return `
    <div class="chatgpt-gen-form">
      <div class="chatgpt-dialog-header">
        <i class="fas ${actorType === "npc" ? "fa-skull" : "fa-user"}"></i>
        <span>${actorType === "npc" ? "NPC" : "Character"} Preview</span>
      </div>
      <div class="chatgpt-preview-layout" style="display: flex; gap: 12px;">
        <div style="display: flex; flex-direction: column; gap: 8px; align-items: center;">
          <div class="chatgpt-preview-image" style="width: 140px;">
            <img id="preview-portrait" src="${portraitSrc}" alt="Portrait" style="width: 140px; height: 140px; object-fit: cover; border-radius: 8px;">
            <button type="button" class="chatgpt-regen-btn" id="regen-portrait" title="Regenerate Portrait" style="width: 100%; margin-top: 4px;">
              <i class="fas fa-rotate"></i> Portrait
            </button>
          </div>
          <div class="chatgpt-preview-image" style="width: 140px;">
            <img id="preview-token" src="${tokenSrc}" alt="Token" style="width: 100px; height: 100px; object-fit: cover; border-radius: 50%; margin: 0 auto; display: block;">
            <button type="button" class="chatgpt-regen-btn" id="regen-token" title="Regenerate Token" style="width: 100%; margin-top: 4px;">
              <i class="fas fa-rotate"></i> Token
            </button>
          </div>
        </div>
        <div class="chatgpt-preview-details" style="flex: 1;">
          <div class="chatgpt-preview-field">
            <label style="color: #ccc; font-weight: bold;">Name</label>
            <input type="text" id="preview-actor-name" class="chatgpt-preview-input" value="" style="width: 100%; color: #fff; background: rgba(0,0,0,0.5); border: 1px solid rgba(255,255,255,0.3); padding: 6px 8px; font-size: 16px; font-weight: bold; border-radius: 4px; margin-bottom: 4px;">
            <button type="button" class="chatgpt-regen-btn" id="regen-name" title="Regenerate Name" style="width: 100%;">
              <i class="fas fa-rotate"></i> Regen Name
            </button>
          </div>
          <div class="chatgpt-preview-stats" style="margin: 6px 0;">
            ${statsHTML}
          </div>
          <div class="chatgpt-preview-stats" style="margin: 6px 0;">
            ${abilityHTML}
          </div>
          <button type="button" class="chatgpt-regen-btn" id="regen-stats" title="Regenerate Stats" style="margin-top: 4px;">
            <i class="fas fa-rotate"></i> Regen Stats
          </button>
          ${itemsHTML}
        </div>
      </div>
      <div class="chatgpt-preview-field" style="margin-top: 10px;">
        <label>Description / Biography</label>
        <textarea id="preview-actor-desc" class="chatgpt-preview-input chatgpt-preview-textarea" rows="4" style="color: #ddd; background: rgba(0,0,0,0.4); border: 1px solid rgba(255,255,255,0.2);"></textarea>
      </div>
      ${bannersHTML}
    </div>
  `;
}

// ─── Actor Preview Dialog ───

/**
 * Open the actor preview dialog.
 * @param {ActorGenerationResult} result
 * @param {Function} buildConfig
 * @returns {Promise<Actor|null>}
 */
export function openActorPreviewDialog(result, buildConfig) {
  return new Promise((resolve) => {
    let currentResult = result;
    let dialogInstance = null;
    let resolved = false;
    let isRerendering = false;
    const safeResolve = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    function renderDialog() {
      const content = buildActorPreviewHTML(currentResult);

      if (dialogInstance) {
        isRerendering = true;
        dialogInstance.close({ force: true });
        isRerendering = false;
      }

      dialogInstance = new Dialog({
        title: `${currentResult.actorType === "npc" ? "NPC" : "Character"} Preview`,
        content,
        buttons: {
          tryAgain: {
            icon: '<i class="fas fa-rotate"></i>',
            label: "Try Again",
            callback: async () => {
              isRerendering = true;
              const config = buildConfig();
              const newResult = await generateActorData(
                currentResult.prompt,
                config,
                currentResult.actorType,
                currentResult.options
              );
              isRerendering = false;
              if (newResult) {
                currentResult = newResult;
                renderDialog();
              } else {
                ui.notifications.error("Regeneration failed — keeping current.");
                renderDialog();
              }
            }
          },
          confirm: {
            icon: '<i class="fas fa-check"></i>',
            label: "Create Actor",
            callback: async (html) => {
              const root = resolveHtmlRoot(html);

              // Apply user edits
              const editedName = root.querySelector("#preview-actor-name")?.value || currentResult.validation.data.name;
              const editedDescRaw = root.querySelector("#preview-actor-desc")?.value || "";
              // Wrap plain text back in <p> tags for Foundry biography
              const editedDesc = editedDescRaw.includes("<") ? editedDescRaw : `<p>${editedDescRaw.replace(/\n\n/g, "</p><p>").replace(/\n/g, "<br>")}</p>`;

              currentResult.actorData.name = editedName;
              currentResult.actorData.prototypeToken.name = editedName;
              currentResult.actorData.system.details.biography = { value: editedDesc };

              const actor = await createActorFromData(currentResult);
              safeResolve(actor);
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
          if (!isRerendering) safeResolve(null);
        },
        render: (html) => {
          const { root, dialog } = initDialogRoot(html);
          if (dialog) {
            dialog.style.maxHeight = 'none';
            dialog.style.minWidth = '650px';
          }

          const data = currentResult.validation.data;

          // Populate fields
          const nameInput = root.querySelector("#preview-actor-name");
          if (nameInput) nameInput.value = data.name || currentResult.actorData.name;
          const descInput = root.querySelector("#preview-actor-desc");
          if (descInput) {
            // Strip HTML tags for textarea display; preserve the raw HTML for actor creation
            const rawDesc = data.description || "";
            const tmp = document.createElement("div");
            tmp.innerHTML = rawDesc;
            descInput.value = tmp.textContent || tmp.innerText || "";
          }

          enableSpellcheck(root, "#preview-actor-name, #preview-actor-desc");

          // ─── Regen Handlers ───
          const config = buildConfig();

          const regenNameBtn = root.querySelector("#regen-name");
          if (regenNameBtn) {
            regenNameBtn.addEventListener("click", () => withRegenSpinner(regenNameBtn, async () => {
              const newName = await regenActorName(currentResult.prompt, currentResult.actorType, config);
              if (newName) {
                root.querySelector("#preview-actor-name").value = newName;
              }
            }));
          }

          const regenPortraitBtn = root.querySelector("#regen-portrait");
          if (regenPortraitBtn) {
            regenPortraitBtn.addEventListener("click", () => withRegenSpinner(regenPortraitBtn, async () => {
              const desc = buildImageDesc(data, currentResult.actorType);
              const newPath = await regenPortrait(desc, config);
              if (newPath) {
                currentResult.portraitPath = newPath;
                currentResult.actorData.img = newPath;
                root.querySelector("#preview-portrait").src = newPath;
              } else {
                ui.notifications.warn("Portrait regeneration failed.");
              }
            }));
          }

          const regenTokenBtn = root.querySelector("#regen-token");
          if (regenTokenBtn) {
            regenTokenBtn.addEventListener("click", () => withRegenSpinner(regenTokenBtn, async () => {
              const desc = buildImageDesc(data, currentResult.actorType);
              const newPath = await regenToken(desc, config);
              if (newPath) {
                currentResult.tokenPath = newPath;
                currentResult.actorData.prototypeToken.texture.src = newPath;
                root.querySelector("#preview-token").src = newPath;
              } else {
                ui.notifications.warn("Token regeneration failed.");
              }
            }));
          }

          const regenStatsBtn = root.querySelector("#regen-stats");
          if (regenStatsBtn) {
            regenStatsBtn.addEventListener("click", () => withRegenSpinner(regenStatsBtn, async () => {
              const newValidation = await regenStats(
                currentResult.prompt, config,
                currentResult.actorType, currentResult.options
              );
              if (newValidation) {
                currentResult.validation = newValidation;
                // Re-render dialog with new stats
                isRerendering = true;
                dialogInstance.close({ force: true });
                isRerendering = false;
                renderDialog();
              } else {
                ui.notifications.warn("Stats regeneration failed.");
              }
            }));
          }
        }
      }, { classes: ["chatgpt-dialog"], resizable: true }).render(true);
    }

    renderDialog();
  });
}

/**
 * Build image description from actor data for regen.
 */
function buildImageDesc(data, actorType) {
  const parts = [data.name || "A fantasy creature"];
  if (actorType === "npc") {
    if (data.size) parts.push(data.size);
    if (data.creatureType) parts.push(data.creatureType);
    if (data.creatureSubtype) parts.push(`(${data.creatureSubtype})`);
  } else {
    if (data.race) parts.push(data.race);
    if (data.className || data.class) parts.push(data.className || data.class);
    if (data.appearance?.gender) parts.push(data.appearance.gender);
    if (data.appearance?.hair) parts.push(`${data.appearance.hair} hair`);
  }
  return parts.join(", ");
}
