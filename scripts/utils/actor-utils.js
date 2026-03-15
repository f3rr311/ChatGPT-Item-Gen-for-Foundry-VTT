/**
 * Actor generation constants and pure utility functions.
 * No Foundry runtime dependencies — fully unit-testable.
 *
 * This work includes material taken from the System Reference Document 5.1
 * ("SRD 5.1") by Wizards of the Coast LLC, available at
 * https://www.dndbeyond.com/srd. The SRD 5.1 is licensed under the Creative
 * Commons Attribution 4.0 International License available at
 * https://creativecommons.org/licenses/by/4.0/legalcode.
 */

// ─── Ability Score Helpers ───

/** Full ability name → 3-letter dnd5e abbreviation. */
export const ABILITY_KEY_MAP = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
  str: "str", dex: "dex", con: "con", int: "int", wis: "wis", cha: "cha"
};

/** All six ability keys in standard order. */
export const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"];

/**
 * Compute ability modifier from score.
 * @param {number} score
 * @returns {number}
 */
export function abilityMod(score) {
  return Math.floor((score - 10) / 2);
}

// ─── Proficiency Bonus ───

/**
 * Proficiency bonus from Challenge Rating (NPCs).
 * @param {number} cr
 * @returns {number}
 */
export function proficiencyFromCR(cr) {
  if (cr <= 4) return 2;
  if (cr <= 8) return 3;
  if (cr <= 12) return 4;
  if (cr <= 16) return 5;
  if (cr <= 20) return 6;
  if (cr <= 24) return 7;
  if (cr <= 28) return 8;
  return 9;
}

/**
 * Proficiency bonus from character level.
 * @param {number} level
 * @returns {number}
 */
export function proficiencyFromLevel(level) {
  return Math.ceil(level / 4) + 1;
}

// ─── Size ───

/** AI/natural size name → dnd5e size key. */
export const SIZE_KEY_MAP = {
  tiny: "tiny", small: "sm", medium: "med",
  large: "lg", huge: "huge", gargantuan: "grg",
  // already-correct keys pass through
  sm: "sm", med: "med", lg: "lg", grg: "grg"
};

/** dnd5e size key → hit die denomination. */
export const SIZE_HIT_DIE = {
  tiny: 4, sm: 6, med: 8, lg: 10, huge: 12, grg: 20
};

// ─── Class Hit Dice ───

/** Class name → hit die denomination. */
export const CLASS_HIT_DIE = {
  barbarian: 12,
  fighter: 10, paladin: 10, ranger: 10,
  artificer: 8, bard: 8, cleric: 8, druid: 8, monk: 8, rogue: 8, warlock: 8, blood_hunter: 10,
  sorcerer: 6, wizard: 6
};

// ─── Skills ───

/** Full skill name → dnd5e abbreviation. */
export const SKILL_KEY_MAP = {
  acrobatics: "acr", "animal handling": "ani", arcana: "arc",
  athletics: "ath", deception: "dec", history: "his",
  insight: "ins", intimidation: "itm", investigation: "inv",
  medicine: "med", nature: "nat", perception: "prc",
  performance: "prf", persuasion: "per", religion: "rel",
  "sleight of hand": "slt", stealth: "ste", survival: "sur",
  // already-correct keys pass through
  acr: "acr", ani: "ani", arc: "arc", ath: "ath", dec: "dec", his: "his",
  ins: "ins", itm: "itm", inv: "inv", med: "med", nat: "nat", prc: "prc",
  prf: "prf", per: "per", rel: "rel", slt: "slt", ste: "ste", sur: "sur"
};

/** dnd5e skill abbreviation → governing ability. */
export const SKILL_ABILITY_MAP = {
  acr: "dex", ani: "wis", arc: "int", ath: "str",
  dec: "cha", his: "int", ins: "wis", itm: "cha",
  inv: "int", med: "wis", nat: "int", prc: "wis",
  prf: "cha", per: "cha", rel: "int", slt: "dex",
  ste: "dex", sur: "wis"
};

// ─── Languages ───

/** Common language name → dnd5e key. */
export const LANGUAGE_KEY_MAP = {
  common: "common", dwarvish: "dwarvish", elvish: "elvish",
  giant: "giant", gnomish: "gnomish", goblin: "goblin",
  halfling: "halfling", orc: "orc", abyssal: "abyssal",
  celestial: "celestial", draconic: "draconic", "deep speech": "deep",
  infernal: "infernal", primordial: "primordial", sylvan: "sylvan",
  undercommon: "undercommon", "thieves' cant": "cant", "thieves cant": "cant",
  druidic: "druidic", auran: "auran", aquan: "aquan",
  ignan: "ignan", terran: "terran"
};

// ─── Creature Types ───

/** Valid dnd5e creature type values. */
export const CREATURE_TYPES = [
  "aberration", "beast", "celestial", "construct", "dragon",
  "elemental", "fey", "fiend", "giant", "humanoid",
  "monstrosity", "ooze", "plant", "undead"
];

// ─── Damage & Condition Types ───

export const DAMAGE_TYPES = [
  "acid", "bludgeoning", "cold", "fire", "force",
  "lightning", "necrotic", "piercing", "poison", "psychic",
  "radiant", "slashing", "thunder"
];

export const CONDITION_TYPES = [
  "blinded", "charmed", "deafened", "exhaustion", "frightened",
  "grappled", "incapacitated", "invisible", "paralyzed", "petrified",
  "poisoned", "prone", "restrained", "stunned", "unconscious"
];

// ─── Armor AC Table ───

/**
 * Armor name → base AC, type, and optional max DEX bonus.
 * Used by the validator to verify AI-generated AC values.
 */
export const ARMOR_AC_TABLE = {
  "padded":          { base: 11, type: "light" },
  "leather":         { base: 11, type: "light" },
  "leather armor":   { base: 11, type: "light" },
  "studded leather": { base: 12, type: "light" },
  "hide":            { base: 12, type: "medium", maxDex: 2 },
  "hide armor":      { base: 12, type: "medium", maxDex: 2 },
  "chain shirt":     { base: 13, type: "medium", maxDex: 2 },
  "scale mail":      { base: 14, type: "medium", maxDex: 2 },
  "breastplate":     { base: 14, type: "medium", maxDex: 2 },
  "half plate":      { base: 15, type: "medium", maxDex: 2 },
  "ring mail":       { base: 14, type: "heavy" },
  "chain mail":      { base: 16, type: "heavy" },
  "splint":          { base: 17, type: "heavy" },
  "splint armor":    { base: 17, type: "heavy" },
  "plate":           { base: 18, type: "heavy" },
  "plate armor":     { base: 18, type: "heavy" }
};

/**
 * Compute expected AC from armor type + DEX modifier + shield.
 * @param {string} armorName — e.g. "leather armor", "chain mail"
 * @param {number} dexMod — ability modifier for DEX
 * @param {boolean} hasShield — whether a shield is equipped (+2)
 * @returns {number|null} expected AC, or null if armor not recognized
 */
