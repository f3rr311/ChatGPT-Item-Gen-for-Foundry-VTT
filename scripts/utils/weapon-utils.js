/**
 * Weapon damage and property transformation utilities for dnd5e.
 * Handles both v3 (pre-4.0) and v4+/v5 data model formats.
 */

/**
 * dnd5e v4+/v5 uses abbreviated property codes stored in a Set.
 * GPT returns full-word property names; this map converts them.
 */
export const PROPERTY_ABBREV_MAP = {
  "adamantine": "ada",
  "ammunition": "amm",
  "finesse": "fin",
  "firearm": "fir",
  "focus": "foc",
  "heavy": "hvy",
  "light": "lgt",
  "loading": "lod",
  "magical": "mgc",
  "reach": "rch",
  "reload": "rel",
  "returning": "ret",
  "silvered": "sil",
  "special": "spc",
  "thrown": "thr",
  "two-handed": "two",
  "twohanded": "two",
  "two handed": "two",
  "versatile": "ver"
};

/** Set of valid v4+ abbreviation codes for quick lookup. */
const VALID_ABBREVS = new Set(Object.values(PROPERTY_ABBREV_MAP));

/** Map die size to one step larger for versatile weapons (standard D&D rule). */
const VERSATILE_DIE_MAP = { 4: 6, 6: 8, 8: 10, 10: 12, 12: 12 };

/**
 * Normalize a bonus value into a signed string ("+2", "-1") or "".
 * GPT returns bonuses in various formats: number, string, with/without sign.
 * @param {*} raw — raw bonus value from GPT (number, string, null, undefined)
 * @returns {string} normalized bonus string (e.g. "+2", "-1", "")
 */
function normalizeBonus(raw) {
  if (raw === undefined || raw === null || raw === "" || raw === 0) return "";
  const str = String(raw);
  return (str.startsWith("+") || str.startsWith("-")) ? str : "+" + str;
}

/**
 * Parse a raw die value from GPT into a numeric denomination.
 * Handles both numeric (8) and string ("d8") formats.
 * @param {*} raw — raw die value from GPT
 * @param {number} [fallback=8] — default denomination if parsing fails
 * @returns {number} die denomination
 */
function parseDie(raw, fallback = 8) {
  return Number(String(raw || "").replace(/^d/i, "")) || fallback;
}

/**
 * Comprehensive D&D 5e PHB weapon defaults table.
 * Sources: https://roll20.net/compendium/dnd5e/Weapons
 *          https://roll20.net/compendium/dnd5e/Rules:Weapons?expansion=33335
 * Each entry has: classification, baseItem, damage, weight, cost, range,
 * properties (v4+ abbreviated codes), optional versatile die, and
 * mastery (2024 Modern Rules weapon mastery property).
 * Used as authoritative fallback when GPT doesn't return structured data —
 * the description identifies the weapon type, and these defaults fill in
 * all the correct stats automatically.
 */
