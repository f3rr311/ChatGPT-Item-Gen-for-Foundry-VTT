/**
 * Roll table JSON parsing and Foundry RollTable document creation.
 * Supports both v12 and v13 TableResult schemas.
 */

import { generateRollTableJSON, fixInvalidJSON } from '../api/openai.js';
import { extractValidJSON } from '../utils/json-utils.js';
import { showProgressBar, updateProgressBar, hideProgressBar } from '../utils/ui-utils.js';
import { createUniqueItemDoc } from './item-generator.js';

// ---------- JSON Parsing ----------

export async function parseTableJSON(rawJSON, config) {
  console.log("Raw Roll Table JSON from GPT:", rawJSON);
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
 */
function buildDocumentResult(createdItem, entry, isV13) {
  if (isV13) {
    return {
      type: "document",
      name: createdItem.name,
      range: [entry.minRange ?? 1, entry.maxRange ?? 1],
      weight: entry.weight ?? 1,
      img: createdItem.img || "icons/svg/d20-highlight.svg",
      documentUuid: createdItem.uuid,
      drawn: false
    };
  } else {
    return {
      type: 1,
      text: createdItem.name,
      range: [entry.minRange ?? 1, entry.maxRange ?? 1],
      weight: entry.weight ?? 1,
      img: createdItem.img || "icons/svg/d20-highlight.svg",
      documentCollection: "Item",
      documentId: createdItem.id,
      drawn: false
    };
  }
}

/**
 * Build a text-only TableResult entry (for failed items or generic tables).
 */
function buildTextResult(text, entry, isV13) {
  if (isV13) {
    return {
      type: "text",
      name: text,
      range: [entry.minRange ?? 1, entry.maxRange ?? 1],
      weight: entry.weight ?? 1,
      img: "icons/svg/d20-highlight.svg",
      drawn: false
    };
  } else {
    return {
      type: 0,
      text: text,
      range: [entry.minRange ?? 1, entry.maxRange ?? 1],
      weight: entry.weight ?? 1,
      img: "icons/svg/d20-highlight.svg",
      drawn: false
    };
  }
}

// ---------- Roll Table Creation ----------

export async function createFoundryRollTableFromDialog(tableDesc, explicitType, config, entryCount = 10) {
  showProgressBar();
  updateProgressBar(10);

  let rawTableJSON = await generateRollTableJSON(tableDesc, config, entryCount);
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
    for (let entry of (parsedTable.entries || [])) {
      let textVal = entry.text || "Mysterious Item";
      // Use per-entry itemType from GPT if available, otherwise fall back to global explicitType
      let entryType = entry.itemType || explicitType || "";
      let createdItem = await createUniqueItemDoc(textVal, config, textVal, entryType);
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
  updateProgressBar(100);
  hideProgressBar();
  ui.notifications.info(`New Roll Table created: ${newTable.name}`);
}
