/**
 * Spell normalization and parsing utilities for dnd5e.
 * Handles GPT output → Foundry VTT spell data model conversion.
 * Mirrors the weapon-utils.js pattern.
 */

import { parseDamageFormula } from './weapon-utils.js';

// ---------- Constants ----------

/** Map full spell school names to dnd5e abbreviation codes. */
const SPELL_SCHOOL_MAP = {
  "abjuration": "abj",
  "conjuration": "con",
  "divination": "div",
  "enchantment": "enc",
  "evocation": "evo",
  "illusion": "ill",
  "necromancy": "nec",
  "transmutation": "trs"
};

/** Map casting time strings GPT might return → Foundry activation type codes. */
const ACTIVATION_TYPE_MAP = {
  "action": "action",
  "1 action": "action",
  "one action": "action",
  "bonus action": "bonus",
  "bonus": "bonus",
  "1 bonus action": "bonus",
  "reaction": "reaction",
  "1 reaction": "reaction",
  "minute": "minute",
  "1 minute": "minute",
  "10 minutes": "minute",
  "hour": "hour",
  "1 hour": "hour",
  "8 hours": "hour",
  "12 hours": "hour",
  "24 hours": "hour",
  "special": "special"
};

/** Map duration unit strings → Foundry duration unit codes. */
const DURATION_UNITS_MAP = {
  "instantaneous": "inst",
  "instant": "inst",
  "round": "round",
  "rounds": "round",
  "minute": "minute",
  "minutes": "minute",
  "hour": "hour",
  "hours": "hour",
  "day": "day",
  "days": "day",
  "month": "month",
  "months": "month",
  "year": "year",
  "years": "year",
  "permanent": "perm",
  "until dispelled": "perm",
  "special": "spec"
};

/** Map range unit strings → Foundry range unit codes. */
const RANGE_UNITS_MAP = {
  "self": "self",
  "touch": "touch",
  "feet": "ft",
  "ft": "ft",
  "foot": "ft",
  "mile": "mi",
  "miles": "mi",
  "special": "spec",
  "sight": "spec",
  "unlimited": "any",
  "any": "any"
};

/** Map target shape/type strings → Foundry target type codes. */
const TARGET_TYPE_MAP = {
  "creature": "creature",
  "creatures": "creature",
  "object": "object",
  "objects": "object",
  "point": "point",
  "cone": "cone",
  "cube": "cube",
  "cylinder": "cylinder",
  "line": "line",
  "sphere": "sphere",
  "radius": "radius",
  "wall": "wall",
  "self": "self",
  "space": "space",
  "ally": "ally",
  "enemy": "enemy"
};

/** Map spell effect type strings → Foundry action type codes. */
export const SPELL_ACTION_TYPE_MAP = {
  "melee spell attack": "msak",
  "ranged spell attack": "rsak",
  "spell attack": "rsak",
  "saving throw": "save",
  "save": "save",
  "healing": "heal",
  "heal": "heal",
  "utility": "util",
  "util": "util",
  "other": "other"
};

/** Map ability score full names → Foundry abbreviation codes. */
export const ABILITY_MAP = {
  "strength": "str",
  "dexterity": "dex",
  "constitution": "con",
  "intelligence": "int",
  "wisdom": "wis",
  "charisma": "cha",
  "str": "str",
  "dex": "dex",
  "con": "con",
  "int": "int",
  "wis": "wis",
  "cha": "cha"
};

// ---------- Normalization Functions ----------

/**
 * Normalize a spell school name to the dnd5e abbreviation code.
 * @param {string} school — e.g. "evocation", "Necromancy", "evo"
 * @returns {string} — e.g. "evo", "nec"
 */
export function normalizeSchool(school) {
  if (!school) return "evo";
  const s = school.toLowerCase().trim();
  // Already an abbreviation?
  if (Object.values(SPELL_SCHOOL_MAP).includes(s)) return s;
  return SPELL_SCHOOL_MAP[s] || "evo";
}

/**
 * Normalize GPT's casting time into Foundry activation format.
 * @param {object|string} activation — e.g. { type: "1 action", cost: 1 } or "bonus action"
 * @returns {{ type: string, cost: number }}
 */
export function normalizeActivation(activation) {
  if (!activation) return { type: "action", cost: 1 };

  if (typeof activation === "string") {
    const key = activation.toLowerCase().trim();
    return { type: ACTIVATION_TYPE_MAP[key] || "action", cost: 1 };
  }

  if (typeof activation === "object") {
    const typeStr = (activation.type || "action").toString().toLowerCase().trim();
    let cost = Number(activation.cost) || 1;

    // Handle "10 minutes" → type "minute", cost 10
    const minuteMatch = typeStr.match(/^(\d+)\s*minutes?$/i);
    if (minuteMatch) {
      return { type: "minute", cost: parseInt(minuteMatch[1], 10) };
    }
    const hourMatch = typeStr.match(/^(\d+)\s*hours?$/i);
    if (hourMatch) {
      return { type: "hour", cost: parseInt(hourMatch[1], 10) };
    }

    return { type: ACTIVATION_TYPE_MAP[typeStr] || "action", cost };
  }

  return { type: "action", cost: 1 };
}