export const WEAPON_DEFAULTS = {
  // --- Simple Melee Weapons ---
  //                                                                                                                                                                                                                                                mastery (2024)
  "club":          { classification: "simpleM", baseItem: "club",         damage: { number: 1, denomination: 4, type: "bludgeoning" }, weight: 2,    cost: { value: 1, denomination: "sp" },  properties: ["lgt"],                   range: { value: 5, units: "ft" },              mastery: "slow" },
  "dagger":        { classification: "simpleM", baseItem: "dagger",       damage: { number: 1, denomination: 4, type: "piercing" },    weight: 1,    cost: { value: 2, denomination: "gp" },  properties: ["fin", "lgt", "thr"],     range: { value: 20, long: 60, units: "ft" },   mastery: "nick" },
  "greatclub":     { classification: "simpleM", baseItem: "greatclub",    damage: { number: 1, denomination: 8, type: "bludgeoning" }, weight: 10,   cost: { value: 2, denomination: "sp" },  properties: ["two"],                   range: { value: 5, units: "ft" },              mastery: "push" },
  "handaxe":       { classification: "simpleM", baseItem: "handaxe",      damage: { number: 1, denomination: 6, type: "slashing" },    weight: 2,    cost: { value: 5, denomination: "gp" },  properties: ["lgt", "thr"],            range: { value: 20, long: 60, units: "ft" },   mastery: "vex" },
  "javelin":       { classification: "simpleM", baseItem: "javelin",      damage: { number: 1, denomination: 6, type: "piercing" },    weight: 2,    cost: { value: 5, denomination: "sp" },  properties: ["thr"],                   range: { value: 30, long: 120, units: "ft" },  mastery: "slow" },
  "light hammer":  { classification: "simpleM", baseItem: "lighthammer",  damage: { number: 1, denomination: 4, type: "bludgeoning" }, weight: 2,    cost: { value: 2, denomination: "gp" },  properties: ["lgt", "thr"],            range: { value: 20, long: 60, units: "ft" },   mastery: "nick" },
  "mace":          { classification: "simpleM", baseItem: "mace",         damage: { number: 1, denomination: 6, type: "bludgeoning" }, weight: 4,    cost: { value: 5, denomination: "gp" },  properties: [],                        range: { value: 5, units: "ft" },              mastery: "sap" },
  "quarterstaff":  { classification: "simpleM", baseItem: "quarterstaff", damage: { number: 1, denomination: 6, type: "bludgeoning" }, weight: 4,    cost: { value: 2, denomination: "sp" },  properties: ["ver"], versatileDie: 8,  range: { value: 5, units: "ft" },              mastery: "topple" },
  "sickle":        { classification: "simpleM", baseItem: "sickle",       damage: { number: 1, denomination: 4, type: "slashing" },    weight: 2,    cost: { value: 1, denomination: "gp" },  properties: ["lgt"],                   range: { value: 5, units: "ft" },              mastery: "nick" },
  "spear":         { classification: "simpleM", baseItem: "spear",        damage: { number: 1, denomination: 6, type: "piercing" },    weight: 3,    cost: { value: 1, denomination: "gp" },  properties: ["thr", "ver"], versatileDie: 8, range: { value: 20, long: 60, units: "ft" },   mastery: "sap" },
  // --- Simple Ranged Weapons ---
  "light crossbow":{ classification: "simpleR", baseItem: "lightcrossbow", damage: { number: 1, denomination: 8, type: "piercing" },   weight: 5,    cost: { value: 25, denomination: "gp" }, properties: ["amm", "lod", "two"],     range: { value: 80, long: 320, units: "ft" },  mastery: "slow" },
  "dart":          { classification: "simpleR", baseItem: "dart",           damage: { number: 1, denomination: 4, type: "piercing" },   weight: 0.25, cost: { value: 5, denomination: "cp" },  properties: ["fin", "thr"],            range: { value: 20, long: 60, units: "ft" },   mastery: "vex" },
  "shortbow":      { classification: "simpleR", baseItem: "shortbow",      damage: { number: 1, denomination: 6, type: "piercing" },   weight: 2,    cost: { value: 25, denomination: "gp" }, properties: ["amm", "two"],            range: { value: 80, long: 320, units: "ft" },  mastery: "vex" },
  "sling":         { classification: "simpleR", baseItem: "sling",          damage: { number: 1, denomination: 4, type: "bludgeoning" },weight: 0,    cost: { value: 1, denomination: "sp" },  properties: ["amm"],                   range: { value: 30, long: 120, units: "ft" },  mastery: "slow" },
  // --- Martial Melee Weapons ---
  "battleaxe":     { classification: "martialM", baseItem: "battleaxe",    damage: { number: 1, denomination: 8, type: "slashing" },    weight: 4,    cost: { value: 10, denomination: "gp" }, properties: ["ver"], versatileDie: 10, range: { value: 5, units: "ft" },              mastery: "topple" },
  "flail":         { classification: "martialM", baseItem: "flail",        damage: { number: 1, denomination: 8, type: "bludgeoning" }, weight: 2,    cost: { value: 10, denomination: "gp" }, properties: [],                        range: { value: 5, units: "ft" },              mastery: "sap" },
  "glaive":        { classification: "martialM", baseItem: "glaive",       damage: { number: 1, denomination: 10, type: "slashing" },   weight: 6,    cost: { value: 20, denomination: "gp" }, properties: ["hvy", "rch", "two"],     range: { value: 10, units: "ft" },             mastery: "graze" },
  "greataxe":      { classification: "martialM", baseItem: "greataxe",     damage: { number: 1, denomination: 12, type: "slashing" },   weight: 7,    cost: { value: 30, denomination: "gp" }, properties: ["hvy", "two"],            range: { value: 5, units: "ft" },              mastery: "cleave" },
  "greatsword":    { classification: "martialM", baseItem: "greatsword",   damage: { number: 2, denomination: 6, type: "slashing" },    weight: 6,    cost: { value: 50, denomination: "gp" }, properties: ["hvy", "two"],            range: { value: 5, units: "ft" },              mastery: "graze" },
  "halberd":       { classification: "martialM", baseItem: "halberd",      damage: { number: 1, denomination: 10, type: "slashing" },   weight: 6,    cost: { value: 20, denomination: "gp" }, properties: ["hvy", "rch", "two"],     range: { value: 10, units: "ft" },             mastery: "cleave" },
  "lance":         { classification: "martialM", baseItem: "lance",        damage: { number: 1, denomination: 12, type: "piercing" },   weight: 6,    cost: { value: 10, denomination: "gp" }, properties: ["rch", "spc"],            range: { value: 10, units: "ft" },             mastery: "topple" },
  "longsword":     { classification: "martialM", baseItem: "longsword",    damage: { number: 1, denomination: 8, type: "slashing" },    weight: 3,    cost: { value: 15, denomination: "gp" }, properties: ["ver"], versatileDie: 10, range: { value: 5, units: "ft" },              mastery: "sap" },
  "maul":          { classification: "martialM", baseItem: "maul",         damage: { number: 2, denomination: 6, type: "bludgeoning" }, weight: 10,   cost: { value: 10, denomination: "gp" }, properties: ["hvy", "two"],            range: { value: 5, units: "ft" },              mastery: "topple" },
  "morningstar":   { classification: "martialM", baseItem: "morningstar",  damage: { number: 1, denomination: 8, type: "piercing" },    weight: 4,    cost: { value: 15, denomination: "gp" }, properties: [],                        range: { value: 5, units: "ft" },              mastery: "sap" },
  "pike":          { classification: "martialM", baseItem: "pike",         damage: { number: 1, denomination: 10, type: "piercing" },   weight: 18,   cost: { value: 5, denomination: "gp" },  properties: ["hvy", "rch", "two"],     range: { value: 10, units: "ft" },             mastery: "push" },
  "rapier":        { classification: "martialM", baseItem: "rapier",       damage: { number: 1, denomination: 8, type: "piercing" },    weight: 2,    cost: { value: 25, denomination: "gp" }, properties: ["fin"],                   range: { value: 5, units: "ft" },              mastery: "vex" },
  "scimitar":      { classification: "martialM", baseItem: "scimitar",     damage: { number: 1, denomination: 6, type: "slashing" },    weight: 3,    cost: { value: 25, denomination: "gp" }, properties: ["fin", "lgt"],            range: { value: 5, units: "ft" },              mastery: "nick" },
  "shortsword":    { classification: "martialM", baseItem: "shortsword",   damage: { number: 1, denomination: 6, type: "piercing" },    weight: 2,    cost: { value: 10, denomination: "gp" }, properties: ["fin", "lgt"],            range: { value: 5, units: "ft" },              mastery: "vex" },
  "trident":       { classification: "martialM", baseItem: "trident",      damage: { number: 1, denomination: 6, type: "piercing" },    weight: 4,    cost: { value: 5, denomination: "gp" },  properties: ["thr", "ver"], versatileDie: 8, range: { value: 20, long: 60, units: "ft" },   mastery: "topple" },
  "war pick":      { classification: "martialM", baseItem: "warpick",      damage: { number: 1, denomination: 8, type: "piercing" },    weight: 2,    cost: { value: 5, denomination: "gp" },  properties: [],                        range: { value: 5, units: "ft" },              mastery: "sap" },
  "warhammer":     { classification: "martialM", baseItem: "warhammer",    damage: { number: 1, denomination: 8, type: "bludgeoning" }, weight: 2,    cost: { value: 15, denomination: "gp" }, properties: ["ver"], versatileDie: 10, range: { value: 5, units: "ft" },              mastery: "push" },
  "whip":          { classification: "martialM", baseItem: "whip",         damage: { number: 1, denomination: 4, type: "slashing" },    weight: 3,    cost: { value: 2, denomination: "gp" },  properties: ["fin", "rch"],            range: { value: 10, units: "ft" },             mastery: "slow" },
  // --- Martial Ranged Weapons ---
  "blowgun":       { classification: "martialR", baseItem: "blowgun",       damage: { number: 1, denomination: 1, type: "piercing" },   weight: 1,    cost: { value: 10, denomination: "gp" }, properties: ["amm", "lod"],            range: { value: 25, long: 100, units: "ft" },  mastery: "vex" },
  "hand crossbow": { classification: "martialR", baseItem: "handcrossbow",  damage: { number: 1, denomination: 6, type: "piercing" },   weight: 3,    cost: { value: 75, denomination: "gp" }, properties: ["amm", "lgt", "lod"],     range: { value: 30, long: 120, units: "ft" },  mastery: "vex" },
  "heavy crossbow":{ classification: "martialR", baseItem: "heavycrossbow", damage: { number: 1, denomination: 10, type: "piercing" },  weight: 18,   cost: { value: 50, denomination: "gp" }, properties: ["amm", "hvy", "lod", "two"], range: { value: 100, long: 400, units: "ft" }, mastery: "push" },
  "longbow":       { classification: "martialR", baseItem: "longbow",       damage: { number: 1, denomination: 8, type: "piercing" },   weight: 2,    cost: { value: 50, denomination: "gp" }, properties: ["amm", "hvy", "two"],     range: { value: 150, long: 600, units: "ft" }, mastery: "slow" },
  "net":           { classification: "martialR", baseItem: "net",            damage: null,                                               weight: 3,    cost: { value: 1, denomination: "gp" },  properties: ["spc", "thr"],            range: { value: 5, long: 15, units: "ft" },    mastery: null },
  // --- Firearms (2024 Modern Rules) ---
  "musket":        { classification: "martialR", baseItem: "musket",         damage: { number: 1, denomination: 12, type: "piercing" },  weight: 10,   cost: { value: 500, denomination: "gp" },properties: ["amm", "fir", "lod", "two"], range: { value: 40, long: 120, units: "ft" }, mastery: "slow" },
  "pistol":        { classification: "martialR", baseItem: "pistol",         damage: { number: 1, denomination: 10, type: "piercing" },  weight: 3,    cost: { value: 250, denomination: "gp" },properties: ["amm", "fir", "lod"],         range: { value: 30, long: 90, units: "ft" },  mastery: "vex" }
};


