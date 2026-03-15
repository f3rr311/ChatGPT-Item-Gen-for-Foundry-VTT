/**
 * Actor rule validation.
 * Runs after AI generates JSON — validates and auto-fixes derived stats
 * (HP, proficiency, spell slots, AC, skill mappings, etc.).
 */

import {
  ABILITY_KEYS, abilityMod, proficiencyFromCR, proficiencyFromLevel,
  normalizeSizeKey, SIZE_HIT_DIE, CLASS_HIT_DIE,
  normalizeSkillKey, normalizeAbilityKey, normalizeLanguageKey,
  normalizeDamageType, normalizeConditionType, isValidCreatureType,
  computeExpectedAC, snapToValidCR, CR_XP_TABLE, LEVEL_XP_TABLE,
  parseHitDiceFormula, computeAverageHP, buildHitDiceFormula,
  getSpellSlots, getNPCSpellSlots, PACT_SLOTS,
  CLASS_CASTER_TYPE, CLASS_SAVING_THROWS, CLASS_SPELLCASTING_ABILITY,
  CLASS_HIT_DIE as _CLASS_HD,
  resolveSubclass, getSubclassLevel, getRaceData
} from '../utils/actor-utils.js';

/**
 * @typedef {Object} ActorValidationResult
 * @property {object} data — corrected/normalized data object
 * @property {string[]} corrections — human-readable list of auto-corrections made
 * @property {string[]} warnings — issues that could not be auto-fixed
 */

// ─── Shared Helpers ───

/**
 * Clamp ability scores to valid range.
 * @param {object} abilities — { str, dex, ... } with numeric values
 * @param {number} min
 * @param {number} max
 * @param {string[]} corrections
 * @returns {object} clamped abilities
 */
function clampAbilities(abilities, min, max, corrections) {
  const result = {};
  for (const key of ABILITY_KEYS) {
    let val = abilities?.[key];
    if (typeof val !== "number" || isNaN(val)) {
      val = 10;
      corrections.push(`${key.toUpperCase()} was missing or invalid, defaulted to 10`);
    }
    if (val < min) {
      corrections.push(`${key.toUpperCase()} ${val} clamped to minimum ${min}`);
      val = min;
    } else if (val > max) {
      corrections.push(`${key.toUpperCase()} ${val} clamped to maximum ${max}`);
      val = max;
    }
    result[key] = val;
  }
  return result;
}

/**
 * Normalize a list of skill names to dnd5e keys.
 * @param {string[]} skills
 * @param {string[]} corrections
 * @returns {string[]} valid dnd5e skill keys
 */
function normalizeSkills(skills, corrections) {
  if (!Array.isArray(skills)) return [];
  const result = [];
  for (const s of skills) {
    const key = normalizeSkillKey(s);
    if (key) {
      if (!result.includes(key)) result.push(key);
    } else {
      corrections.push(`Unrecognized skill "${s}" dropped`);
    }
  }
  return result;
}

/**
 * Normalize saving throw ability names to dnd5e keys.
 * @param {string[]} saves
 * @param {string[]} corrections
 * @returns {string[]} valid ability keys
 */
function normalizeSavingThrows(saves, corrections) {
  if (!Array.isArray(saves)) return [];
  const result = [];
  for (const s of saves) {
    const key = normalizeAbilityKey(s);
    if (key) {
      if (!result.includes(key)) result.push(key);
    } else {
      corrections.push(`Unrecognized saving throw "${s}" dropped`);
    }
  }
  return result;
}

/**
 * Normalize a list of language names. Known → value array; unknown → custom string.
 * @param {string[]} languages
 * @param {string[]} corrections
 * @returns {{ value: string[], custom: string }}
 */
function normalizeLanguages(languages, corrections) {
  const value = [];
  const custom = [];
  if (!Array.isArray(languages)) return { value: ["common"], custom: "" };
  for (const lang of languages) {
    const key = normalizeLanguageKey(lang);
    if (key) {
      if (!value.includes(key)) value.push(key);
    } else {
      custom.push(lang);
      corrections.push(`Language "${lang}" not in standard list, added to custom`);
    }
  }
  if (value.length === 0 && custom.length === 0) value.push("common");
  return { value, custom: custom.join(", ") };
}

/**
 * Normalize a list of damage type strings.
 * @param {string[]} types
 * @param {string} label — for correction messages (e.g. "Damage resistance")
 * @param {string[]} corrections
 * @returns {{ value: string[], custom: string }}
 */