export function computeExpectedAC(armorName, dexMod, hasShield = false) {
  const key = armorName?.toLowerCase().trim();
  if (!key) return null;

  // Natural armor (e.g., "natural armor") — can't compute, return null
  if (key.includes("natural")) return null;

  const entry = ARMOR_AC_TABLE[key];
  if (!entry) return null;

  let ac = entry.base;
  if (entry.type === "light") {
    ac += dexMod;
  } else if (entry.type === "medium") {
    ac += Math.min(dexMod, entry.maxDex ?? 2);
  }
  // heavy armor: no DEX bonus

  if (hasShield) ac += 2;
  return ac;
}

// ─── CR → XP Table ───

/** Challenge Rating → experience points. */
export const CR_XP_TABLE = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100,
  1: 200, 2: 450, 3: 700, 4: 1100, 5: 1800,
  6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900,
  11: 7200, 12: 8400, 13: 10000, 14: 11500, 15: 13000,
  16: 15000, 17: 18000, 18: 20000, 19: 22000, 20: 25000,
  21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000,
  26: 90000, 27: 105000, 28: 120000, 29: 135000, 30: 155000
};

/** Valid CR values (as numbers). */
export const VALID_CRS = Object.keys(CR_XP_TABLE).map(Number);

/**
 * Snap a numeric CR to the nearest valid D&D 5e CR value.
 * @param {number} cr
 * @returns {number}
 */
export function snapToValidCR(cr) {
  if (typeof cr !== "number" || isNaN(cr)) return 1;
  if (cr < 0) return 0;
  if (cr > 30) return 30;
  let closest = 0;
  let minDiff = Infinity;
  for (const valid of VALID_CRS) {
    const diff = Math.abs(cr - valid);
    if (diff < minDiff) { minDiff = diff; closest = valid; }
  }
  return closest;
}

// ─── Character XP Thresholds ───

/** Level → total XP needed to reach that level. */
export const LEVEL_XP_TABLE = {
  1: 0, 2: 300, 3: 900, 4: 2700, 5: 6500,
  6: 14000, 7: 23000, 8: 34000, 9: 48000, 10: 64000,
  11: 85000, 12: 100000, 13: 120000, 14: 140000, 15: 165000,
  16: 195000, 17: 225000, 18: 265000, 19: 305000, 20: 355000
};

// ─── Spell Slot Tables ───

/** Full caster spell slots by caster level. Each value is [1st, 2nd, ..., 9th]. */
export const FULL_CASTER_SLOTS = {
  1:  [2],
  2:  [3],
  3:  [4, 2],
  4:  [4, 3],
  5:  [4, 3, 2],
  6:  [4, 3, 3],
  7:  [4, 3, 3, 1],
  8:  [4, 3, 3, 2],
  9:  [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1]
};

/** Half caster spell slots by class level. */
export const HALF_CASTER_SLOTS = {
  2:  [2],
  3:  [3],
  4:  [3],
  5:  [4, 2],
  6:  [4, 2],
  7:  [4, 3],
  8:  [4, 3],
  9:  [4, 3, 2],
  10: [4, 3, 2],
  11: [4, 3, 3],
  12: [4, 3, 3],
  13: [4, 3, 3, 1],
  14: [4, 3, 3, 1],
  15: [4, 3, 3, 2],
  16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
  20: [4, 3, 3, 3, 2]
};

/** Third caster spell slots by class level (Eldritch Knight, Arcane Trickster). */
export const THIRD_CASTER_SLOTS = {
  3:  [2],
  4:  [3],
  5:  [3],
  6:  [3],
  7:  [4, 2],
  8:  [4, 2],
  9:  [4, 2],
  10: [4, 3],
  11: [4, 3],
  12: [4, 3],
  13: [4, 3, 2],
  14: [4, 3, 2],
  15: [4, 3, 2],
  16: [4, 3, 3],
  17: [4, 3, 3],
  18: [4, 3, 3],
  19: [4, 3, 3, 1],
  20: [4, 3, 3, 1]
};

/** Warlock pact slots by class level: { slots, level }. */
export const PACT_SLOTS = {
  1:  { slots: 1, level: 1 },
  2:  { slots: 2, level: 1 },
  3:  { slots: 2, level: 2 },
  4:  { slots: 2, level: 2 },
  5:  { slots: 2, level: 3 },
  6:  { slots: 2, level: 3 },
  7:  { slots: 2, level: 4 },
  8:  { slots: 2, level: 4 },
  9:  { slots: 2, level: 5 },
  10: { slots: 2, level: 5 },
  11: { slots: 3, level: 5 },
  12: { slots: 3, level: 5 },
  13: { slots: 3, level: 5 },
  14: { slots: 3, level: 5 },
  15: { slots: 3, level: 5 },
  16: { slots: 3, level: 5 },
  17: { slots: 4, level: 5 },
  18: { slots: 4, level: 5 },
  19: { slots: 4, level: 5 },
  20: { slots: 4, level: 5 }
};

/** Class name → caster type. */
export const CLASS_CASTER_TYPE = {
  wizard: "full", sorcerer: "full", cleric: "full",
  druid: "full", bard: "full",
  warlock: "pact",
  paladin: "half", ranger: "half", artificer: "half",
  fighter: "third", rogue: "third"
};

/**
 * Get spell slot array for a given class and level.
 * @param {string} className — e.g. "wizard", "ranger"
 * @param {number} level — class level (1-20)
 * @returns {number[]} array where index 0 = 1st-level slots, etc. Empty if non-caster.
 */
export function getSpellSlots(className, level) {
  const cls = className?.toLowerCase();
  const casterType = CLASS_CASTER_TYPE[cls];
  if (!casterType) return [];

  if (casterType === "full") return FULL_CASTER_SLOTS[level] ?? [];
  if (casterType === "half") {
    // Artificer is unique among half-casters: gets spellcasting at level 1
    if (cls === "artificer" && level === 1) return [2];
    return HALF_CASTER_SLOTS[level] ?? [];
  }
  if (casterType === "third") return THIRD_CASTER_SLOTS[level] ?? [];
  if (casterType === "pact") return []; // Pact magic uses separate pact slot system
  return [];
}

/**
 * Get NPC spell slots from an effective caster level.
 * Most NPC spellcasters are treated as full casters.
 * @param {number} casterLevel — effective caster level (1-20)
 * @returns {number[]}
 */
export function getNPCSpellSlots(casterLevel) {
  return FULL_CASTER_SLOTS[Math.min(Math.max(casterLevel, 1), 20)] ?? [];
}

// ─── HP Computation ───

/**
 * Parse a hit dice formula like "5d8+10" into components.
 * @param {string} formula — e.g. "5d8+10", "2d6", "10d10+30"
 * @returns {{ count: number, die: number, bonus: number }|null}
 */