// ---------- Formula Parsing ----------

/**
 * Parse a damage formula string into dnd5e v4+ component fields.
 * @param {string} formula — e.g. "1d8", "2d6+2", "1d10-1"
 * @returns {{ number: number, denomination: number, bonus: string } | null}
 */
export function parseDamageFormula(formula) {
  if (!formula || typeof formula !== "string") return null;
  const match = formula.trim().match(/^(\d+)d(\d+)\s*([+-]\s*\d+)?$/i);
  if (!match) return null;
  const dieCount = parseInt(match[1], 10);
  const dieSize = parseInt(match[2], 10);
  let bonus = "";
  if (match[3]) {
    bonus = match[3].replace(/\s+/g, ""); // normalize "+ 2" to "+2"
  }
  return { number: dieCount, denomination: dieSize, bonus };
}

// ---------- Versatile Damage ----------

/**
 * Calculate versatile damage from base damage components.
 * Standard D&D rule: versatile die is one size larger.
 */
export function calculateVersatileDamage(baseComponents) {
  if (!baseComponents) return null;
  const biggerDie = VERSATILE_DIE_MAP[baseComponents.denomination] || baseComponents.denomination;
  return {
    number: baseComponents.number,
    denomination: biggerDie,
    bonus: baseComponents.bonus || ""
  };
}