function normalizeDamageList(types, label, corrections) {
  const value = [];
  const custom = [];
  if (!Array.isArray(types)) return { value: [], custom: "" };
  for (const t of types) {
    const key = normalizeDamageType(t);
    if (key) {
      if (!value.includes(key)) value.push(key);
    } else {
      custom.push(t);
      corrections.push(`${label} "${t}" not standard, added to custom`);
    }
  }
  return { value, custom: custom.join(", ") };
}

/**
 * Normalize a list of condition type strings.
 * @param {string[]} types
 * @param {string[]} corrections
 * @returns {{ value: string[], custom: string }}
 */
function normalizeConditionList(types, corrections) {
  const value = [];
  const custom = [];
  if (!Array.isArray(types)) return { value: [], custom: "" };
  for (const t of types) {
    const key = normalizeConditionType(t);
    if (key) {
      if (!value.includes(key)) value.push(key);
    } else {
      custom.push(t);
      corrections.push(`Condition immunity "${t}" not standard, added to custom`);
    }
  }
  return { value, custom: custom.join(", ") };
}

/**
 * Normalize senses object.
 * @param {object} senses — AI output (e.g. { darkvision: 60, blindsight: 10 })
 * @returns {object} normalized senses for Foundry
 */
function normalizeSenses(senses) {
  if (!senses || typeof senses !== "object") return {};
  return {
    darkvision: Math.max(0, parseInt(senses.darkvision) || 0),
    blindsight: Math.max(0, parseInt(senses.blindsight) || 0),
    tremorsense: Math.max(0, parseInt(senses.tremorsense) || 0),
    truesight: Math.max(0, parseInt(senses.truesight) || 0)
  };
}

/**
 * Normalize speed object.
 * @param {object} speed — AI output (e.g. { walk: 30, fly: 60 })
 * @returns {object} normalized speed for Foundry
 */
function normalizeSpeed(speed) {
  if (!speed || typeof speed !== "object") return { walk: 30 };
  return {
    walk: Math.max(0, parseInt(speed.walk) || 30),
    burrow: parseInt(speed.burrow) || null,
    climb: parseInt(speed.climb) || null,
    fly: parseInt(speed.fly) || null,
    swim: parseInt(speed.swim) || null,
    hover: !!speed.hover
  };
}

// ─── NPC Validation ───

/**
 * Validate and fix an AI-generated NPC stat block.
 * @param {object} parsed — raw parsed AI JSON (NPC schema)
 * @returns {ActorValidationResult}
 */