export function parseHitDiceFormula(formula) {
  if (!formula || typeof formula !== "string") return null;
  const match = formula.match(/^(\d+)d(\d+)([+-]\d+)?$/);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    die: parseInt(match[2], 10),
    bonus: match[3] ? parseInt(match[3], 10) : 0
  };
}

/**
 * Compute average HP from a hit dice formula.
 * @param {string} formula — e.g. "5d8+10"
 * @returns {number|null}
 */
export function computeAverageHP(formula) {
  const parsed = parseHitDiceFormula(formula);
  if (!parsed) return null;
  return Math.floor(parsed.count * ((parsed.die + 1) / 2) + parsed.bonus);
}

/**
 * Build the expected hit dice formula for an NPC given count, size, and CON mod.
 * @param {number} count — number of hit dice
 * @param {string} sizeKey — dnd5e size key (e.g. "med")
 * @param {number} conMod — constitution modifier
 * @returns {string} e.g. "5d8+10"
 */
export function buildHitDiceFormula(count, sizeKey, conMod) {
  const die = SIZE_HIT_DIE[sizeKey] ?? 8;
  const bonus = count * conMod;
  if (bonus === 0) return `${count}d${die}`;
  return `${count}d${die}${bonus >= 0 ? "+" : ""}${bonus}`;
}

// ─── Mapping Helpers ───

/**
 * Normalize a skill name to its dnd5e key.
 * @param {string} name — full name or abbreviation
 * @returns {string|null} dnd5e skill key, or null if not recognized
 */
export function normalizeSkillKey(name) {
  return SKILL_KEY_MAP[name?.toLowerCase().trim()] ?? null;
}

/**
 * Normalize an ability name to its dnd5e key.
 * @param {string} name — full name or abbreviation
 * @returns {string|null}
 */
export function normalizeAbilityKey(name) {
  return ABILITY_KEY_MAP[name?.toLowerCase().trim()] ?? null;
}

/**
 * Normalize a language name to its dnd5e key.
 * Returns the key if known, or null if the language should go to custom.
 * @param {string} name
 * @returns {string|null}
 */
export function normalizeLanguageKey(name) {
  return LANGUAGE_KEY_MAP[name?.toLowerCase().trim()] ?? null;
}

/**
 * Normalize a size name to its dnd5e key.
 * @param {string} name
 * @returns {string}
 */
export function normalizeSizeKey(name) {
  return SIZE_KEY_MAP[name?.toLowerCase().trim()] ?? "med";
}

/**
 * Check if a creature type is valid.
 * @param {string} type
 * @returns {boolean}
 */
export function isValidCreatureType(type) {
  return CREATURE_TYPES.includes(type?.toLowerCase().trim());
}

/**
 * Normalize a damage type string.
 * @param {string} type
 * @returns {string|null} valid dnd5e damage type, or null
 */
export function normalizeDamageType(type) {
  const key = type?.toLowerCase().trim();
  return DAMAGE_TYPES.includes(key) ? key : null;
}

/**
 * Normalize a condition type string.
 * @param {string} type
 * @returns {string|null} valid dnd5e condition type, or null
 */
export function normalizeConditionType(type) {
  const key = type?.toLowerCase().trim();
  return CONDITION_TYPES.includes(key) ? key : null;
}

// ─── Class Defaults ───

/** Default saving throw proficiencies by class. */
export const CLASS_SAVING_THROWS = {
  barbarian: ["str", "con"],
  bard: ["dex", "cha"],
  cleric: ["wis", "cha"],
  druid: ["int", "wis"],
  fighter: ["str", "con"],
  monk: ["str", "dex"],
  paladin: ["wis", "cha"],
  ranger: ["str", "dex"],
  rogue: ["dex", "int"],
  sorcerer: ["con", "cha"],
  warlock: ["wis", "cha"],
  wizard: ["int", "wis"],
  artificer: ["con", "int"]
};

/** Default spellcasting ability by class. */
export const CLASS_SPELLCASTING_ABILITY = {
  bard: "cha", cleric: "wis", druid: "wis",
  paladin: "cha", ranger: "wis", sorcerer: "cha",
  warlock: "cha", wizard: "int", artificer: "int"
};

// ─── Class Data (Subclasses & Features) ───

/**
 * Comprehensive class data: subclasses, subclass level, and features by level.
 * Used by the AI prompt to generate correct subclass/feature combos,
 * and by the validator to verify feature lists.
 *
 * Each class entry:
 *   subclassLevel: the level at which the subclass is chosen
 *   subclasses: { key: { name, source } } — source is "2014", "2024", or "both"
 *   features: { [level]: string[] } — class features gained at each level (2024 base)
 *
 * Sources: PHB 2024 (XPHB), PHB 2014, and supplement books (XGtE, TCoE, etc.)
 */
