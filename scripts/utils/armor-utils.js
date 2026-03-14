/**
 * Armor defaults and normalization utilities for dnd5e.
 * Sources: https://www.dndbeyond.com/sources/dnd/basic-rules-2014/equipment
 *          https://www.dndbeyond.com/sources/dnd/br-2024/equipment#Equipment
 * Each entry has PHB-accurate: armorType, ac, dexCap, stealthDisadvantage,
 * strengthRequirement, weight, cost, and baseItem (Foundry identifier).
 * Used as authoritative fallback when GPT doesn't return structured data.
 */

export const ARMOR_DEFAULTS = {
  // --- Light Armor ---
  "padded":          { armorType: "light",  ac: 11, dexCap: null, stealthDisadvantage: true,  strengthRequirement: 0,  weight: 8,  cost: { value: 5, denomination: "gp" },    baseItem: "padded" },
  "leather":         { armorType: "light",  ac: 11, dexCap: null, stealthDisadvantage: false, strengthRequirement: 0,  weight: 10, cost: { value: 10, denomination: "gp" },   baseItem: "leather" },
  "studded leather": { armorType: "light",  ac: 12, dexCap: null, stealthDisadvantage: false, strengthRequirement: 0,  weight: 13, cost: { value: 45, denomination: "gp" },   baseItem: "studdedleather" },

  // --- Medium Armor ---
  "hide":            { armorType: "medium", ac: 12, dexCap: 2,    stealthDisadvantage: false, strengthRequirement: 0,  weight: 12, cost: { value: 10, denomination: "gp" },   baseItem: "hide" },
  "chain shirt":     { armorType: "medium", ac: 13, dexCap: 2,    stealthDisadvantage: false, strengthRequirement: 0,  weight: 20, cost: { value: 50, denomination: "gp" },   baseItem: "chainshirt" },
  "scale mail":      { armorType: "medium", ac: 14, dexCap: 2,    stealthDisadvantage: true,  strengthRequirement: 0,  weight: 45, cost: { value: 50, denomination: "gp" },   baseItem: "scalemail" },
  "breastplate":     { armorType: "medium", ac: 14, dexCap: 2,    stealthDisadvantage: false, strengthRequirement: 0,  weight: 20, cost: { value: 400, denomination: "gp" },  baseItem: "breastplate" },
  "half plate":      { armorType: "medium", ac: 15, dexCap: 2,    stealthDisadvantage: true,  strengthRequirement: 0,  weight: 40, cost: { value: 750, denomination: "gp" },  baseItem: "halfplate" },

  // --- Heavy Armor ---
  "ring mail":       { armorType: "heavy",  ac: 14, dexCap: 0,    stealthDisadvantage: true,  strengthRequirement: 0,  weight: 40, cost: { value: 30, denomination: "gp" },   baseItem: "ringmail" },
  "chain mail":      { armorType: "heavy",  ac: 16, dexCap: 0,    stealthDisadvantage: true,  strengthRequirement: 13, weight: 55, cost: { value: 75, denomination: "gp" },   baseItem: "chainmail" },
  "splint":          { armorType: "heavy",  ac: 17, dexCap: 0,    stealthDisadvantage: true,  strengthRequirement: 15, weight: 60, cost: { value: 200, denomination: "gp" },  baseItem: "splint" },
  "plate":           { armorType: "heavy",  ac: 18, dexCap: 0,    stealthDisadvantage: true,  strengthRequirement: 15, weight: 65, cost: { value: 1500, denomination: "gp" }, baseItem: "plate" },

  // --- Shield ---
  "shield":          { armorType: "shield", ac: 2,  dexCap: null, stealthDisadvantage: false, strengthRequirement: 0,  weight: 6,  cost: { value: 10, denomination: "gp" },   baseItem: "shield" }
};

/**
 * Aliases that map alternate names (e.g. "padded armor") to their canonical key.
 * parseDescriptionForArmor checks these automatically.
 */
const ARMOR_ALIASES = {
  "padded armor": "padded",
  "leather armor": "leather",
  "studded leather armor": "studded leather",
  "hide armor": "hide",
  "scale": "scale mail",
  "half plate armor": "half plate",
  "chainmail": "chain mail",
  "splint armor": "splint",
  "plate armor": "plate"
};

// ARMOR_DEFAULTS exported inline above

/**
 * Scan an item description and/or name for armor type identification.
 * Returns the matching ARMOR_DEFAULTS entry if a known armor type is found.
 * Checks longest names first to match "studded leather" before "leather",
 * "chain mail" before "mail", etc.
 * @param {string} text — item name, description, or combined text
 * @returns {{ armorType: string, ac: number, dexCap: number|null, stealthDisadvantage: boolean, strengthRequirement: number, weight: number, cost: object, baseItem: string }|null}
 */
export function parseDescriptionForArmor(text) {
  if (!text) return null;

  // Strip HTML tags and normalize whitespace
  const clean = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();

  // Build combined lookup: aliases first (longer names), then canonical keys
  // Check longest names first to prevent partial matches
  // (e.g., "studded leather armor" before "studded leather" before "leather")
  const allNames = [...Object.keys(ARMOR_ALIASES), ...Object.keys(ARMOR_DEFAULTS)]
    .sort((a, b) => b.length - a.length);

  for (const name of allNames) {
    if (clean.includes(name)) {
      const canonicalKey = ARMOR_ALIASES[name] || name;
      return { ...ARMOR_DEFAULTS[canonicalKey] };
    }
  }

  return null;
}
