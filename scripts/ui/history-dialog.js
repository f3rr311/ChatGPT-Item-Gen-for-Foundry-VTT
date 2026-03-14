/**
 * History dialog — shows session generation history with regen buttons.
 */

import { estimateCost, initDialogRoot, withRegenSpinner } from '../utils/ui-utils.js';
import { generateItemName } from '../generators/name-generator.js';
import { generateItemImage, generateItemJSON, apiEnsureItemName } from '../api/openai.js';
import { parseItemJSON } from '../generators/item-generator.js';

/**
 * @param {Function} buildConfig — returns a fresh GeneratorConfig
 * @param {Function} openGenerateDialog — navigates back to the generate dialog
 */
export function openHistoryDialog(buildConfig, openGenerateDialog) {
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
      const btnStyle = "background:rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.25);border-radius:4px;color:#ddd;cursor:pointer;padding:4px 8px;font-size:0.78rem;margin:2px 0;display:block;width:100%;text-align:left;";
      const regenButtons = isRollTable ? "—" : `
        <button class="regen-btn" style="${btnStyle}" data-action="name" data-idx="${i}" title="Regenerate Name"><i class="fas fa-pen" style="width:14px;"></i> Name</button>
        <button class="regen-btn" style="${btnStyle}" data-action="image" data-idx="${i}" title="Regenerate Image"><i class="fas fa-image" style="width:14px;"></i> Image</button>
        <button class="regen-btn" style="${btnStyle}" data-action="description" data-idx="${i}" title="Regenerate Description"><i class="fas fa-file-alt" style="width:14px;"></i> Desc</button>
      `;
      const cellStyle = "color:#ddd;padding:6px 8px;";
      rows += `<tr style="background:rgba(0,0,0,0.3);border-bottom:1px solid rgba(255,255,255,0.1);">
        <td style="${cellStyle}"><i class="fas ${typeIcon}"></i> ${display}</td>
        <td style="${cellStyle}">${entry.itemType}</td>
        <td style="${cellStyle}">${entry.rarity || "—"}</td>
        <td style="${cellStyle}">${time}</td>
        <td style="${cellStyle}">${regenButtons}</td>
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
      const { root, dialog } = initDialogRoot(html);
      if (dialog) {
        dialog.style.minWidth = '680px';
      }

      // Attach regen button click handlers
      root.querySelectorAll(".regen-btn").forEach(btn => {
        btn.addEventListener("click", async () => {
          const action = btn.dataset.action;
          const idx = parseInt(btn.dataset.idx, 10);
          const entry = history[idx];
          if (!entry) return;

          const item = game.items.get(entry.itemId);
          if (!item) {
            ui.notifications.warn(`Item "${entry.itemName}" no longer exists in this world.`);
            return;
          }

          const config = buildConfig();
          const combined = entry.prompt + (entry.explicitType ? " - " + entry.explicitType : "");

          await withRegenSpinner(btn, async () => {
            if (action === "name") {
              const newName = await generateItemName(combined, config);
              const refined = await apiEnsureItemName(newName, item.system.description.value, config);
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
              const rawJSON = await generateItemJSON(combined, config, entry.explicitType || "") ?? "{}";
              const parsed = await parseItemJSON(rawJSON, config);
              if (parsed.description) {
                await item.update({ "system.description.value": parsed.description });
                ui.notifications.info(`Description updated for "${item.name}"`);
              } else {
                ui.notifications.warn("Description regeneration returned empty.");
              }
            }
          });
        });
      });
    }
  }, { classes: ["chatgpt-dialog"], resizable: true, width: 700 }).render(true);
}