export const CLASS_DATA = {
  barbarian: {
    subclassLevel: 3,
    subclasses: {
      berserker:            { name: "Path of the Berserker", source: "both", srd: true },
      totem:                { name: "Path of the Totem Warrior", source: "2014", srd: false },
      "ancestral-guardian": { name: "Path of the Ancestral Guardian", source: "2014", srd: false },
      storm:                { name: "Path of the Storm Herald", source: "2014", srd: false },
      zealot:               { name: "Path of the Zealot", source: "both", srd: false },
      beast:                { name: "Path of the Beast", source: "2014", srd: false },
      "wild-magic":         { name: "Path of Wild Magic", source: "both", srd: false },
      "world-tree":         { name: "Path of the World Tree", source: "2024", srd: false }
    },
    features: {
      1: ["Rage", "Unarmored Defense"],
      2: ["Danger Sense", "Reckless Attack"],
      3: ["Primal Knowledge"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Fast Movement"],
      7: ["Feral Instinct", "Instinctive Pounce"],
      8: ["Ability Score Improvement"],
      9: ["Brutal Strike"],
      11: ["Relentless Rage"],
      12: ["Ability Score Improvement"],
      13: ["Improved Brutal Strike"],
      15: ["Persistent Rage"],
      16: ["Ability Score Improvement"],
      17: ["Improved Brutal Strike"],
      18: ["Indomitable Might"],
      19: ["Ability Score Improvement"],
      20: ["Primal Champion"]
    }
  },
  bard: {
    subclassLevel: 3,
    subclasses: {
      lore:     { name: "College of Lore", source: "both", srd: true },
      valor:    { name: "College of Valor", source: "both", srd: false },
      glamour:  { name: "College of Glamour", source: "both", srd: false },
      swords:   { name: "College of Swords", source: "2014", srd: false },
      whispers: { name: "College of Whispers", source: "2014", srd: false },
      dance:    { name: "College of Dance", source: "2024", srd: false }
    },
    features: {
      1: ["Bardic Inspiration", "Spellcasting"],
      2: ["Expertise", "Jack of All Trades"],
      4: ["Ability Score Improvement"],
      5: ["Font of Inspiration"],
      7: ["Countercharm"],
      8: ["Ability Score Improvement"],
      9: ["Expertise"],
      10: ["Magical Secrets"],
      12: ["Ability Score Improvement"],
      14: ["Magical Secrets"],
      16: ["Ability Score Improvement"],
      18: ["Magical Secrets", "Superior Inspiration"],
      19: ["Ability Score Improvement"],
      20: ["Words of Creation"]
    }
  },
  cleric: {
    subclassLevel: 1,
    subclasses: {
      life:     { name: "Life Domain", source: "both", srd: true },
      light:    { name: "Light Domain", source: "both", srd: false },
      trickery: { name: "Trickery Domain", source: "both", srd: false },
      war:      { name: "War Domain", source: "both", srd: false },
      knowledge:{ name: "Knowledge Domain", source: "2014", srd: false },
      nature:   { name: "Nature Domain", source: "2014", srd: false },
      tempest:  { name: "Tempest Domain", source: "2014", srd: false },
      forge:    { name: "Forge Domain", source: "2014", srd: false },
      grave:    { name: "Grave Domain", source: "2014", srd: false },
      order:    { name: "Order Domain", source: "2014", srd: false },
      peace:    { name: "Peace Domain", source: "2014", srd: false },
      twilight: { name: "Twilight Domain", source: "2014", srd: false }
    },
    features: {
      1: ["Spellcasting", "Channel Divinity"],
      2: ["Channel Divinity"],
      4: ["Ability Score Improvement"],
      5: ["Destroy Undead", "Smite Undead"],
      7: ["Blessed Strikes"],
      8: ["Ability Score Improvement"],
      10: ["Divine Intervention"],
      12: ["Ability Score Improvement"],
      14: ["Improved Blessed Strikes"],
      16: ["Ability Score Improvement"],
      18: ["Channel Divinity"],
      19: ["Ability Score Improvement"],
      20: ["Greater Divine Intervention"]
    }
  },
  druid: {
    subclassLevel: 3,
    subclasses: {
      land:     { name: "Circle of the Land", source: "both", srd: true },
      moon:     { name: "Circle of the Moon", source: "both", srd: false },
      shepherd: { name: "Circle of the Shepherd", source: "2014", srd: false },
      spores:   { name: "Circle of Spores", source: "2014", srd: false },
      stars:    { name: "Circle of Stars", source: "2014", srd: false },
      wildfire: { name: "Circle of Wildfire", source: "2014", srd: false },
      sea:      { name: "Circle of the Sea", source: "2024", srd: false }
    },
    features: {
      1: ["Druidic", "Spellcasting"],
      2: ["Wild Shape", "Wild Companion"],
      4: ["Ability Score Improvement", "Wild Shape Improvement"],
      5: ["Wild Resurgence"],
      7: ["Elemental Fury"],
      8: ["Ability Score Improvement"],
      9: ["Commune with Nature"],
      11: ["Wild Shape Improvement"],
      12: ["Ability Score Improvement"],
      15: ["Improved Elemental Fury"],
      16: ["Ability Score Improvement"],
      18: ["Beast Spells"],
      19: ["Ability Score Improvement"],
      20: ["Archdruid"]
    }
  },
  fighter: {
    subclassLevel: 3,
    subclasses: {
      champion:        { name: "Champion", source: "both", srd: true },
      "battle-master": { name: "Battle Master", source: "both", srd: false },
      "eldritch-knight":{ name: "Eldritch Knight", source: "both", srd: false },
      cavalier:        { name: "Cavalier", source: "2014", srd: false },
      samurai:         { name: "Samurai", source: "2014", srd: false },
      "echo-knight":   { name: "Echo Knight", source: "2014", srd: false },
      "psi-warrior":   { name: "Psi Warrior", source: "2024", srd: false },
      "rune-knight":   { name: "Rune Knight", source: "2014", srd: false }
    },
    features: {
      1: ["Fighting Style", "Second Wind"],
      2: ["Action Surge", "Tactical Mind"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack"],
      6: ["Ability Score Improvement"],
      8: ["Ability Score Improvement"],
      9: ["Indomitable", "Tactical Master"],
      11: ["Extra Attack"],
      12: ["Ability Score Improvement"],
      13: ["Indomitable", "Studied Attacks"],
      14: ["Ability Score Improvement"],
      16: ["Ability Score Improvement"],
      17: ["Action Surge", "Indomitable"],
      19: ["Ability Score Improvement"],
      20: ["Extra Attack"]
    }
  },
  monk: {
    subclassLevel: 3,
    subclasses: {
      "open-hand":     { name: "Way of the Open Hand", source: "both", srd: true },
      shadow:          { name: "Way of Shadow", source: "both", srd: false },
      "four-elements": { name: "Way of the Four Elements", source: "both", srd: false },
      mercy:           { name: "Way of Mercy", source: "2014", srd: false },
      "astral-self":   { name: "Way of the Astral Self", source: "2014", srd: false },
      kensei:          { name: "Way of the Kensei", source: "2014", srd: false },
      "drunken-master":{ name: "Way of the Drunken Master", source: "2014", srd: false },
      "sun-soul":      { name: "Way of the Sun Soul", source: "2014", srd: false },
      "long-death":    { name: "Way of the Long Death", source: "2014", srd: false }
    },
    features: {
      1: ["Martial Arts", "Unarmored Defense"],
      2: ["Ki", "Unarmored Movement", "Dedicated Weapon"],
      3: ["Deflect Missiles"],
      4: ["Ability Score Improvement", "Slow Fall"],
      5: ["Extra Attack", "Stunning Strike"],
      6: ["Ki-Empowered Strikes"],
      7: ["Evasion", "Stillness of Mind"],
      8: ["Ability Score Improvement"],
      10: ["Self-Restoration"],
      12: ["Ability Score Improvement"],
      13: ["Tongue of the Sun and Moon"],
      14: ["Diamond Soul"],
      15: ["Timeless Body"],
      16: ["Ability Score Improvement"],
      18: ["Empty Body"],
      19: ["Ability Score Improvement"],
      20: ["Perfect Self"]
    }
  },
  paladin: {
    subclassLevel: 3,
    subclasses: {
      devotion:   { name: "Oath of Devotion", source: "both", srd: true },
      ancients:   { name: "Oath of the Ancients", source: "both", srd: false },
      vengeance:  { name: "Oath of Vengeance", source: "both", srd: false },
      conquest:   { name: "Oath of Conquest", source: "2014", srd: false },
      redemption: { name: "Oath of Redemption", source: "2014", srd: false },
      glory:      { name: "Oath of Glory", source: "both", srd: false },
      watchers:   { name: "Oath of the Watchers", source: "2014", srd: false },
      oathbreaker:{ name: "Oathbreaker", source: "2014", srd: false },
      crown:      { name: "Oath of the Crown", source: "2014", srd: false }
    },
    features: {
      1: ["Divine Sense", "Lay on Hands"],
      2: ["Fighting Style", "Spellcasting", "Divine Smite"],
      3: ["Channel Divinity"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack", "Faithful Steed"],
      6: ["Aura of Protection"],
      8: ["Ability Score Improvement"],
      9: ["Abjure Foes"],
      10: ["Aura of Courage"],
      11: ["Radiant Strikes"],
      12: ["Ability Score Improvement"],
      14: ["Restoring Touch"],
      16: ["Ability Score Improvement"],
      18: ["Aura Expansion"],
      19: ["Ability Score Improvement"],
      20: ["Sacred Oath"]
    }
  },
  ranger: {
    subclassLevel: 3,
    subclasses: {
      hunter:          { name: "Hunter", source: "both", srd: true },
      "beast-master":  { name: "Beast Master", source: "both", srd: false },
      "gloom-stalker": { name: "Gloom Stalker", source: "both", srd: false },
      "horizon-walker":{ name: "Horizon Walker", source: "2014", srd: false },
      "monster-slayer": { name: "Monster Slayer", source: "2014", srd: false },
      "fey-wanderer":  { name: "Fey Wanderer", source: "both", srd: false },
      swarmkeeper:     { name: "Swarmkeeper", source: "2014", srd: false },
      "drake-warden":  { name: "Drakewarden", source: "2014", srd: false }
    },
    features: {
      1: ["Favored Enemy", "Spellcasting"],
      2: ["Deft Explorer", "Fighting Style"],
      4: ["Ability Score Improvement"],
      5: ["Extra Attack"],
      6: ["Roving"],
      8: ["Ability Score Improvement"],
      9: ["Expertise"],
      10: ["Tireless"],
      12: ["Ability Score Improvement"],
      13: ["Relentless Hunter"],
      14: ["Nature's Veil"],
      16: ["Ability Score Improvement"],
      17: ["Precise Hunter"],
      18: ["Feral Senses"],
      19: ["Ability Score Improvement"],
      20: ["Foe Slayer"]
    }
  },
  rogue: {
    subclassLevel: 3,
    subclasses: {
      thief:            { name: "Thief", source: "both", srd: true },
      assassin:         { name: "Assassin", source: "both", srd: false },
      "arcane-trickster":{ name: "Arcane Trickster", source: "both", srd: false },
      swashbuckler:     { name: "Swashbuckler", source: "2014", srd: false },
      mastermind:       { name: "Mastermind", source: "2014", srd: false },
      inquisitive:      { name: "Inquisitive", source: "2014", srd: false },
      scout:            { name: "Scout", source: "2014", srd: false },
      phantom:          { name: "Phantom", source: "2014", srd: false },
      soulknife:        { name: "Soulknife", source: "both", srd: false }
    },
    features: {
      1: ["Expertise", "Sneak Attack", "Thieves' Cant"],
      2: ["Cunning Action"],
      4: ["Ability Score Improvement"],
      5: ["Uncanny Dodge"],
      7: ["Evasion", "Reliable Talent"],
      8: ["Ability Score Improvement"],
      10: ["Ability Score Improvement"],
      11: ["Improved Sneak Attack"],
      12: ["Ability Score Improvement"],
      14: ["Blindsense", "Devious Strikes"],
      15: ["Slippery Mind"],
      16: ["Ability Score Improvement"],
      18: ["Elusive"],
      19: ["Ability Score Improvement"],
      20: ["Stroke of Luck"]
    }
  },
  sorcerer: {
    subclassLevel: 1,
    subclasses: {
      draconic:    { name: "Draconic Bloodline", source: "both", srd: true },
      "wild-magic":{ name: "Wild Magic", source: "both", srd: false },
      "divine-soul":{ name: "Divine Soul", source: "2014", srd: false },
      shadow:      { name: "Shadow Magic", source: "2014", srd: false },
      aberrant:    { name: "Aberrant Mind", source: "both", srd: false },
      clockwork:   { name: "Clockwork Soul", source: "both", srd: false }
    },
    features: {
      1: ["Spellcasting", "Innate Sorcery"],
      2: ["Font of Magic", "Sorcery Points", "Metamagic"],
      4: ["Ability Score Improvement"],
      5: ["Sorcerous Restoration"],
      7: ["Sorcery Incarnate"],
      8: ["Ability Score Improvement"],
      12: ["Ability Score Improvement"],
      16: ["Ability Score Improvement"],
      19: ["Ability Score Improvement"],
      20: ["Arcane Apotheosis"]
    }
  },
  warlock: {
    subclassLevel: 1,
    subclasses: {
      archfey:        { name: "The Archfey", source: "both", srd: false },
      fiend:          { name: "The Fiend", source: "both", srd: true },
      "great-old-one":{ name: "The Great Old One", source: "both", srd: false },
      celestial:      { name: "The Celestial", source: "both", srd: false },
      hexblade:       { name: "The Hexblade", source: "2014", srd: false },
      fathomless:     { name: "The Fathomless", source: "2014", srd: false },
      genie:          { name: "The Genie", source: "2014", srd: false },
      undead:         { name: "The Undead", source: "2014", srd: false },
      undying:        { name: "The Undying", source: "2014", srd: false }
    },
    features: {
      1: ["Pact Magic", "Eldritch Invocations"],
      2: ["Magical Cunning"],
      3: ["Pact Boon"],
      4: ["Ability Score Improvement"],
      8: ["Ability Score Improvement"],
      9: ["Contact Patron"],
      11: ["Mystic Arcanum"],
      12: ["Ability Score Improvement"],
      13: ["Mystic Arcanum"],
      15: ["Mystic Arcanum"],
      16: ["Ability Score Improvement"],
      17: ["Mystic Arcanum"],
      19: ["Ability Score Improvement"],
      20: ["Eldritch Master"]
    }
  },
  wizard: {
    subclassLevel: 2,
    subclasses: {
      abjuration:    { name: "School of Abjuration", source: "both", srd: false },
      conjuration:   { name: "School of Conjuration", source: "2014", srd: false },
      divination:    { name: "School of Divination", source: "both", srd: false },
      enchantment:   { name: "School of Enchantment", source: "2014", srd: false },
      evocation:     { name: "School of Evocation", source: "both", srd: true },
      illusion:      { name: "School of Illusion", source: "both", srd: false },
      necromancy:    { name: "School of Necromancy", source: "2014", srd: false },
      transmutation: { name: "School of Transmutation", source: "2014", srd: false },
      "war-magic":   { name: "War Magic", source: "2014", srd: false },
      bladesinging:  { name: "Bladesinging", source: "2014", srd: false },
      chronurgy:     { name: "Chronurgy Magic", source: "2014", srd: false },
      graviturgy:    { name: "Graviturgy Magic", source: "2014", srd: false }
    },
    features: {
      1: ["Spellcasting", "Arcane Recovery", "Ritual Casting"],
      2: ["Scholar"],
      4: ["Ability Score Improvement"],
      5: ["Memorize Spell"],
      8: ["Ability Score Improvement"],
      12: ["Ability Score Improvement"],
      16: ["Ability Score Improvement"],
      18: ["Spell Mastery"],
      19: ["Ability Score Improvement"],
      20: ["Signature Spells"]
    }
  },
  // Artificer intentionally omitted — not in either SRD (5.1 or 5.2)
};

/**
 * Get the list of features a character should have at a given level (class features only, not subclass).
 * @param {string} className
 * @param {number} level
 * @returns {string[]}
 */
export function getClassFeatures(className, level) {
  const cls = CLASS_DATA[className?.toLowerCase()];
  if (!cls) return [];
  const features = [];
  for (let i = 1; i <= level; i++) {
    if (cls.features[i]) features.push(...cls.features[i]);
  }
  return features;
}

/**
 * Get valid subclass names for a class, optionally filtered by ruleset and SRD status.
 * @param {string} className
 * @param {"2014"|"2024"|"all"} [ruleset="all"]
 * @param {object} [opts={}]
 * @param {boolean} [opts.srdOnly=false] — if true, only return SRD subclasses
 * @returns {string[]} display names
 */
export function getSubclasses(className, ruleset = "all", { srdOnly = false } = {}) {
  const cls = CLASS_DATA[className?.toLowerCase()];
  if (!cls) return [];
  return Object.values(cls.subclasses)
    .filter(sc => {
      if (srdOnly && !sc.srd) return false;
      return ruleset === "all" || sc.source === ruleset || sc.source === "both";
    })
    .map(sc => sc.name);
}

/**
 * Get the level at which a class chooses its subclass.
 * @param {string} className
 * @returns {number}
 */
export function getSubclassLevel(className) {
  const cls = CLASS_DATA[className?.toLowerCase()];
  return cls?.subclassLevel ?? 3;
}

/**
 * Validate that a subclass name is valid for the given class and ruleset.
 * Uses fuzzy matching (case-insensitive, substring).
 * @param {string} className
 * @param {string} subclassName
 * @param {"2014"|"2024"|"all"} [ruleset="all"]
 * @returns {string|null} the canonical subclass name, or null if not found
 */
export function resolveSubclass(className, subclassName, ruleset = "all") {
  if (!subclassName) return null;
  const valid = getSubclasses(className, ruleset);
  const needle = subclassName.toLowerCase().trim();
  // Exact match
  const exact = valid.find(n => n.toLowerCase() === needle);
  if (exact) return exact;
  // Substring match (e.g. "moon" → "Circle of the Moon")
  const partial = valid.find(n => n.toLowerCase().includes(needle));
  if (partial) return partial;
  // Reverse substring (e.g. "Circle of the Moon" matches "moon")
  const reverse = valid.find(n => needle.includes(n.toLowerCase()));
  return reverse || null;
}

// ─── Race Data ───

/**
 * Race data: traits, speed, size, darkvision, and languages.
 * Covers PHB 2014 + PHB 2024 races. Used by the AI prompt to generate
 * accurate racial traits and by the validator to verify generated data.
 *
 * Each race entry:
 *   size: dnd5e size key
 *   speed: walk speed in feet
 *   darkvision: range in feet (0 if none)
 *   languages: default language names
 *   traits: racial feature names the character should have
 *   subraces: { key: { name, traits, source } } (optional)
 *   source: "2014", "2024", or "both"
 */
export const RACE_DATA = {
  human: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common"],
    traits: ["Resourceful", "Skillful", "Versatile"],
    source: "both", srd: true,
    subraces: {}
  },
  elf: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "elvish"],
    traits: ["Darkvision", "Keen Senses", "Fey Ancestry", "Trance"],
    source: "both", srd: true,
    subraces: {
      "high-elf":  { name: "High Elf", traits: ["Cantrip", "Extra Language"], source: "both", srd: true },
      "wood-elf":  { name: "Wood Elf", traits: ["Fleet of Foot", "Mask of the Wild"], source: "both", srd: true },
      drow:        { name: "Dark Elf (Drow)", traits: ["Superior Darkvision", "Sunlight Sensitivity", "Drow Magic"], source: "both", srd: true },
      eladrin:     { name: "Eladrin", traits: ["Fey Step"], source: "2014", srd: false },
      "sea-elf":   { name: "Sea Elf", traits: ["Sea Elf Training", "Child of the Sea"], source: "2014", srd: false },
      shadar:      { name: "Shadar-kai", traits: ["Blessing of the Raven Queen", "Necrotic Resistance"], source: "2014", srd: false }
    }
  },
  dwarf: {
    size: "med", speed: 25, darkvision: 60,
    languages: ["common", "dwarvish"],
    traits: ["Darkvision", "Dwarven Resilience", "Dwarven Toughness", "Stonecunning"],
    source: "both", srd: true,
    subraces: {
      "hill-dwarf":     { name: "Hill Dwarf", traits: ["Dwarven Toughness"], source: "2014", srd: true },
      "mountain-dwarf": { name: "Mountain Dwarf", traits: ["Dwarven Armor Training"], source: "2014", srd: false },
      duergar:          { name: "Duergar", traits: ["Superior Darkvision", "Duergar Magic", "Sunlight Sensitivity"], source: "2014", srd: false }
    }
  },
  halfling: {
    size: "sm", speed: 30, darkvision: 0,
    languages: ["common", "halfling"],
    traits: ["Brave", "Halfling Nimbleness", "Lucky", "Naturally Stealthy"],
    source: "both", srd: true,
    subraces: {
      lightfoot: { name: "Lightfoot Halfling", traits: ["Naturally Stealthy"], source: "both", srd: true },
      stout:     { name: "Stout Halfling", traits: ["Stout Resilience"], source: "both", srd: false },
      ghostwise: { name: "Ghostwise Halfling", traits: ["Silent Speech"], source: "2014", srd: false }
    }
  },
  gnome: {
    size: "sm", speed: 25, darkvision: 60,
    languages: ["common", "gnomish"],
    traits: ["Darkvision", "Gnome Cunning"],
    source: "both", srd: true,
    subraces: {
      "forest-gnome": { name: "Forest Gnome", traits: ["Natural Illusionist", "Speak with Small Beasts"], source: "both", srd: false },
      "rock-gnome":   { name: "Rock Gnome", traits: ["Artificer's Lore", "Tinker"], source: "both", srd: true },
      "deep-gnome":   { name: "Deep Gnome (Svirfneblin)", traits: ["Superior Darkvision", "Stone Camouflage", "Gnome Magic"], source: "2014", srd: false }
    }
  },
  "half-elf": {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "elvish"],
    traits: ["Darkvision", "Fey Ancestry", "Skill Versatility"],
    source: "2014", srd: true,
    subraces: {}
  },
  "half-orc": {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "orc"],
    traits: ["Darkvision", "Menacing", "Relentless Endurance", "Savage Attacks"],
    source: "2014", srd: true,
    subraces: {}
  },
  tiefling: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "infernal"],
    traits: ["Darkvision", "Hellish Resistance", "Infernal Legacy"],
    source: "both", srd: true,
    subraces: {
      asmodeus: { name: "Asmodeus Tiefling", traits: ["Infernal Legacy"], source: "2014", srd: false },
      fierna:   { name: "Fierna Tiefling", traits: ["Fierna Legacy"], source: "2014", srd: false },
      glasya:   { name: "Glasya Tiefling", traits: ["Glasya Legacy"], source: "2014", srd: false },
      levistus: { name: "Levistus Tiefling", traits: ["Levistus Legacy"], source: "2014", srd: false },
      mammon:   { name: "Mammon Tiefling", traits: ["Mammon Legacy"], source: "2014", srd: false },
      mephistopheles: { name: "Mephistopheles Tiefling", traits: ["Mephistopheles Legacy"], source: "2014", srd: false },
      zariel:   { name: "Zariel Tiefling", traits: ["Zariel Legacy"], source: "2014", srd: false }
    }
  },
  dragonborn: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "draconic"],
    traits: ["Breath Weapon", "Draconic Ancestry", "Damage Resistance"],
    source: "both", srd: true,
    subraces: {
      chromatic:  { name: "Chromatic Dragonborn", traits: ["Chromatic Warding", "Breath Weapon"], source: "2024", srd: true },
      metallic:   { name: "Metallic Dragonborn", traits: ["Metallic Breath Weapon", "Breath Weapon"], source: "2024", srd: true },
      gem:        { name: "Gem Dragonborn", traits: ["Gem Flight", "Breath Weapon", "Psionic Mind"], source: "2024", srd: true }
    }
  },
  orc: {
    size: "med", speed: 30, darkvision: 120,
    languages: ["common", "orc"],
    traits: ["Adrenaline Rush", "Darkvision", "Relentless Endurance"],
    source: "2024", srd: true,
    subraces: {}
  },
  aasimar: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "celestial"],
    traits: ["Celestial Resistance", "Darkvision", "Healing Hands", "Light Bearer"],
    source: "both", srd: false,
    subraces: {
      protector: { name: "Protector Aasimar", traits: ["Radiant Soul"], source: "2014", srd: false },
      scourge:   { name: "Scourge Aasimar", traits: ["Radiant Consumption"], source: "2014", srd: false },
      fallen:    { name: "Fallen Aasimar", traits: ["Necrotic Shroud"], source: "2014", srd: false }
    }
  },
  goliath: {
    size: "med", speed: 35, darkvision: 0,
    languages: ["common", "giant"],
    traits: ["Giant Ancestry", "Large Form", "Powerful Build"],
    source: "both", srd: true,
    subraces: {}
  },
  tabaxi: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common"],
    traits: ["Cat's Claws", "Cat's Talent", "Darkvision", "Feline Agility"],
    source: "2014", srd: false,
    subraces: {}
  },
  kenku: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "auran"],
    traits: ["Expert Forgery", "Kenku Training", "Mimicry"],
    source: "2014", srd: false,
    subraces: {}
  },
  firbolg: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "elvish", "giant"],
    traits: ["Firbolg Magic", "Hidden Step", "Powerful Build", "Speech of Beast and Leaf"],
    source: "2014", srd: false,
    subraces: {}
  },
  tortle: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "aquan"],
    traits: ["Claws", "Hold Breath", "Natural Armor", "Shell Defense", "Survival Instinct"],
    source: "2014", srd: false,
    subraces: {}
  },
  yuan: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "abyssal", "draconic"],
    traits: ["Darkvision", "Innate Spellcasting", "Magic Resistance", "Poison Immunity"],
    source: "2014", srd: false,
    subraces: {}
  },
  lizardfolk: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "draconic"],
    traits: ["Bite", "Cunning Artisan", "Hold Breath", "Hunter's Lore", "Hungry Jaws", "Natural Armor"],
    source: "2014", srd: false,
    subraces: {}
  },
  goblin: {
    size: "sm", speed: 30, darkvision: 60,
    languages: ["common", "goblin"],
    traits: ["Darkvision", "Fey Ancestry", "Fury of the Small", "Nimble Escape"],
    source: "2014", srd: false,
    subraces: {}
  },
  bugbear: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "goblin"],
    traits: ["Darkvision", "Fey Ancestry", "Long-Limbed", "Powerful Build", "Sneaky", "Surprise Attack"],
    source: "2014", srd: false,
    subraces: {}
  },
  hobgoblin: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "goblin"],
    traits: ["Darkvision", "Fey Ancestry", "Fey Gift", "Fortune from the Many"],
    source: "2014", srd: false,
    subraces: {}
  },
  kobold: {
    size: "sm", speed: 30, darkvision: 60,
    languages: ["common", "draconic"],
    traits: ["Darkvision", "Draconic Cry", "Kobold Legacy"],
    source: "2014", srd: false,
    subraces: {}
  },
  changeling: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common"],
    traits: ["Changeling Instincts", "Shapechanger"],
    source: "2014", srd: false,
    subraces: {}
  },
  kalashtar: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "quori"],
    traits: ["Dual Mind", "Mental Discipline", "Mind Link", "Severed from Dreams"],
    source: "2014", srd: false,
    subraces: {}
  },
  shifter: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common"],
    traits: ["Bestial Instincts", "Darkvision", "Shifting"],
    source: "2014", srd: false,
    subraces: {
      beasthide:  { name: "Beasthide", traits: ["Shifting Feature: Tough Hide"], source: "2014", srd: false },
      longtooth:  { name: "Longtooth", traits: ["Shifting Feature: Fangs"], source: "2014", srd: false },
      swiftstride:{ name: "Swiftstride", traits: ["Shifting Feature: Swift Stride"], source: "2014", srd: false },
      wildhunt:   { name: "Wildhunt", traits: ["Shifting Feature: Keen Tracker"], source: "2014", srd: false }
    }
  },
  warforged: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common"],
    traits: ["Constructed Resilience", "Integrated Protection", "Sentry's Rest", "Specialized Design"],
    source: "2014", srd: false,
    subraces: {}
  },
  genasi: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "primordial"],
    traits: [],
    source: "2014", srd: false,
    subraces: {
      "air-genasi":   { name: "Air Genasi", traits: ["Unending Breath", "Mingle with the Wind"], source: "2014", srd: false },
      "earth-genasi": { name: "Earth Genasi", traits: ["Earth Walk", "Merge with Stone"], source: "2014", srd: false },
      "fire-genasi":  { name: "Fire Genasi", traits: ["Darkvision", "Fire Resistance", "Reach to the Blaze"], source: "2014", srd: false },
      "water-genasi": { name: "Water Genasi", traits: ["Acid Resistance", "Amphibious", "Call to the Wave"], source: "2014", srd: false }
    }
  },
  githyanki: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "gith"],
    traits: ["Astral Knowledge", "Githyanki Psionics", "Psychic Resilience"],
    source: "2014", srd: false,
    subraces: {}
  },
  githzerai: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "gith"],
    traits: ["Githzerai Psionics", "Mental Discipline", "Psychic Resilience"],
    source: "2014", srd: false,
    subraces: {}
  },
  triton: {
    size: "med", speed: 30, darkvision: 60,
    languages: ["common", "primordial"],
    traits: ["Amphibious", "Control Air and Water", "Darkvision", "Emissary of the Sea", "Guardian of the Depths"],
    source: "2014", srd: false,
    subraces: {}
  },
  aarakocra: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common", "auran"],
    traits: ["Flight", "Talons", "Wind Caller"],
    source: "2014", srd: false,
    subraces: {}
  },
  harengon: {
    size: "med", speed: 30, darkvision: 0,
    languages: ["common"],
    traits: ["Hare-Trigger", "Leporine Senses", "Lucky Footwork", "Rabbit Hop"],
    source: "2014", srd: false,
    subraces: {}
  },
  owlin: {
    size: "med", speed: 30, darkvision: 120,
    languages: ["common"],
    traits: ["Darkvision", "Flight", "Silent Feathers"],
    source: "2014", srd: false,
    subraces: {}
  }
};