/**
 * Build the v4+ versatile damage object.
 * Uses GPT's explicit versatile data if provided, otherwise auto-calculates.
 * @param {object|null} gptVersatile — GPT's explicit versatile damage
 * @param {{ number: number, denomination: number, bonus: string }} baseComponents — parsed base damage
 * @param {string} damageType — the base damage type
 * @returns {{ number: number, denomination: number, bonus: string, types: string[] } | null}
 */
export function buildVersatileDamage(gptVersatile, baseComponents, damageType) {
  const types = [gptVersatile?.type || damageType || ""];

  // GPT provided structured damage fields (number + die/denomination)
  if (gptVersatile?.number !== undefined && (gptVersatile.die !== undefined || gptVersatile.denomination !== undefined)) {
    return {
      number: Number(gptVersatile.number) || 1,
      denomination: parseDie(gptVersatile.denomination || gptVersatile.die, 10),
      bonus: normalizeBonus(gptVersatile.bonus),
      types
    };
  }

  // GPT provided a formula string (e.g. "1d10+2")
  if (gptVersatile) {
    const parsed = parseDamageFormula(gptVersatile.formula || gptVersatile.dice || "");
    if (parsed) {
      return { number: parsed.number, denomination: parsed.denomination, bonus: parsed.bonus, types };
    }
  }

  // Fallback: auto-calculate from base damage (standard D&D: one die size larger)
  const auto = calculateVersatileDamage(baseComponents);
  if (!auto) return null;
  return { number: auto.number, denomination: auto.denomination, bonus: auto.bonus, types: damageType ? [damageType] : [] };
}