export function validateNPC(parsed) {
  const corrections = [];
  const warnings = [];

  if (!parsed || typeof parsed !== "object") {
    return { data: {}, corrections: ["Input was empty or invalid"], warnings: [] };
  }

  const data = { ...parsed };

  // ── CR ──
  if (data.cr != null) {
    const snapped = snapToValidCR(Number(data.cr));
    if (snapped !== Number(data.cr)) {
      corrections.push(`CR ${data.cr} snapped to nearest valid CR ${snapped}`);
    }
    data.cr = snapped;
  } else {
    data.cr = 1;
    corrections.push("CR was missing, defaulted to 1");
  }

  // ── Proficiency (derived from CR, never trust AI) ──
  data.proficiencyBonus = proficiencyFromCR(data.cr);

  // ── Ability Scores (1-30 for NPCs) ──
  data.abilities = clampAbilities(data.abilities, 1, 30, corrections);

  // ── Size ──
  data.size = normalizeSizeKey(data.size);

  // ── Creature Type ──
  const creatureType = data.creatureType?.toLowerCase().trim() ?? "humanoid";
  if (!isValidCreatureType(creatureType)) {
    warnings.push(`Creature type "${data.creatureType}" not in standard list`);
  }
  data.creatureType = creatureType;

  // ── Hit Dice & HP ──
  const conMod = abilityMod(data.abilities.con);
  if (data.hitDice) {
    const hdParsed = parseHitDiceFormula(data.hitDice);
    if (hdParsed) {
      // Verify die size matches creature size
      const expectedDie = SIZE_HIT_DIE[data.size] ?? 8;
      if (hdParsed.die !== expectedDie) {
        corrections.push(`Hit die d${hdParsed.die} doesn't match size ${data.size} (expected d${expectedDie}), corrected`);
        data.hitDice = buildHitDiceFormula(hdParsed.count, data.size, conMod);
      }
      // Verify CON bonus matches
      const expectedBonus = hdParsed.count * conMod;
      if (hdParsed.bonus !== expectedBonus) {
        corrections.push(`Hit dice CON bonus ${hdParsed.bonus} corrected to ${expectedBonus} (${hdParsed.count} HD × CON mod ${conMod})`);
        data.hitDice = buildHitDiceFormula(hdParsed.count, data.size, conMod);
      }
    } else {
      warnings.push(`Could not parse hit dice formula "${data.hitDice}"`);
    }
  }

  // Compute expected HP from formula and compare
  const expectedHP = computeAverageHP(data.hitDice);
  if (expectedHP != null && data.hp != null) {
    const diff = Math.abs(data.hp - expectedHP);
    if (diff > expectedHP * 0.15) {
      corrections.push(`HP ${data.hp} differs significantly from formula average ${expectedHP}, corrected`);
      data.hp = expectedHP;
    }
  } else if (expectedHP != null) {
    data.hp = expectedHP;
  } else if (data.hp == null) {
    data.hp = 10;
    corrections.push("HP was missing, defaulted to 10");
  }

  // ── AC ──
  if (data.ac == null) {
    data.ac = 10 + abilityMod(data.abilities.dex);
    corrections.push(`AC was missing, computed from DEX as ${data.ac}`);
  }
  const expectedAC = computeExpectedAC(
    data.acType,
    abilityMod(data.abilities.dex),
    data.acType?.toLowerCase().includes("shield")
  );
  if (expectedAC != null && Math.abs(data.ac - expectedAC) > 2) {
    warnings.push(`AC ${data.ac} doesn't match expected ${expectedAC} for "${data.acType}"`);
  }

  // ── Skills ──
  data.skills = normalizeSkills(data.skills, corrections);

  // ── Saving Throws ──
  data.savingThrows = normalizeSavingThrows(data.savingThrows, corrections);

  // ── Languages ──
  data.languages = normalizeLanguages(data.languages, corrections);

  // ── Damage/Condition traits ──
  data.damageResistances = normalizeDamageList(data.damageResistances, "Damage resistance", corrections);
  data.damageImmunities = normalizeDamageList(data.damageImmunities, "Damage immunity", corrections);
  data.damageVulnerabilities = normalizeDamageList(data.damageVulnerabilities ?? data.dv ?? [], "Damage vulnerability", corrections);
  data.conditionImmunities = normalizeConditionList(data.conditionImmunities, corrections);

  // ── Senses ──
  data.senses = normalizeSenses(data.senses);

  // ── Speed ──
  data.speed = normalizeSpeed(data.speed);

  // ── Spellcasting ──
  if (data.spellcasting && data.spellcasting.ability) {
    const scAbility = normalizeAbilityKey(data.spellcasting.ability);
    if (!scAbility) {
      corrections.push(`Spellcasting ability "${data.spellcasting.ability}" not recognized, defaulted to "int"`);
      data.spellcasting.ability = "int";
    } else {
      data.spellcasting.ability = scAbility;
    }

    // Compute expected spell slots
    const casterLevel = parseInt(data.spellcasting.level) || Math.max(1, Math.ceil(data.cr));
    data.spellcasting.level = casterLevel;
    data.spellcasting.slots = getNPCSpellSlots(casterLevel);
  }

  // ── XP ──
  data.xp = CR_XP_TABLE[data.cr] ?? 0;

  // ── Alignment ──
  if (!data.alignment) data.alignment = "unaligned";

  // ── Description ──
  if (!data.description) {
    data.description = "";
    warnings.push("No description/biography provided");
  }

  // ── Actions validation ──
  if (Array.isArray(data.actions)) {
    for (const action of data.actions) {
      if (action.damageType) {
        const normalized = normalizeDamageType(action.damageType);
        if (!normalized) {
          warnings.push(`Action "${action.name}" has unrecognized damage type "${action.damageType}"`);
        } else {
          action.damageType = normalized;
        }
      }
    }
  }

  return { data, corrections, warnings };
}

// ─── Character Validation ───

/**
 * Validate and fix an AI-generated Character stat block.
 * @param {object} parsed — raw parsed AI JSON (Character schema)
 * @returns {ActorValidationResult}
 */