/**
 * Get racial traits for a race, including subrace traits if applicable.
 * @param {string} raceName — e.g. "high elf", "hill dwarf", "human"
 * @returns {{ traits: string[], speed: number, size: string, darkvision: number, languages: string[] }|null}
 */
export function getRaceData(raceName) {
  if (!raceName) return null;
  const name = raceName.toLowerCase().trim();

  // Direct match
  if (RACE_DATA[name]) {
    const r = RACE_DATA[name];
    return { traits: [...r.traits], speed: r.speed, size: r.size, darkvision: r.darkvision, languages: [...r.languages] };
  }

  // Check subraces — e.g. "high elf" → elf.subraces["high-elf"]
  for (const [raceKey, race] of Object.entries(RACE_DATA)) {
    for (const [subKey, sub] of Object.entries(race.subraces || {})) {
      if (sub.name.toLowerCase() === name || subKey === name.replace(/\s+/g, "-")) {
        return {
          traits: [...race.traits, ...sub.traits],
          speed: race.speed,
          size: race.size,
          darkvision: race.darkvision,
          languages: [...race.languages]
        };
      }
    }
    // Also check "high elf" matching "elf" with subrace "high"
    const parts = name.split(/\s+/);
    if (parts.length >= 2 && raceKey === parts[parts.length - 1]) {
      const subName = parts.slice(0, -1).join("-");
      const sub = race.subraces?.[subName] || race.subraces?.[`${subName}-${raceKey}`];
      if (sub) {
        return {
          traits: [...race.traits, ...sub.traits],
          speed: race.speed,
          size: race.size,
          darkvision: race.darkvision,
          languages: [...race.languages]
        };
      }
    }
  }

  return null;
}

