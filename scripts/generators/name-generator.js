/**
 * Item name generation, keyword forcing, and refinement.
 */

import { apiGenerateItemName, apiEnsureItemName } from '../api/openai.js';

const KEYWORDS = ["ring", "amulet", "dagger", "sword", "shield", "gloves", "cloak", "potion"];

/** Non-physical item types that should skip weapon keyword forcing. */
const NON_PHYSICAL_TYPES = ["- Spell", "- Feat", "- Background", "- Container"];

export function forceKeywordInName(name, prompt, desc = "") {
  const promptLC = prompt.toLowerCase();

  // Skip weapon keyword forcing for non-physical item types
  if (NON_PHYSICAL_TYPES.some(tag => promptLC.includes(tag.toLowerCase()))) {
    return name;
  }

  let forcedName = name;
  if (promptLC.includes("class change") && !name.toLowerCase().includes("class change")) {
    forcedName = forcedName + " Class Change";
  }
  for (let keyword of KEYWORDS) {
    if (promptLC.includes(keyword) && !name.toLowerCase().includes(keyword)) {
      forcedName = `${forcedName} ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`;
    }
  }
  if (!promptLC.includes("dragon") && forcedName.toLowerCase().includes("dragon")) {
    forcedName = forcedName.replace(/dragon/gi, "").replace(/\s+/g, " ").trim();
  }
  return forcedName;
}

export async function generateItemName(prompt, config) {
  const name = await apiGenerateItemName(prompt, config);
  return forceKeywordInName(name, prompt, "");
}

/**
 * Thin wrapper around apiEnsureItemName for API boundary consistency.
 * Unlike generateItemName, no keyword forcing is applied here because
 * ensureItemName is a fallback for missing names — the prompt context
 * needed for keyword matching is not available at this stage.
 */
export async function ensureItemName(currentName, description, config) {
  return await apiEnsureItemName(currentName, description, config);
}