/**
 * Normalize GPT's duration into Foundry duration format.
 * @param {object|string} duration — e.g. { value: 1, unit: "minute" } or "Instantaneous"
 * @returns {{ value: number|null, units: string }}
 */
export function normalizeDuration(duration) {
  if (!duration) return { value: null, units: "inst" };

  if (typeof duration === "string") {
    const s = duration.toLowerCase().trim();
    if (s === "instantaneous" || s === "instant") return { value: null, units: "inst" };
    if (s === "permanent" || s === "until dispelled") return { value: null, units: "perm" };

    // Try to parse "1 minute", "8 hours", etc.
    const match = s.match(/^(\d+)\s+(\w+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      const unit = DURATION_UNITS_MAP[match[2]] || match[2];
      return { value: val, units: unit };
    }

    return { value: null, units: DURATION_UNITS_MAP[s] || "inst" };
  }

  if (typeof duration === "object") {
    const unitStr = (duration.unit || duration.units || "instantaneous").toString().toLowerCase().trim();
    const val = duration.value !== undefined ? duration.value : null;

    if (unitStr === "instantaneous" || unitStr === "instant") return { value: null, units: "inst" };

    return {
      value: val !== null ? Number(val) || null : null,
      units: DURATION_UNITS_MAP[unitStr] || unitStr
    };
  }

  return { value: null, units: "inst" };
}

/**
 * Normalize GPT's range into Foundry range format.
 * Handles special cases like "Self (30-foot cone)".
 * @param {object|string} range — e.g. { value: 120, unit: "feet" } or "Self"
 * @returns {{ value: number|null, units: string, long?: number }}
 */
export function normalizeRange(range) {
  if (!range) return { value: null, units: "self" };

  if (typeof range === "string") {
    const s = range.toLowerCase().trim();
    if (s === "self" || s.startsWith("self")) return { value: null, units: "self" };
    if (s === "touch") return { value: null, units: "touch" };

    // Try to parse "120 feet", "1 mile"
    const match = s.match(/^(\d+)\s+(\w+)$/);
    if (match) {
      return {
        value: parseInt(match[1], 10),
        units: RANGE_UNITS_MAP[match[2]] || "ft"
      };
    }

    return { value: null, units: RANGE_UNITS_MAP[s] || "ft" };
  }

  if (typeof range === "object") {
    const unitStr = (range.unit || range.units || "feet").toString().toLowerCase().trim();
    const val = range.value;

    if (unitStr === "self" || unitStr === "touch") {
      return { value: null, units: unitStr };
    }

    const result = {
      value: val !== null && val !== undefined ? Number(val) || null : null,
      units: RANGE_UNITS_MAP[unitStr] || "ft"
    };

    // Include long range if provided
    if (range.long) result.long = Number(range.long);

    return result;
  }

  return { value: null, units: "self" };
}

/**
 * Normalize GPT's target/area-of-effect into Foundry target format.
 * @param {object|string} target — e.g. { value: 20, type: "sphere" } or "1 creature"
 * @returns {{ value: number|null, type: string, units: string }}
 */
export function normalizeTarget(target) {
  if (!target) return null;

  if (typeof target === "string") {
    const s = target.toLowerCase().trim();
    // Try "1 creature", "20-foot sphere"
    const match = s.match(/^(\d+)[\s-]*(?:foot|ft)?[\s-]*(\w+)$/);
    if (match) {
      const val = parseInt(match[1], 10);
      const type = TARGET_TYPE_MAP[match[2]] || match[2];
      return { value: val, type, units: "ft" };
    }
    const type = TARGET_TYPE_MAP[s] || "creature";
    return { value: 1, type, units: "" };
  }

  if (typeof target === "object") {
    const type = TARGET_TYPE_MAP[(target.type || "creature").toString().toLowerCase().trim()] || "creature";
    const val = target.value !== undefined ? Number(target.value) || null : null;
    // GPT may use "size" or "radius" for area targets
    const size = target.size || target.radius || val;
    const units = (target.units || target.unit || "ft").toString().toLowerCase().trim();

    return {
      value: size !== null && size !== undefined ? Number(size) : val,
      type,
      units: RANGE_UNITS_MAP[units] || units || "ft"
    };
  }

  return null;
}

/**
 * Normalize GPT's spell components into Foundry component format.
 * Note: D&D uses "Verbal" but Foundry uses "vocal".
 * @param {object} components — GPT's component data
 * @returns {{ vocal: boolean, somatic: boolean, material: boolean, concentration: boolean, ritual: boolean }}
 */
export function normalizeComponents(components) {
  if (!components) return { vocal: false, somatic: false, material: false, concentration: false, ritual: false };

  return {
    vocal: Boolean(components.verbal ?? components.vocal ?? false),
    somatic: Boolean(components.somatic ?? false),
    material: Boolean(components.material ?? false),
    concentration: Boolean(components.concentration ?? false),
    ritual: Boolean(components.ritual ?? false)
  };
}

/**
 * Extract material component details from GPT's parsed data.
 * @param {object} parsed — GPT's parsed JSON
 * @returns {{ value: string, consumed: boolean, cost: number }}
 */
export function normalizeMaterials(parsed) {
  return {
    value: parsed.materialDescription || parsed.materials || "",
    consumed: Boolean(parsed.materialConsumed ?? false),
    cost: Number(parsed.materialCost ?? 0)
  };
}

/**
 * Transform spell damage from GPT output into dnd5e format.
 * Reuses parseDamageFormula from weapon-utils.
 * @param {object|string} damage — GPT's damage data (formula string or object)
 * @param {boolean} useV4Format — if true, return v4+ format
 * @returns {object} — damage in the correct dnd5e format
 */
export function transformSpellDamage(damage, useV4Format = false) {
  if (!damage) return useV4Format ? {} : { parts: [] };

  let formula = "";
  let damageType = "";

  if (typeof damage === "string") {
    // Plain formula string like "8d6"
    formula = damage.trim();
  } else if (typeof damage === "object") {
    formula = damage.formula || damage.dice || "";
    damageType = damage.type || "";

    // GPT may return structured { number, die, type }
    if (damage.number !== undefined && (damage.die !== undefined || damage.denomination !== undefined)) {
      let rawDie = damage.denomination || damage.die || "";
      let denom = Number(String(rawDie).replace(/^d/i, "")) || 6;
      let num = Number(damage.number) || 1;
      let bonus = "";
      if (damage.bonus !== undefined && damage.bonus !== null && damage.bonus !== "" && damage.bonus !== 0) {
        bonus = String(damage.bonus);
        if (!bonus.startsWith("+") && !bonus.startsWith("-")) bonus = "+" + bonus;
      }
      formula = `${num}d${denom}${bonus}`;
      damageType = damage.type || "";

      if (useV4Format) {
        return {
          base: {
            number: num,
            denomination: denom,
            bonus: bonus,
            types: damageType ? [damageType] : []
          }
        };
      }
    }
  }

  if (!formula) return useV4Format ? {} : { parts: [] };

  if (!useV4Format) {
    return { parts: [[formula, damageType]] };
  }

  // Parse formula into v4+ components
  const components = parseDamageFormula(formula);
  if (!components) {
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

/**
 * Build spell scaling data for cantrips and upcast spells.
 * @param {object|null} scaling — GPT's scaling info
 * @param {number} level — spell level (0 = cantrip)
 * @returns {{ mode: string, formula: string }}
 */
export function buildSpellScaling(scaling, level) {
  if (!scaling) {
    return { mode: level === 0 ? "cantrip" : "none", formula: "" };
  }

  let mode = (scaling.mode || "").toLowerCase().trim();
  let formula = scaling.formula || "";

  // Normalize mode
  if (mode === "cantrip" || level === 0) {
    mode = "cantrip";
  } else if (mode === "level" || mode === "slot" || mode === "upcast") {
    mode = "level";
  } else if (!mode || mode === "none") {
    mode = "none";
  }

  return { mode, formula };
}

// ---------- Description Parsing ----------

/** Damage type keywords for spell description scanning. */
const SPELL_DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force", "lightning",
  "necrotic", "piercing", "poison", "psychic", "radiant",
  "slashing", "thunder"
];

/**
 * Scan a spell description for structured spell data as fallback.
 * Similar to parseDescriptionBonuses() in weapon-utils, but for spells.
 * @param {string} description — HTML or plain-text spell description
 * @returns {object} — extracted hints for spell fields
 */
export function parseSpellDescription(description) {
  const result = {
    level: null,
    school: null,
    damage: null,
    saveAbility: null,
    actionType: null,
    concentration: null,
    castingTime: null,
    duration: null,
    range: null,
    target: null
  };

  if (!description) return result;

  // Strip HTML tags for matching
  const text = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const textLC = text.toLowerCase();

  // --- Spell Level ---
  const levelMatch = textLC.match(/(\d+)(?:st|nd|rd|th)[- ]level/);
  if (levelMatch) {
    result.level = parseInt(levelMatch[1], 10);
  } else if (textLC.includes("cantrip")) {
    result.level = 0;
  }

  // --- School ---
  for (const [schoolName, abbr] of Object.entries(SPELL_SCHOOL_MAP)) {
    if (textLC.includes(schoolName)) {
      result.school = schoolName;
      break;
    }
  }

  // --- Damage ---
  const dmgPattern = /(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+damage/gi;
  let dmgMatch;
  while ((dmgMatch = dmgPattern.exec(text)) !== null) {
    const formula = dmgMatch[1].replace(/\s+/g, "");
    const type = dmgMatch[2].toLowerCase();
    if (SPELL_DAMAGE_TYPES.includes(type)) {
      if (!result.damage) {
        result.damage = { formula, type };
      }
      break;
    }
  }

  // --- Healing ---
  if (!result.damage) {
    const healPattern = /(?:regains?|restores?|heals?)\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+hit\s+points/i;
    const healMatch = text.match(healPattern);
    if (healMatch) {
      result.damage = { formula: healMatch[1].replace(/\s+/g, ""), type: "healing" };
      result.actionType = "heal";
    }
  }

  // --- Save Ability ---
  const savePattern = /(strength|dexterity|constitution|intelligence|wisdom|charisma)\s+saving\s+throw/i;
  const saveMatch = text.match(savePattern);
  if (saveMatch) {
    result.saveAbility = ABILITY_MAP[saveMatch[1].toLowerCase()];
    result.actionType = "save";
  }

  // --- Attack Type ---
  if (textLC.includes("melee spell attack")) {
    result.actionType = "msak";
  } else if (textLC.includes("ranged spell attack") || textLC.includes("spell attack")) {
    result.actionType = "rsak";
  }

  // --- Concentration ---
  if (textLC.includes("concentration")) {
    result.concentration = true;
  }

  // --- Casting Time from description ---
  if (textLC.includes("bonus action")) {
    result.castingTime = { type: "bonus", cost: 1 };
  } else if (textLC.includes("reaction")) {
    result.castingTime = { type: "reaction", cost: 1 };
  }

  // --- Duration from description ---
  const durMatch = textLC.match(/(?:duration|lasts?|for)\s+(?:up\s+to\s+)?(\d+)\s+(round|minute|hour|day)s?/i);
  if (durMatch) {
    result.duration = { value: parseInt(durMatch[1], 10), unit: durMatch[2] };
  } else if (textLC.includes("instantaneous")) {
    result.duration = { value: null, unit: "instantaneous" };
  }

  // --- Range from description ---
  const rangeMatch = textLC.match(/range\s+of\s+(\d+)\s+(feet|ft|mile)/i);
  if (rangeMatch) {
    result.range = { value: parseInt(rangeMatch[1], 10), unit: rangeMatch[2] };
  }

  // --- Target area from description ---
  const areaMatch = textLC.match(/(\d+)[- ]foot[- ](cone|cube|sphere|cylinder|line|radius|wall)/i);
  if (areaMatch) {
    result.target = { value: parseInt(areaMatch[1], 10), type: areaMatch[2].toLowerCase() };
  }

  return result;
}

// ---------- Compendium Spell Lookup ----------

/**
 * Search for an existing spell by name — checks world items first,
 * then searches compendium packs. If found in a compendium, imports it
 * into the world as a proper Item so it can be referenced by cast activities.
 * Returns the spell's world UUID if found/imported, null otherwise.
 *
 * @param {string} spellName — the spell name to search for (case-insensitive)
 * @returns {Promise<string|null>} the world spell UUID, or null if not found
 */
export async function findSpellByName(spellName) {
  if (!spellName) return null;
  const nameLower = spellName.toLowerCase().trim();

  // 1. Check world items first (already imported spells)
  const worldSpell = game.items.find(i =>
    i.type === "spell" && i.name.toLowerCase() === nameLower
  );
  if (worldSpell) return worldSpell.uuid;

  // 2. Search compendium packs and import if found
  for (const pack of game.packs) {
    if (pack.metadata.type !== "Item") continue;
    try {
      const index = await pack.getIndex({ fields: ["name", "type"] });
      const match = index.find(e =>
        e.type === "spell" && e.name.toLowerCase() === nameLower
      );
      if (match) {
        // Import the spell from the compendium into the world
        const compendiumDoc = await pack.getDocument(match._id);
        const imported = await Item.create(compendiumDoc.toObject());
        return imported.uuid;
      }
    } catch (err) {
      // Some packs may fail to index or import — skip silently
      console.warn(`findSpellByName: Could not search/import from ${pack.collection}:`, err.message);
    }
  }

  return null;
}