/**
 * Get all valid race names (base races + subraces).
 * @param {"2014"|"2024"|"all"} [ruleset="all"]
 * @returns {string[]}
 */
/**
 * Get compendium search name variants for a race.
 * SRD compendiums use formats like "Elf, High" while we use "High Elf".
 * Returns an array of name variants to try when searching compendium packs.
 * @param {string} raceName — e.g. "high elf", "dragonborn", "dark elf (drow)"
 * @returns {string[]} name variants to search
 */
export function getRaceCompendiumNames(raceName) {
  if (!raceName) return [];
  const name = raceName.trim();
  const variants = [name];

  // Strip parenthetical — "Dark Elf (Drow)" → also try "Drow" and "Dark Elf"
  const parenMatch = name.match(/^(.+?)\s*\((.+?)\)$/);
  if (parenMatch) {
    variants.push(parenMatch[1].trim());
    variants.push(parenMatch[2].trim());
  }

  // "High Elf" → "Elf, High"
  const parts = name.replace(/\s*\(.+?\)/, "").trim().split(/\s+/);
  if (parts.length === 2) {
    variants.push(`${parts[1]}, ${parts[0]}`);
  }

  // Also try just the base race — "High Elf" → "Elf"
  for (const [raceKey, race] of Object.entries(RACE_DATA)) {
    for (const [, sub] of Object.entries(race.subraces || {})) {
      if (sub.name.toLowerCase() === name.toLowerCase()) {
        variants.push(raceKey.charAt(0).toUpperCase() + raceKey.slice(1));
        break;
      }
    }
  }

  // Deduplicate
  return [...new Set(variants)];
}