// ---------- Description Parsing ----------

/**
 * Scan an item description for magical bonuses, damage info, and weapon hints.
 * Used as a fallback when GPT's structured JSON fields are missing.
 * @param {string} description — HTML or plain-text item description
 * @returns {{ magicalBonus: number|null, damage: { formula: string, type: string }|null, extraDamage: Array<{ formula: string, type: string }>, weaponHint: { classification: string, baseItem: string }|null }}
 */
export function parseDescriptionBonuses(description) {
  if (!description) return { magicalBonus: null, damage: null, extraDamage: [], weaponHint: null };

  // Strip HTML tags for matching
  const text = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const textLC = text.toLowerCase();

  // --- Magical Bonus ---
  let magicalBonus = null;
  const bonusPatterns = [
    /\+(\d)\s*(?:weapon|bonus|to attack|to hit|to damage)/i,
    /grants?\s*a?\s*\+(\d)\s*bonus/i,
    /\+(\d)\s+(?:longsword|shortsword|greatsword|battleaxe|warhammer|dagger|mace|rapier|scimitar|maul|halberd|glaive|pike|lance|flail|morningstar|handaxe|javelin|trident|war pick|longbow|shortbow|quarterstaff|spear|whip)/i
  ];
  for (const pattern of bonusPatterns) {
    const match = text.match(pattern);
    if (match) {
      const val = parseInt(match[1], 10);
      if (val >= 1 && val <= 3) {
        magicalBonus = val;
        break;
      }
    }
  }

  // --- Primary Damage ---
  // Look for patterns like "deals 1d8 slashing damage", "1d8+2 fire damage"
  let damage = null;
  const DAMAGE_TYPES = ["slashing", "piercing", "bludgeoning", "fire", "cold", "lightning", "thunder", "poison", "acid", "necrotic", "radiant", "force", "psychic"];
  const dmgPattern = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+damage/gi;
  let dmgMatch;
  while ((dmgMatch = dmgPattern.exec(text)) !== null) {
    const formula = dmgMatch[1].replace(/\s+/g, "");
    const type = dmgMatch[2].toLowerCase();
    if (DAMAGE_TYPES.includes(type)) {
      if (!damage) {
        damage = { formula, type };
      }
      break; // Take the first match as primary damage
    }
  }

  // --- Extra Damage (additional/bonus damage beyond primary) ---
  const extraDamage = [];
  const extraDmgPattern = /(?:additional|extra|bonus|plus)\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+damage/gi;
  let extraMatch;
  while ((extraMatch = extraDmgPattern.exec(text)) !== null) {
    const formula = extraMatch[1].replace(/\s+/g, "");
    const type = extraMatch[2].toLowerCase();
    if (DAMAGE_TYPES.includes(type)) {
      extraDamage.push({ formula, type });
    }
  }

  // --- Weapon Hint (identify base weapon from description using WEAPON_DEFAULTS) ---
  let weaponHint = null;
  // Check longest names first to match "hand crossbow" before "crossbow"
  const sortedWeapons = Object.keys(WEAPON_DEFAULTS).sort((a, b) => b.length - a.length);
  for (const weaponName of sortedWeapons) {
    if (textLC.includes(weaponName)) {
      const def = WEAPON_DEFAULTS[weaponName];
      weaponHint = {
        classification: def.classification,
        baseItem: def.baseItem,
        damage: def.damage,
        properties: def.properties,
        versatileDie: def.versatileDie || null,
        mastery: def.mastery || null,
        weight: def.weight,
        cost: def.cost,
        range: def.range
      };
      break;
    }
  }

  // --- Generic weapon name fallback ---
  // When a generic weapon word (e.g., "sword") is found but no specific PHB weapon
  // was matched, map to the most common D&D weapon of that type. This prevents
  // items like "Pink Flame Sword" from having empty baseItem/wrong properties.
  if (!weaponHint) {
    const GENERIC_WEAPON_MAP = {
      "sword":    "longsword",
      "blade":    "longsword",
      "cutlass":  "scimitar",
      "sabre":    "scimitar",
      "katana":   "longsword",
      "axe":      "battleaxe",
      "bow":      "shortbow",
      "crossbow": "light crossbow",
      "hammer":   "warhammer",
      "staff":    "quarterstaff"
    };
    for (const [generic, specific] of Object.entries(GENERIC_WEAPON_MAP)) {
      if (textLC.includes(generic)) {
        const def = WEAPON_DEFAULTS[specific];
        if (def) {
          weaponHint = {
            classification: def.classification,
            baseItem: def.baseItem,
            damage: def.damage,
            properties: def.properties,
            versatileDie: def.versatileDie || null,
            mastery: def.mastery || null,
            weight: def.weight,
            cost: def.cost,
            range: def.range
          };
          console.debug(`Generic weapon "${generic}" mapped to PHB weapon "${specific}".`);
          break;
        }
      }
    }
  }

  return { magicalBonus, damage, extraDamage, weaponHint };
}

