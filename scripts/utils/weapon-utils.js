/**
 * Weapon damage and property transformation utilities for dnd5e.
 * Handles both v3 (pre-4.0) and v4+/v5 data model formats.
 */

/**
 * dnd5e v4+/v5 uses abbreviated property codes stored in a Set.
 * GPT returns full-word property names; this map converts them.
 */
const PROPERTY_ABBREV_MAP = {
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
const WEAPON_DEFAULTS = {
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

/** Export constants for use in item-generator.js */
export { WEAPON_DEFAULTS, PROPERTY_ABBREV_MAP };

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
  // If GPT provided explicit versatile data, use it
  if (gptVersatile) {
    if (gptVersatile.number !== undefined && (gptVersatile.die !== undefined || gptVersatile.denomination !== undefined)) {
      let rawDie = gptVersatile.denomination || gptVersatile.die || "";
      let denom = Number(String(rawDie).replace(/^d/i, "")) || 10;
      let bonus = "";
      if (gptVersatile.bonus !== undefined && gptVersatile.bonus !== null && gptVersatile.bonus !== "" && gptVersatile.bonus !== 0) {
        bonus = String(gptVersatile.bonus);
        if (!bonus.startsWith("+") && !bonus.startsWith("-")) bonus = "+" + bonus;
      }
      return {
        number: Number(gptVersatile.number) || 1,
        denomination: denom,
        bonus: bonus,
        types: [gptVersatile.type || damageType || ""]
      };
    }
    // Try formula string
    let formula = gptVersatile.formula || gptVersatile.dice || "";
    let parsed = parseDamageFormula(formula);
    if (parsed) {
      return {
        number: parsed.number,
        denomination: parsed.denomination,
        bonus: parsed.bonus,
        types: [gptVersatile.type || damageType || ""]
      };
    }
  }

  // Fallback: auto-calculate from base damage
  if (!baseComponents) return null;
  const auto = calculateVersatileDamage(baseComponents);
  if (!auto) return null;
  return {
    number: auto.number,
    denomination: auto.denomination,
    bonus: auto.bonus,
    types: damageType ? [damageType] : []
  };
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
          console.log(`Generic weapon "${generic}" mapped to PHB weapon "${specific}".`);
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

  // First, normalize the input to a formula + type pair
  let formula = "";
  let damageType = "";
  // Track pre-parsed components if GPT provided structured damage
  let preNumber = null;
  let preDenomination = null;
  let preBonus = null;

  if (Array.isArray(damage)) {
    // damage is already parts array like [["1d8", "slashing"]]
    if (damage.length > 0 && Array.isArray(damage[0])) {
      formula = damage[0][0] || "";
      damageType = damage[0][1] || "";
    }
    if (!useV4Format) return { parts: damage };
  } else if (damage.base && damage.base.number !== undefined && damage.base.denomination !== undefined) {
    // Already in correct v4 format with individual fields — pass through
    if (useV4Format) return damage;
    // Convert to v3 formula for parts
    const f = `${damage.base.number}d${damage.base.denomination}${damage.base.bonus || ""}`;
    const t = (damage.base.types && damage.base.types[0]) || "";
    return { parts: f ? [[f, t]] : [] };
  } else if (damage.base && damage.base.formula) {
    // Old wrong v4 format with formula string — convert it
    formula = damage.base.formula || "";
    damageType = (damage.base.types && damage.base.types[0]) || "";
    if (!useV4Format) return { parts: formula ? [[formula, damageType]] : [] };
  } else if (damage.number !== undefined && (damage.denomination !== undefined || damage.die !== undefined)) {
    // GPT returned pre-parsed structured damage: { number: 1, die: "d8", bonus: 2, type: "slashing" }
    preNumber = Number(damage.number) || 1;
    let rawDie = damage.denomination || damage.die || "";
    preDenomination = Number(String(rawDie).replace(/^d/i, "")) || 8;
    let rawBonus = damage.bonus;
    if (rawBonus !== undefined && rawBonus !== null && rawBonus !== "" && rawBonus !== 0) {
      preBonus = String(rawBonus);
      if (!preBonus.startsWith("+") && !preBonus.startsWith("-")) preBonus = "+" + preBonus;
    } else {
      preBonus = "";
    }
    damageType = damage.type || "";
    formula = `${preNumber}d${preDenomination}${preBonus}`;
    if (!useV4Format) return { parts: [[formula, damageType]] };
  } else if (damage.parts !== undefined) {
    if (!Array.isArray(damage.parts)) {
      damage.parts = [damage.parts];
    }
    if (damage.parts.length > 0 && Array.isArray(damage.parts[0])) {
      formula = damage.parts[0][0] || "";
      damageType = damage.parts[0][1] || "";
    }
    if (!useV4Format) return damage;
  } else if (damage.dice || damage.formula) {
    formula = damage.dice || damage.formula || "";
    if (damage.modifier) {
      let mod = damage.modifier.toString();
      if (!mod.startsWith('+') && !mod.startsWith('-')) {
        mod = '+' + mod;
      }
      formula += mod;
    }
    damageType = damage.type || "";
    if (!useV4Format) return { parts: [[formula, damageType]] };
  }

  // Build the v4 format with individual fields
  if (useV4Format) {
    if (!formula && preNumber === null) return {};

    let components;
    if (preNumber !== null) {
      components = { number: preNumber, denomination: preDenomination, bonus: preBonus };
    } else {
      components = parseDamageFormula(formula);
    }

    if (!components) {
      // Fallback: formula didn't match NdN pattern (e.g., flat damage "5")
      return {
        base: {
          number: null,
          denomination: null,
          bonus: formula,
          types: damageType ? [damageType] : []
        }
      };
    }

    return {
      base: {
        number: components.number,
        denomination: components.denomination,
        bonus: components.bonus,
        types: damageType ? [damageType] : []
      }
    };
  }

  return { parts: formula ? [[formula, damageType]] : [] };
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