/**
 * Check if a race name is a parent race that has subraces.
 * e.g. "elf" → true, "high elf" → false, "human" → false
 * @param {string} raceName
 * @returns {boolean}
 */
export function raceHasSubraces(raceName) {
  if (!raceName) return false;
  const race = RACE_DATA[raceName.toLowerCase().trim()];
  return race ? Object.keys(race.subraces || {}).length > 0 : false;
}

/**
 * Check if a race name is covered by the SRD (5.1 or 5.2).
 * Checks both base race and subrace entries.
 * @param {string} raceName — e.g. "elf", "high elf", "tabaxi"
 * @returns {boolean}
 */
export function isRaceSRD(raceName) {
  if (!raceName) return false;
  const name = raceName.toLowerCase().trim();

  // Direct base race match
  if (RACE_DATA[name]) return !!RACE_DATA[name].srd;

  // Check subraces — e.g. "high elf" → elf.subraces["high-elf"]
  for (const race of Object.values(RACE_DATA)) {
    for (const [subKey, sub] of Object.entries(race.subraces || {})) {
      if (sub.name.toLowerCase() === name || subKey === name.replace(/\s+/g, "-")) {
        return !!sub.srd && !!race.srd;
      }
    }
  }

  return false;
}

/**
 * Get all valid race names (base races + subraces).
 * @param {"2014"|"2024"|"all"} [ruleset="all"]
 * @returns {string[]}
 */
export function getAllRaces(ruleset = "all") {
  const races = [];
  for (const [, race] of Object.entries(RACE_DATA)) {
    if (ruleset !== "all" && race.source !== ruleset && race.source !== "both") continue;
    // Add subraces if they exist, otherwise add base race
    const subs = Object.values(race.subraces || {})
      .filter(s => ruleset === "all" || s.source === ruleset || s.source === "both");
    if (subs.length) {
      races.push(...subs.map(s => s.name));
    } else {
      // Find the key name — capitalize it
      for (const [key, r] of Object.entries(RACE_DATA)) {
        if (r === race) {
          races.push(key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " "));
          break;
        }
      }
    }
  }
  return races.sort();
}