// ---------- Damage Transformation ----------

/**
 * Transform weapon damage from GPT output into the format expected by dnd5e.
 * @param {*} damage — raw damage data from GPT (various shapes)
 * @param {boolean} useV4Format — if true, return v4+ format { base: { number, denomination, bonus, types } }
 * @returns {object} — damage object in the expected format
 */
export function transformWeaponDamage(damage, useV4Format = false) {
  if (!damage) return useV4Format ? {} : { parts: [] };

  // Step 1: Normalize any GPT damage shape into { formula, damageType, components }
  const normalized = normalizeDamageInput(damage);

  // Step 2: Format for the target dnd5e version
  if (!useV4Format) {
    // v3 format: { parts: [["1d8", "slashing"]] }
    if (normalized.passthrough) return normalized.passthrough;
    return { parts: normalized.formula ? [[normalized.formula, normalized.damageType]] : [] };
  }

  // v4 format: { base: { number, denomination, bonus, types } }
  const components = normalized.components || parseDamageFormula(normalized.formula);
  if (!components) {
    if (!normalized.formula) return {};
    // Flat damage fallback (e.g., "5")
    return { base: { number: null, denomination: null, bonus: normalized.formula, types: normalized.damageType ? [normalized.damageType] : [] } };
  }
  return { base: { number: components.number, denomination: components.denomination, bonus: components.bonus, types: normalized.damageType ? [normalized.damageType] : [] } };
}

