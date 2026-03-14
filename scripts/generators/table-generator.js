/**
 * Roll table JSON parsing and Foundry RollTable document creation.
 * Supports both v12 and v13 TableResult schemas.
 */

import { generateRollTableJSON, fixInvalidJSON } from '../api/openai.js';
import { extractValidJSON } from '../utils/json-utils.js';
import { showProgressBar, updateProgressBar, hideProgressBar } from '../utils/ui-utils.js';
import { createUniqueItemDoc, ensureItemFolder } from './item-generator.js';

/** Default icon path used when no item image is available. */
const DEFAULT_ICON = "icons/svg/d20-highlight.svg";

/** Maximum number of history entries retained per session. */
const MAX_HISTORY_ENTRIES = 50;

// ---------- JSON Parsing ----------

/**
 * Parse raw GPT JSON for a roll table, with multi-stage fallback recovery.
 * @param {string} rawJSON — raw JSON string from GPT
 * @param {GeneratorConfig} config — GeneratorConfig (needed for fixInvalidJSON API call)
 * @returns {Promise<object>} parsed table object with name, formula, entries, etc.
 */
export async function parseTableJSON(rawJSON, config) {
  if (!rawJSON || typeof rawJSON !== "string") {
    return { name: "", formula: "1d20", description: "", tableType: "generic", entries: [] };
  }
  console.debug("Raw Roll Table JSON from GPT:", rawJSON);
  try {
    return JSON.parse(rawJSON);
  } catch (err1) {
    console.warn("Could not parse roll table JSON, second GPT fix:", err1);
    let fixed = await fixInvalidJSON(rawJSON, config);
    try {
      return JSON.parse(fixed);
    } catch (err2) {
      console.warn("Second GPT fix also invalid, attempting extraction:", err2);
      let extracted = extractValidJSON(rawJSON);
      try {
        return JSON.parse(extracted);
      } catch (err3) {
        console.error("All attempts failed => empty table:", err3);
        return { name: "", formula: "1d20", description: "", tableType: "generic", entries: [] };
      }
    }
  }
}

// ---------- TableResult Builders (v12 vs v13) ----------

/**
 * Build a document-linked TableResult entry.
 * v12: uses type=1, text, documentCollection, documentId
 * v13: uses type="document", name, documentUuid
 * @param {object} createdItem — the created Foundry Item document
 * @param {object} entry — parsed GPT entry with minRange, maxRange, weight
 * @param {boolean} isV13 — true for Foundry v13+ schema
 * @returns {object} a TableResult data object ready for createEmbeddedDocuments
 */
function buildDocumentResult(createdItem, entry, isV13) {
  const base = {
    range: [entry.minRange ?? 1, entry.maxRange ?? 1],
    weight: entry.weight ?? 1,
    img: createdItem.img || DEFAULT_ICON,
    drawn: false
  };
  return isV13
    ? { ...base, type: "document", name: createdItem.name, documentUuid: createdItem.uuid }
    : { ...base, type: 1, text: createdItem.name, documentCollection: "Item", documentId: createdItem.id };
}

/**
 * Build a text-only TableResult entry (for failed items or generic tables).
 * @param {string} text — display text for the table result
 * @param {object} entry — parsed GPT entry with minRange, maxRange, weight
 * @param {boolean} isV13 — true for Foundry v13+ schema
 * @returns {object} a TableResult data object ready for createEmbeddedDocuments
 */
function buildTextResult(text, entry, isV13) {
  const base = {
    range: [entry.minRange ?? 1, entry.maxRange ?? 1],
    weight: entry.weight ?? 1,
    img: DEFAULT_ICON,
    drawn: false
  };
  return isV13
    ? { ...base, type: "text", name: text }
    : { ...base, type: 0, text };
}

// ---------- Roll Table Creation ----------

/**
 * Generate a roll table from a description prompt and create the Foundry RollTable document.
 * Creates items for "items" table type, or text entries for "generic" tables.
 * @param {string} tableDesc — user's description of the roll table
 * @param {string} explicitType — forced item type for table entries (e.g. "Weapon")
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, chatModel, isV13Core, etc.
 * @param {number} [entryCount=10] — number of table entries to generate
 * @returns {Promise<void|null>}
 */
export async function createFoundryRollTableFromDialog(tableDesc, explicitType, config, entryCount = 10) {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can generate roll tables.");
    return null;
  }

  showProgressBar();
  updateProgressBar(10);

  let rawTableJSON = await generateRollTableJSON(tableDesc, config, entryCount) ?? "{}";
  updateProgressBar(30);

  let parsedTable = await parseTableJSON(rawTableJSON, config);
  updateProgressBar(50);

  let newTable = await RollTable.create({
    name: parsedTable.name || tableDesc || "GPT Roll Table",
    formula: parsedTable.formula || "1d20",
    description: parsedTable.description || "",
    replacement: true
  });

  let results = [];
  let tableType = (parsedTable.tableType || "generic").toLowerCase();
  ui.notifications.info(`Building table with ${parsedTable.entries?.length || 0} entries, tableType = ${tableType}.`);

  if (tableType === "items") {
    // Create a subfolder under "AI Items" named after the roll table
    let tableFolderId = null;
    try {
      const parentId = await ensureItemFolder("AI Items");
      const tableName = parsedTable.name || tableDesc || "GPT Roll Table";
      tableFolderId = await ensureItemFolder(tableName, parentId);
    } catch (err) {
      console.warn("chatgpt-item-generator: Could not create table folder:", err.message);
    }

    for (let entry of (parsedTable.entries || [])) {
      let textVal = entry.text || "Mysterious Item";
      // Use per-entry itemType from GPT if available, otherwise fall back to global explicitType
      let entryType = entry.itemType || explicitType || "";
      let createdItem = await createUniqueItemDoc(textVal, config, textVal, entryType, tableFolderId);
      if (createdItem && createdItem.name) {
        results.push(buildDocumentResult(createdItem, entry, config.isV13Core));
      } else {
        results.push(buildTextResult(`Failed item: ${textVal}`, entry, config.isV13Core));
      }
    }
  } else {
    for (let entry of (parsedTable.entries || [])) {
      results.push(buildTextResult(entry.text || "No text", entry, config.isV13Core));
    }
  }

  if (!results.length) {
    ui.notifications.warn("GPT returned no entries. Table is empty.");
  }
  await newTable.createEmbeddedDocuments("TableResult", results);

  // Record in generation history
  if (game.chatGPTItemGenerator?.history) {
    const hist = game.chatGPTItemGenerator.history;
    hist.push({
      timestamp: Date.now(),
      prompt: tableDesc,
      itemName: newTable.name,
      itemType: "rolltable",
      itemId: newTable.id,
      imagePath: "",
      rarity: "",
      entryCount: results.length
    });
    if (hist.length > MAX_HISTORY_ENTRIES) hist.shift();
  }

  updateProgressBar(100);
  hideProgressBar();
  ui.notifications.info(`New Roll Table created: ${newTable.name}`);
}