export function validateCharacter(parsed) {
  const corrections = [];
  const warnings = [];

  if (!parsed || typeof parsed !== "object") {
    return { data: {}, corrections: ["Input was empty or invalid"], warnings: [] };
  }

  const data = { ...parsed };

  // ── Level ──
  data.level = Math.max(1, Math.min(20, parseInt(data.level) || 1));
  if (data.level !== parseInt(parsed.level)) {
    corrections.push(`Level clamped to ${data.level}`);
  }

  // ── Class normalization ──
  const className = data.class?.toLowerCase().trim() ?? "";
  data.classNormalized = className;

  // ── Subclass ──
  const subLevel = getSubclassLevel(className);
  if (data.level >= subLevel) {
    if (data.subclass) {
      const resolved = resolveSubclass(className, data.subclass, data.ruleset || "all");
      if (resolved) {
        if (resolved !== data.subclass) {
          corrections.push(`Subclass "${data.subclass}" normalized to "${resolved}"`);
        }
        data.subclass = resolved;
      } else {
        warnings.push(`Subclass "${data.subclass}" is not a recognized subclass for ${className}`);
      }
    } else {
      warnings.push(`Level ${data.level} ${className} should have a subclass (chosen at level ${subLevel})`);
    }
  }

  // ── Race traits ──
  if (data.race) {
    const raceInfo = getRaceData(data.race);
    if (raceInfo) {
      // Ensure racial speed is correct
      if (!data.speed || typeof data.speed !== "object") {
        data.speed = { walk: raceInfo.speed };
      }
      // Ensure racial darkvision is accounted for
      if (raceInfo.darkvision && (!data.senses || !data.senses.darkvision)) {
        if (!data.senses) data.senses = {};
        data.senses.darkvision = raceInfo.darkvision;
        corrections.push(`Added racial darkvision ${raceInfo.darkvision} ft. from ${data.race}`);
      }
      // Ensure size from race
      if (!data.size) {
        data.size = raceInfo.size;
      }
    }
  }

  // ── Proficiency (derived from level) ──
  data.proficiencyBonus = proficiencyFromLevel(data.level);

  // ── Ability Scores (1-20 for characters) ──
  data.abilities = clampAbilities(data.abilities, 1, 20, corrections);

  // ── HP ──
  const conMod = abilityMod(data.abilities.con);
  const hitDie = CLASS_HIT_DIE[className] ?? 8;
  if (data.level === 1) {
    data.expectedHP = hitDie + conMod;
  } else {
    // Level 1 max + remaining levels use PHB fixed value (die/2 + 1)
    const avgPerLevel = (hitDie / 2) + 1;
    data.expectedHP = Math.floor((hitDie + conMod) + (data.level - 1) * (avgPerLevel + conMod));
  }
  if (data.hp != null) {
    const diff = Math.abs(data.hp - data.expectedHP);
    if (diff > data.expectedHP * 0.2) {
      corrections.push(`HP ${data.hp} differs from expected ${data.expectedHP} for L${data.level} ${className || "unknown"}, corrected`);
      data.hp = data.expectedHP;
    }
  } else {
    data.hp = data.expectedHP;
    corrections.push(`HP computed as ${data.hp} for L${data.level} ${className || "unknown"}`);
  }

  // ── XP ──
  data.xp = LEVEL_XP_TABLE[data.level] ?? 0;

  // ── Skills ──
  data.skills = normalizeSkills(data.skills, corrections);

  // ── Saving Throws ──
  if (data.savingThrows && data.savingThrows.length > 0) {
    data.savingThrows = normalizeSavingThrows(data.savingThrows, corrections);
  } else if (CLASS_SAVING_THROWS[className]) {
    data.savingThrows = [...CLASS_SAVING_THROWS[className]];
    corrections.push(`Saving throws defaulted to ${className} class defaults: ${data.savingThrows.join(", ").toUpperCase()}`);
  } else {
    data.savingThrows = [];
  }

  // ── Spellcasting ──
  if (data.spellcasting && (data.spellcasting.ability || CLASS_SPELLCASTING_ABILITY[className])) {
    const scAbility = normalizeAbilityKey(data.spellcasting.ability) || CLASS_SPELLCASTING_ABILITY[className];
    data.spellcasting.ability = scAbility || "";

    const casterType = CLASS_CASTER_TYPE[className];
    if (casterType === "pact") {
      const pactInfo = PACT_SLOTS[data.level];
      if (pactInfo) {
        data.spellcasting.pactSlots = pactInfo.slots;
        data.spellcasting.pactLevel = pactInfo.level;
      }
      data.spellcasting.slots = [];
    } else {
      data.spellcasting.slots = getSpellSlots(className, data.level);
    }
  }

  // ── Languages ──
  data.languages = normalizeLanguages(data.languages ?? ["common"], corrections);

  // ── Alignment ──
  if (!data.alignment) data.alignment = "neutral";

  // ── Description ──
  if (!data.description) {
    data.description = "";
    warnings.push("No description/biography provided");
  }

  // ── Appearance defaults ──
  if (!data.appearance || typeof data.appearance !== "object") {
    data.appearance = {};
  }

  return { data, corrections, warnings };
}