/**
 * Normalize GPT damage output (7 possible shapes) into a consistent internal form.
 * @param {*} damage — raw damage data from GPT
 * @returns {{ formula: string, damageType: string, components: object|null, passthrough: object|null }}
 * @private
 */
function normalizeDamageInput(damage) {
  // Shape 1: Array — [["1d8", "slashing"]]
  if (Array.isArray(damage)) {
    const first = Array.isArray(damage[0]) ? damage[0] : [];
    return { formula: first[0] || "", damageType: first[1] || "", components: null, passthrough: { parts: damage } };
  }

  // Shape 2: Already-correct v4 — { base: { number, denomination } }
  if (damage.base?.number !== undefined && damage.base?.denomination !== undefined) {
    const f = `${damage.base.number}d${damage.base.denomination}${damage.base.bonus || ""}`;
    const t = damage.base.types?.[0] || "";
    return { formula: f, damageType: t, components: damage.base, passthrough: damage };
  }

  // Shape 3: Wrong v4 — { base: { formula } }
  if (damage.base?.formula) {
    return { formula: damage.base.formula, damageType: damage.base.types?.[0] || "", components: null, passthrough: null };
  }

  // Shape 4: Structured — { number, die/denomination, bonus, type }
  if (damage.number !== undefined && (damage.denomination !== undefined || damage.die !== undefined)) {
    const n = Number(damage.number) || 1;
    const d = parseDie(damage.denomination || damage.die);
    const b = normalizeBonus(damage.bonus);
    return { formula: `${n}d${d}${b}`, damageType: damage.type || "", components: { number: n, denomination: d, bonus: b }, passthrough: null };
  }

  // Shape 5: Parts object — { parts: [...] }
  if (damage.parts !== undefined) {
    const parts = Array.isArray(damage.parts) ? damage.parts : [damage.parts];
    const first = Array.isArray(parts[0]) ? parts[0] : [];
    return { formula: first[0] || "", damageType: first[1] || "", components: null, passthrough: { parts } };
  }

  // Shape 6: Formula/dice string — { dice/formula, modifier, type }
  if (damage.dice || damage.formula) {
    let formula = damage.dice || damage.formula || "";
    if (damage.modifier) formula += normalizeBonus(damage.modifier);
    return { formula, damageType: damage.type || "", components: null, passthrough: null };
  }

  // Shape 7: Unknown — no recognized fields
  return { formula: "", damageType: "", components: null, passthrough: null };
}

// ---------- Property Transformation ----------

/**
 * Transform weapon properties from GPT output into the format expected by dnd5e.
 * @param {*} wp — raw weapon properties from GPT (array, object, or string)
 * @param {boolean} useAbbreviations — if true (v4+), map full words to abbreviated codes
 * @returns {string[]} — array of property identifiers
 */
export function transformWeaponProperties(wp, useAbbreviations = false) {
  let properties = [];
  if (!wp) return properties;

  if (Array.isArray(wp)) {
    properties = wp.map(prop => prop.toString().toLowerCase().trim());
  } else if (typeof wp === 'object') {
    for (let key in wp) {
      if (wp.hasOwnProperty(key) && wp[key]) {
        properties.push(key.toString().toLowerCase().trim());
      }
    }
  } else {
    properties.push(wp.toString().toLowerCase().trim());
  }

  if (useAbbreviations) {
    properties = properties.map(prop => {
      // If it's already a valid abbreviation, pass through
      if (VALID_ABBREVS.has(prop)) return prop;
      return PROPERTY_ABBREV_MAP[prop] || prop;
    }).filter(prop => {
      // Only keep recognized abbreviations for v4+
      if (VALID_ABBREVS.has(prop)) return true;
      console.warn(`Unknown weapon property "${prop}" — skipping.`);
      return false;
    });
  }

  return properties;
}
