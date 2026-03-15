/**
 * Actor JSON parsing, validation, and Foundry Actor document creation.
 * Supports NPC (type:"npc") and Character (type:"character") actors.
 */

import { sanitizeJSON } from '../utils/json-utils.js';
import {
  generateActorJSON, apiGenerateActorName, generateActorImage,
  fixInvalidJSON
} from '../api/openai.js';
import { findCompendiumItem } from '../utils/compendium-utils.js';
import { findSpellByName } from '../utils/spell-utils.js';
import { ensureFolder } from '../utils/file-utils.js';
import { showProgressBar, updateProgressBar, hideProgressBar, resetItemCostTracker } from '../utils/ui-utils.js';
import { validateNPC, validateCharacter } from './actor-validator.js';
import {
  ABILITY_KEYS, abilityMod, normalizeSizeKey, normalizeAbilityKey,
  CLASS_SPELLCASTING_ABILITY, CLASS_HIT_DIE, CLASS_CASTER_TYPE,
  SIZE_HIT_DIE, SKILL_ABILITY_MAP,
  getRaceCompendiumNames, isRaceSRD
} from '../utils/actor-utils.js';
import { applyAdvancements } from '../utils/advancement-utils.js';
import { WEAPON_DEFAULTS } from '../utils/weapon-utils.js';
import { ARMOR_DEFAULTS, parseDescriptionForArmor } from '../utils/armor-utils.js';
import { MAX_HISTORY_ENTRIES } from '../utils/type-keywords.js';

/**
 * @typedef {Object} ActorGenerationResult
 * @property {object} actorData — full Foundry Actor data object ready for Actor.create()
 * @property {object[]} embeddedItems — Item documents to add via createEmbeddedDocuments
 * @property {string|null} portraitPath — saved portrait image path
 * @property {string|null} tokenPath — saved token image path
 * @property {object} validation — { data, corrections, warnings } from validator
 * @property {string} actorType — "npc" or "character"
 */

// ─── JSON Parsing ───

/**
 * Parse raw GPT JSON for an actor, with multi-stage fallback.
 * @param {string} raw — raw JSON from GPT
 * @param {GeneratorConfig} config
 * @returns {Promise<object>} parsed actor data (empty object on total failure)
 */
export async function parseActorJSON(raw, config) {
  if (!raw || typeof raw !== "string") return {};
  console.debug("Raw Actor JSON from GPT:", raw);

  let cleaned = raw.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (err1) {
    console.warn("Could not parse actor JSON; attempting GPT fix:", err1);
    let fixed = await fixInvalidJSON(cleaned, config);
    try {
      return JSON.parse(fixed);
    } catch (err2) {
      console.warn("GPT fix also invalid, trying sanitizer:", err2);
      let sanitized = sanitizeJSON(cleaned);
      try {
        return JSON.parse(sanitized);
      } catch (err3) {
        console.error("All actor JSON parse attempts failed:", err3);
        return {};
      }
    }
  }
}

// ─── Folder Management ───

/**
 * Ensure the actor folder exists in the world.
 * @param {string} folderName — "AI NPCs" or "AI Characters"
 * @param {string} actorType — "npc" or "character"
 * @returns {Promise<string|null>} folder ID, or null
 */
async function ensureActorFolder(folderName, actorType) {
  const existing = game.folders.find(f =>
    f.name === folderName && f.type === "Actor"
  );
  if (existing) return existing.id;

  try {
    const folder = await Folder.create({
      name: folderName,
      type: "Actor",
      color: actorType === "npc" ? "#8b0000" : "#00008b"
    });
    return folder.id;
  } catch (err) {
    console.error("Failed to create actor folder:", err);
    return null;
  }
}

// ─── Embedded Item Construction ───

/**
 * Build weapon Item data from an NPC action.
 * @param {object} action — { name, type, attackType, damage, damageType, reach, range, description }
 * @param {boolean} isDnd5eV4
 * @returns {object} Foundry Item data
 */
function buildWeaponItem(action, isDnd5eV4) {
  const isRanged = action.attackType === "ranged";
  const dmg = parseDamageString(action.damage || "1d4");
  const weaponName = (action.name || "Attack").toLowerCase();

  // Look up PHB defaults for accurate type, properties, weight, cost
  const defaults = WEAPON_DEFAULTS[weaponName];

  const weaponType = defaults
    ? { value: defaults.classification, baseItem: defaults.baseItem }
    : { value: isRanged ? "simpleR" : "simpleM", baseItem: "" };

  const properties = defaults?.properties || [];
  const weight = defaults?.weight ?? 0;
  const cost = defaults?.cost ?? { value: 0, denomination: "gp" };
  const damageType = action.damageType || defaults?.damage?.type || "bludgeoning";
  const denom = defaults?.damage?.denomination ?? (parseInt(dmg.denomination, 10) || 4);
  const dNum = defaults?.damage?.number ?? (dmg.number || 1);

  const range = isRanged
    ? (defaults?.range || parseRangeString(action.range || "80/320 ft."))
    : (defaults?.range || { value: parseReachValue(action.reach), units: "ft" });

  const itemData = {
    name: action.name || "Attack",
    type: "weapon",
    system: {
      description: { value: action.description || `${isRanged ? "Ranged" : "Melee"} Weapon Attack: ${action.damage || "1d4"} ${damageType} damage.`, chat: "" },
      quantity: 1,
      weight: { value: weight, units: "lb" },
      price: cost,
      equipped: true,
      identified: true,
      proficient: 1,
      type: weaponType,
      properties,
      damage: {
        base: {
          types: [damageType],
          number: dNum,
          denomination: denom,
          bonus: "",
          custom: { enabled: false },
          scaling: { mode: "", number: 1 }
        },
        versatile: {
          types: [],
          custom: { enabled: false },
          scaling: { number: 1 }
        }
      },
      range,
      uses: { spent: 0, recovery: [] },
      source: { revision: 1, rules: "2024" },
      identifier: weaponType.baseItem || weaponName.replace(/[^a-z0-9-_\s]/g, "").replace(/\s+/g, "-"),
      unidentified: { description: "" },
      container: null,
      rarity: "",
      attunement: "",
      attuned: false,
      crewed: false,
      ammunition: {},
      armor: {}
    },
    img: isRanged ? "icons/weapons/bows/shortbow-recurve-yellow.webp" : "icons/weapons/swords/greatsword-crossguard-steel.webp"
  };

  // Add mastery if available
  if (defaults?.mastery) {
    itemData.system.mastery = defaults.mastery;
  }

  // dnd5e v4+ uses Activities for attack/damage rolls
  if (isDnd5eV4) {
    const activityId = foundry.utils.randomID();
    const abilityKey = properties.includes("fin") ? "dex" : (isRanged ? "dex" : "str");
    itemData.system.activities = {
      [activityId]: {
        _id: activityId,
        type: "attack",
        name: action.name || "Attack",
        activation: { type: "action", value: 1, override: false },
        attack: {
          ability: abilityKey,
          type: { value: isRanged ? "ranged" : "melee", classification: "weapon" },
          critical: {},
          flat: false
        },
        damage: {
          parts: [{
            number: dNum,
            denomination: denom,
            bonus: dmg.bonus || "",
            types: [damageType],
            custom: { enabled: false },
            scaling: { number: 1 }
          }],
          critical: {},
          includeBase: true
        },
        sort: 0,
        consumption: { scaling: { allowed: false }, spellSlot: true, targets: [] },
        description: {},
        duration: { units: "inst", concentration: false, override: false },
        effects: [],
        range: { units: "self", override: false },
        target: {
          template: { contiguous: false, units: "ft" },
          affects: { choice: false },
          override: false,
          prompt: true
        },
        uses: { spent: 0, recovery: [] }
      }
    };
  } else {
    // v3 legacy format
    itemData.system.actionType = isRanged ? "rwak" : "mwak";
  }

  return itemData;
}

/**
 * Parse limited-use info from a feature name and/or description.
 * Recognizes patterns like "3/Day", "1/Short Rest", "1/Long Rest",
 * "Recharge 5-6", "Recharge 6", "(3/Day)", "2/day".
 * @param {string} name — feature name
 * @param {string} desc — feature description
 * @returns {{max: string, spent: number, recovery: object[]}|null}
 */
export function parseLimitedUses(name, desc) {
  const combined = `${name} ${desc}`.toLowerCase();

  // Match "X/Day" or "X/day" — in name or description
  const dayMatch = combined.match(/(\d+)\s*\/\s*day/i);
  if (dayMatch) {
    return {
      max: dayMatch[1],
      spent: 0,
      recovery: [{ period: "day", type: "recoverAll" }]
    };
  }

  // Match "X/Short Rest" or "X/short rest"
  const srMatch = combined.match(/(\d+)\s*\/\s*short\s*rest/i);
  if (srMatch) {
    return {
      max: srMatch[1],
      spent: 0,
      recovery: [{ period: "sr", type: "recoverAll" }]
    };
  }

  // Match "X/Long Rest" or "X/long rest"
  const lrMatch = combined.match(/(\d+)\s*\/\s*long\s*rest/i);
  if (lrMatch) {
    return {
      max: lrMatch[1],
      spent: 0,
      recovery: [{ period: "lr", type: "recoverAll" }]
    };
  }

  // Match "Recharge X-Y" or "Recharge X" (e.g. "Recharge 5-6", "Recharge 6")
  const rechargeMatch = combined.match(/recharge\s*(\d+)(?:\s*[-–]\s*(\d+))?/i);
  if (rechargeMatch) {
    const low = parseInt(rechargeMatch[1], 10);
    const high = rechargeMatch[2] ? parseInt(rechargeMatch[2], 10) : low;
    return {
      max: "1",
      spent: 0,
      recovery: [{
        period: "recharge",
        type: "formula",
        formula: `1d6>=${low}`
      }]
    };
  }

  return null;
}

/**
 * Build a feat/trait Item data for NPC traits or character features.
 * @param {object} trait — { name, description }
 * @param {"monster"|"class"|"race"} featType
 * @returns {object} Foundry Item data
 */
function buildFeatItem(trait, featType = "monster") {
  const desc = trait.description || "";
  const item = {
    name: trait.name || "Feature",
    type: "feat",
    system: {
      description: { value: desc, chat: "" },
      type: { value: featType, subtype: "" },
      activities: {},
      uses: { spent: 0, recovery: [] },
      advancement: [],
      identifier: (trait.name || "feature").toLowerCase().replace(/[^a-z0-9-_\s]/g, "").replace(/\s+/g, "-"),
      source: { revision: 1, rules: "2024" },
      crewed: false,
      enchant: {},
      prerequisites: { items: [], repeatable: false },
      properties: [],
      requirements: ""
    },
    img: "icons/skills/targeting/target-strike-triple-blue.webp"
  };

  // Parse limited uses from name and description — e.g. "3/Day", "1/Short Rest", "Recharge 5-6"
  const usesInfo = parseLimitedUses(trait.name || "", desc);
  if (usesInfo) {
    item.system.uses = usesInfo;
  }

  // Detect bonus action features from description keywords
  const descLower = desc.toLowerCase();
  if (descLower.includes("bonus action") || descLower.includes("as a bonus")) {
    const activityId = typeof foundry !== "undefined" ? foundry.utils.randomID() : "bonus" + Date.now();
    item.system.activities[activityId] = {
      _id: activityId,
      type: "utility",
      activation: { type: "bonus", value: 1, override: false },
      consumption: { scaling: { allowed: false }, spellSlot: true, targets: [] },
      description: {},
      duration: { units: "inst", concentration: false, override: false },
      effects: [],
      range: { units: "self", override: false },
      target: {
        template: { contiguous: false, units: "ft" },
        affects: { choice: false },
        override: false,
        prompt: true
      },
      uses: { spent: 0, recovery: [] },
      roll: { prompt: false, visible: false },
      sort: 0
    };
  } else if (descLower.includes("reaction") || descLower.includes("as a reaction")) {
    const activityId = typeof foundry !== "undefined" ? foundry.utils.randomID() : "react" + Date.now();
    item.system.activities[activityId] = {
      _id: activityId,
      type: "utility",
      activation: { type: "reaction", value: 1, override: false },
      consumption: { scaling: { allowed: false }, spellSlot: true, targets: [] },
      description: {},
      duration: { units: "inst", concentration: false, override: false },
      effects: [],
      range: { units: "self", override: false },
      target: {
        template: { contiguous: false, units: "ft" },
        affects: { choice: false },
        override: false,
        prompt: true
      },
      uses: { spent: 0, recovery: [] },
      roll: { prompt: false, visible: false },
      sort: 0
    };
  }

  // Build Active Effects from structured mechanical data on racial/background traits
  if (featType === "race" || featType === "background") {
    const effects = buildTraitEffects(trait, item.name);
    if (effects.length) {
      item.effects = effects;
    }
  }

  return item;
}

/**
 * Parse mechanical effects from a racial trait description when structured
 * fields are absent. Falls back to regex extraction from description text.
 * @param {object} trait — { description, acFormula?, resistances?, ... }
 * @returns {object} merged trait with extracted mechanical fields
 */
function extractMechanicsFromDescription(trait) {
  const desc = (trait.description || "").toLowerCase();
  const result = { ...trait };

  // Natural armor: "AC X + Dexterity" or "AC X + your Dexterity modifier"
  if (!result.acFormula) {
    const acMatch = desc.match(/(?:natural armor|natural ac|armor class)[^.]*?(?:ac\s+(?:of\s+)?|equals\s+)?(\d+)\s*\+\s*(?:your\s+)?dex(?:terity)?(?:\s+modifier)?/i)
      || desc.match(/ac\s+(?:of\s+|equals\s+|is\s+)?(\d+)\s*\+\s*(?:your\s+)?dex(?:terity)?(?:\s+modifier)?/i);
    if (acMatch) {
      result.acFormula = `${acMatch[1]} + @abilities.dex.mod`;
    }
  }

  // Damage resistances: "resistant to X damage" or "resistance to X damage"
  if (!result.resistances?.length) {
    const resMatch = desc.match(/resistan(?:t|ce)\s+to\s+([\w,\s]+?)\s+damage/i);
    if (resMatch) {
      result.resistances = resMatch[1].split(/[,\s]+and\s+|,\s*/i)
        .map(r => r.trim().toLowerCase())
        .filter(r => r);
    }
  }

  // Damage immunities: "immune to X damage" or "immunity to X damage"
  if (!result.immunities?.length) {
    const immMatch = desc.match(/immun(?:e|ity)\s+to\s+([\w,\s]+?)\s+damage/i);
    if (immMatch) {
      result.immunities = immMatch[1].split(/[,\s]+and\s+|,\s*/i)
        .map(r => r.trim().toLowerCase())
        .filter(r => r);
    }
  }

  // Condition immunities: "immune to the X condition" or "can't be X"
  if (!result.conditionImmunities?.length) {
    const condMatch = desc.match(/(?:immune to (?:the )?|cannot be |can'?t be )(charmed|frightened|poisoned|paralyzed|petrified|stunned|blinded|deafened|exhausted)/gi);
    if (condMatch) {
      result.conditionImmunities = condMatch.map(m =>
        m.replace(/(?:immune to (?:the )?|cannot be |can'?t be )/i, "").trim().toLowerCase()
      );
    }
  }

  // Darkvision: "darkvision X feet" or "darkvision out to X feet"
  if (!result.darkvision) {
    const dvMatch = desc.match(/darkvision[^.]*?(\d+)\s*(?:feet|ft)/i);
    if (dvMatch) {
      result.darkvision = parseInt(dvMatch[1], 10);
    }
  }

  // Speed: "walking speed of X" or "climb speed X" or "swim speed X"
  if (!result.speed) {
    const speedTypes = {};
    const walkMatch = desc.match(/(?:walking|base)\s+speed\s+(?:of\s+)?(\d+)/i);
    if (walkMatch) speedTypes.walk = parseInt(walkMatch[1], 10);
    const climbMatch = desc.match(/climb(?:ing)?\s+speed\s+(?:of\s+)?(\d+)/i);
    if (climbMatch) speedTypes.climb = parseInt(climbMatch[1], 10);
    const swimMatch = desc.match(/swim(?:ming)?\s+speed\s+(?:of\s+)?(\d+)/i);
    if (swimMatch) speedTypes.swim = parseInt(swimMatch[1], 10);
    const flyMatch = desc.match(/fly(?:ing)?\s+speed\s+(?:of\s+)?(\d+)/i);
    if (flyMatch) speedTypes.fly = parseInt(flyMatch[1], 10);
    if (Object.keys(speedTypes).length) result.speed = speedTypes;
  }

  return result;
}

/**
 * Build Active Effects from trait mechanical data (racial or background).
 * First checks for structured fields from AI (acFormula, resistances, etc.),
 * then falls back to regex extraction from the description text.
 * @param {object} trait — trait with optional mechanical fields
 * @param {string} itemName — parent item name for origin label
 * @returns {object[]} array of Active Effect data objects
 */
function buildTraitEffects(trait, itemName) {
  // Merge AI-provided fields with description-extracted fallbacks
  const merged = extractMechanicsFromDescription(trait);

  const OVERRIDE = 5; // CONST.ACTIVE_EFFECT_MODES.OVERRIDE
  const ADD = 2;      // CONST.ACTIVE_EFFECT_MODES.ADD
  const changes = [];

  // Natural armor — sets AC calculation to "custom" with a formula
  // Note: dnd5e v5 "natural" calc returns null for characters; "custom" evaluates the formula correctly
  if (merged.acFormula) {
    changes.push(
      { key: "system.attributes.ac.calc", mode: OVERRIDE, value: "custom", priority: 20 },
      { key: "system.attributes.ac.formula", mode: OVERRIDE, value: String(merged.acFormula), priority: 20 }
    );
  }

  // Damage resistances — e.g. ["fire", "psychic"]
  if (merged.resistances?.length) {
    for (const r of merged.resistances) {
      changes.push({ key: "system.traits.dr.value", mode: ADD, value: r.toLowerCase(), priority: 20 });
    }
  }

  // Damage immunities — e.g. ["poison"]
  if (merged.immunities?.length) {
    for (const i of merged.immunities) {
      changes.push({ key: "system.traits.di.value", mode: ADD, value: i.toLowerCase(), priority: 20 });
    }
  }

  // Condition immunities — e.g. ["poisoned", "charmed"]
  if (merged.conditionImmunities?.length) {
    for (const c of merged.conditionImmunities) {
      changes.push({ key: "system.traits.ci.value", mode: ADD, value: c.toLowerCase(), priority: 20 });
    }
  }

  // Speed overrides — e.g. { walk: 35, swim: 30 }
  if (merged.speed && typeof merged.speed === "object") {
    for (const [moveType, val] of Object.entries(merged.speed)) {
      if (typeof val === "number") {
        changes.push({ key: `system.attributes.movement.${moveType}`, mode: OVERRIDE, value: String(val), priority: 20 });
      }
    }
  }

  // Darkvision — e.g. 60
  if (merged.darkvision && typeof merged.darkvision === "number") {
    changes.push({ key: "system.attributes.senses.darkvision", mode: OVERRIDE, value: String(merged.darkvision), priority: 20 });
  }

  if (!changes.length) return [];

  const effectId = typeof foundry !== "undefined" ? foundry.utils.randomID() : "eff" + Date.now();
  return [{
    _id: effectId,
    name: itemName,
    icon: "icons/skills/targeting/target-strike-triple-blue.webp",
    changes,
    transfer: true,
    disabled: false,
    duration: {},
    origin: null,
    flags: {}
  }];
}

/**
 * Build a class Item stub for characters. Provides level, hit dice, and
 * spellcasting progression so the character sheet displays properly.
 * @param {string} className — e.g. "wizard", "rogue"
 * @param {number} level — character level in this class
 * @param {string|null} subclass — subclass name, if any
 * @returns {object} Foundry Item data (type: "class")
 */
function buildClassItem(className, level, subclass) {
  const cls = className.toLowerCase();
  const hitDie = CLASS_HIT_DIE[cls] || 8;
  const casterType = CLASS_CASTER_TYPE[cls] || "none";
  const spellAbility = CLASS_SPELLCASTING_ABILITY[cls] || "";
  const displayName = className.charAt(0).toUpperCase() + className.slice(1);

  // Map caster type to dnd5e progression keys
  const progressionMap = {
    full: "full", half: "half", third: "third", pact: "pact", none: "none"
  };

  return {
    name: displayName,
    type: "class",
    system: {
      description: { value: "" },
      identifier: cls,
      levels: level,
      hitDice: `d${hitDie}`,
      hitDiceUsed: 0,
      advancement: [],
      spellcasting: {
        progression: progressionMap[casterType] || "none",
        ability: spellAbility || ""
      },
      source: { revision: 1, rules: "2024" }
    },
    img: "icons/svg/book.svg"
  };
}

/**
 * Build a stub spell Item when compendium lookup fails.
 * @param {string} spellName
 * @returns {object} Foundry Item data
 */
function buildStubSpell(spellName) {
  return {
    name: spellName,
    type: "spell",
    system: {
      description: { value: `<p>${spellName} (stub — not found in compendium)</p>` },
      level: 0,
      school: "evo"
    },
    img: "icons/magic/symbols/runes-star-pentagon-blue.webp"
  };
}

/**
 * Build an armor/shield equipment Item from ARMOR_DEFAULTS.
 * @param {string} armorName — e.g. "leather", "studded leather", "shield"
 * @returns {object|null} Foundry Item data, or null if not a known armor
 */
function buildArmorItem(armorName) {
  const armor = parseDescriptionForArmor(armorName);
  if (!armor) return null;

  const isShield = armor.armorType === "shield";
  const displayName = armorName.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  return {
    name: displayName,
    type: "equipment",
    system: {
      description: { value: "", chat: "" },
      proficient: 1,
      quantity: 1,
      weight: { value: armor.weight, units: "lb" },
      price: armor.cost,
      attuned: false,
      identified: true,
      equipped: true,
      rarity: "",
      type: {
        value: isShield ? "shield" : armor.armorType,
        baseItem: armor.baseItem
      },
      properties: armor.stealthDisadvantage ? ["stealthDisadvantage"] : [],
      attunement: "",
      uses: { max: "", spent: 0, recovery: [] },
      armor: {
        value: armor.ac,
        dex: armor.dexCap,
        magicalBonus: null
      },
      strength: armor.strengthRequirement || null,
      activities: {},
      identifier: armor.baseItem,
      unidentified: { description: "" },
      container: null,
      crewed: false,
      source: { revision: 1, rules: "2024" }
    },
    img: isShield
      ? "icons/equipment/shield/heater-crystal-blue.webp"
      : "icons/equipment/chest/breastplate-metal-scaled-grey.webp"
  };
}

/**
 * Build an equipment stub Item when compendium lookup fails.
 * @param {string} itemName
 * @returns {object} Foundry Item data
 */
function buildEquipmentStub(itemName) {
  return {
    name: itemName,
    type: "loot",
    system: {
      description: { value: "" },
      quantity: 1,
      weight: { value: 0 }
    },
    img: "icons/containers/bags/pack-leather-black-brown.webp"
  };
}

/**
 * Parse a damage string like "2d6+3" into components.
 * @param {string} str
 * @returns {{number: number, denomination: string, bonus: string}}
 */
function parseDamageString(str) {
  const match = (str || "").match(/(\d+)d(\d+)([+-]\d+)?/);
  if (!match) return { number: 1, denomination: "4", bonus: "" };
  return {
    number: parseInt(match[1], 10),
    denomination: match[2],
    bonus: match[3] || ""
  };
}

/**
 * Parse a range string like "80/320 ft." into range data.
 * @param {string} str
 * @returns {{value: number, long: number, units: string}}
 */
function parseRangeString(str) {
  const match = (str || "").match(/(\d+)\s*\/\s*(\d+)/);
  if (match) return { value: parseInt(match[1], 10), long: parseInt(match[2], 10), units: "ft" };
  const single = (str || "").match(/(\d+)/);
  if (single) return { value: parseInt(single[1], 10), long: 0, units: "ft" };
  return { value: 80, long: 320, units: "ft" };
}

/**
 * Parse a reach string to a numeric value.
 * @param {string|number} reach
 * @returns {number}
 */
function parseReachValue(reach) {
  if (typeof reach === "number") return reach;
  const match = (String(reach || "")).match(/(\d+)/);
  return match ? parseInt(match[1], 10) : 5;
}

/**
 * Build all embedded items for an NPC from validated data.
 * @param {object} data — validated NPC data
 * @param {boolean} isDnd5eV4
 * @returns {Promise<object[]>} array of Item data objects
 */
async function buildNPCEmbeddedItems(data, isDnd5eV4) {
  const items = [];

  // NPC action/trait names that should NOT match player-class compendium items.
  // These are always custom per-monster (e.g. "Multiattack. The dragon makes three attacks...")
  // and the compendium only has player-class versions with the same name.
  const NPC_COMPENDIUM_SKIP = new Set([
    "multiattack", "extra attack", "spellcasting", "innate spellcasting",
    "legendary resistance"
  ]);

  // Weapons / actions — try compendium first for non-weapon actions
  if (data.actions?.length) {
    for (const action of data.actions) {
      if (action.type === "weapon") {
        items.push(buildWeaponItem(action, isDnd5eV4));
      } else if (NPC_COMPENDIUM_SKIP.has(action.name?.toLowerCase())) {
        items.push(buildFeatItem(action, "monster"));
      } else {
        const match = await findCompendiumItem(action.name, "feat");
        if (match) {
          items.push({ _fromCompendium: true, name: action.name, type: "feat", _stubFallback: buildFeatItem(action, "monster") });
        } else {
          items.push(buildFeatItem(action, "monster"));
        }
      }
    }
  }

  // Traits — try compendium first for SRD traits (e.g. Regeneration, Undead Fortitude)
  if (data.traits?.length) {
    for (const trait of data.traits) {
      if (NPC_COMPENDIUM_SKIP.has(trait.name?.toLowerCase())) {
        items.push(buildFeatItem(trait, "monster"));
      } else {
        const match = await findCompendiumItem(trait.name, "feat");
        if (match) {
          items.push({ _fromCompendium: true, name: trait.name, type: "feat", _stubFallback: buildFeatItem(trait, "monster") });
        } else {
          items.push(buildFeatItem(trait, "monster"));
        }
      }
    }
  }

  // Legendary actions — try compendium first
  if (data.legendaryActions?.length) {
    for (const la of data.legendaryActions) {
      const laName = la.cost > 1 ? `${la.name} (Costs ${la.cost} Actions)` : la.name;
      const laDesc = `${la.description || ""}${la.cost > 1 ? ` (Costs ${la.cost} Actions)` : ""}`;
      const stub = buildFeatItem({ name: laName, description: laDesc }, "monster");
      if (NPC_COMPENDIUM_SKIP.has(la.name?.toLowerCase())) {
        items.push(stub);
      } else {
        const match = await findCompendiumItem(la.name, "feat");
        if (match) {
          items.push({ _fromCompendium: true, name: la.name, type: "feat", _stubFallback: stub });
        } else {
          items.push(stub);
        }
      }
    }
  }

  // Armor / equipment from acType (e.g. "studded leather armor")
  if (data.acType) {
    // Parse out shield mention
    const acTypeLower = data.acType.toLowerCase();
    const hasShield = acTypeLower.includes("shield");
    const armorPart = acTypeLower.replace(/\+?\s*shield/i, "").replace(/,\s*$/, "").trim();

    if (armorPart && armorPart !== "natural armor") {
      const armorItem = buildArmorItem(armorPart);
      if (armorItem) {
        items.push(armorItem);
      } else {
        // Try compendium lookup for the armor
        const match = await findCompendiumItem(armorPart, "equipment");
        if (match) {
          items.push({ _fromCompendium: true, name: armorPart, type: "equipment" });
        }
      }
    }

    if (hasShield) {
      const shieldItem = buildArmorItem("shield");
      if (shieldItem) items.push(shieldItem);
    }
  }

  // Spells — try compendium first, stub if not found
  if (data.spellcasting?.spells?.length) {
    for (const spellName of data.spellcasting.spells) {
      const compendiumMatch = await findCompendiumItem(spellName, "spell");
      if (compendiumMatch) {
        // Get full document from compendium to import
        items.push({ _fromCompendium: true, name: spellName, type: "spell" });
      } else {
        items.push(buildStubSpell(spellName));
      }
    }
  }

  return items;
}

/**
 * Build all embedded items for a Character from validated data.
 * @param {object} data — validated character data
 * @param {boolean} isDnd5eV4
 * @returns {Promise<object[]>} array of Item data objects
 */
async function buildCharacterEmbeddedItems(data, isDnd5eV4) {
  const items = [];

  // ── Class ──
  // Embed a class item so the character gets proper level, hit dice, proficiency, and spell slots.
  // Uses a minimal stub rather than compendium to avoid unresolved advancement complexity.
  const className = data.className || data.class;
  if (className) {
    const classItem = buildClassItem(className, data.level || 1, data.subclass);
    items.push(classItem);
  }

  // ── Species (Race) ──
  // Do NOT embed compendium species/background — their advancements (ASIs, skill grants, feats)
  // cannot be applied programmatically yet. Leave blank so the user can use Foundry's built-in
  // compendium browser wizard (Add Race / Add Background) which handles advancements properly.
  // For non-SRD races, AI generates homebrew racial trait feat items instead.
  if (data.race && !isRaceSRD(data.race)) {
    // Homebrew path: build racial traits as feat items
    if (data.racialTraits?.length) {
      for (const trait of data.racialTraits) {
        items.push(buildFeatItem(trait, "race"));
      }
    }
  }

  // ── Background ──
  // SRD backgrounds are left blank for user to add via Foundry's compendium browser wizard.
  // For non-SRD/homebrew backgrounds, AI generates background trait feat items with Active Effects.
  if (data.backgroundTraits?.length) {
    for (const trait of data.backgroundTraits) {
      items.push(buildFeatItem(trait, "background"));
    }
  }

  // Equipment — try compendium first
  if (data.equipment?.length) {
    for (const equipName of data.equipment) {
      const match = await findCompendiumItem(equipName);
      if (match) {
        items.push({ _fromCompendium: true, name: equipName });
      } else {
        items.push(buildEquipmentStub(equipName));
      }
    }
  }

  // Features
  if (data.features?.length) {
    for (const featName of data.features) {
      const match = await findCompendiumItem(featName, "feat");
      if (match) {
        items.push({ _fromCompendium: true, name: featName, type: "feat" });
      } else {
        items.push(buildFeatItem({ name: featName, description: "" }, "class"));
      }
    }
  }

  // Spells
  if (data.spellcasting?.spells?.length) {
    for (const spellName of data.spellcasting.spells) {
      const match = await findCompendiumItem(spellName, "spell");
      if (match) {
        items.push({ _fromCompendium: true, name: spellName, type: "spell" });
      } else {
        items.push(buildStubSpell(spellName));
      }
    }
  }

  return items;
}

// ─── Foundry Actor Data Builders ───

/**
 * Determine AC calculation mode based on acType.
 * - "natural armor" → calc: "natural", flat: ac
 * - Known armor type (leather, chain mail, etc.) → calc: "default" (Foundry derives from equipped armor items)
 * - Unknown → calc: "flat", flat: ac
 * @param {object} data
 * @returns {object} ac config for system.attributes.ac
 */
function buildACConfig(data) {
  const acType = (data.acType || "").toLowerCase();
  if (acType === "natural armor" || acType === "natural") {
    return { flat: data.ac, calc: "natural" };
  }
  // If it's a known armor type, use "default" so Foundry derives AC from equipped armor items
  const armorPart = acType.replace(/\+?\s*shield/i, "").replace(/,\s*$/, "").trim();
  if (armorPart && parseDescriptionForArmor(armorPart)) {
    return { calc: "default" };
  }
  // Fallback: flat AC
  return { flat: data.ac, calc: "flat" };
}

/**
 * Build full Foundry Actor data for an NPC.
 * @param {object} data — validated NPC data from validateNPC()
 * @param {string|null} portraitPath
 * @param {string|null} tokenPath
 * @param {string|null} folderId
 * @returns {object} Actor.create()-ready data
 */
function buildNPCActorData(data, portraitPath, tokenPath, folderId) {
  const abilities = {};
  for (const key of ABILITY_KEYS) {
    abilities[key] = {
      value: data.abilities[key],
      proficient: data.savingThrows?.includes(key) ? 1 : 0
    };
  }

  const skills = {};
  if (data.skills?.length) {
    for (const sk of data.skills) {
      skills[sk] = { value: 1, ability: SKILL_ABILITY_MAP[sk] || "" }; // 1 = proficient
    }
  }

  const actorData = {
    name: data.name || "Unnamed NPC",
    type: "npc",
    img: portraitPath || "icons/svg/mystery-man.svg",
    folder: folderId || null,
    system: {
      abilities,
      skills,
      attributes: {
        ac: buildACConfig(data),
        hp: {
          value: data.hp,
          max: data.hp,
          temp: 0,
          tempmax: 0,
          formula: data.hitDice
        },
        movement: { ...(data.speed || { walk: 30 }), units: "ft", hover: false },
        senses: { ...(data.senses || {}), units: "ft", special: "" },
        spellcasting: data.spellcasting?.ability || ""
      },
      details: {
        biography: { value: data.description || "" },
        alignment: data.alignment || "unaligned",
        cr: data.cr ?? 1,
        xp: { value: data.xp || 0 },
        type: {
          value: data.creatureType || "humanoid",
          subtype: data.creatureSubtype || ""
        },
        source: { custom: "Bytes AI Foundry", revision: 1, rules: "2024" }
      },
      source: { custom: "Bytes AI Foundry", revision: 1, rules: "2024" },
      currency: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },
      traits: {
        size: data.size || "med",
        languages: { ...(data.languages || { value: [], custom: "" }), communication: {} },
        dr: { ...(data.damageResistances || { value: [], custom: "" }), bypasses: [] },
        di: { ...(data.damageImmunities || { value: [], custom: "" }), bypasses: [] },
        dv: { value: [], custom: "", bypasses: [] },
        dm: { amount: {}, bypasses: [] },
        ci: data.conditionImmunities || { value: [], custom: "" }
      },
      resources: {
        legact: { max: data.legendaryActions?.length || 0, spent: 0 },
        legres: { max: data.legendaryResistances || 0, spent: 0 },
        lair: { value: false, initiative: null, inside: false }
      }
    },
    prototypeToken: {
      name: data.name || "Unnamed NPC",
      texture: { src: tokenPath || portraitPath || "icons/svg/mystery-man.svg" },
      actorLink: false,
      disposition: -1, // hostile
      displayBars: 40, // ALWAYS — show HP bars on hover
      displayName: 20, // OWNER — show name to token owner
      sight: {
        enabled: true,
        range: data.senses?.darkvision || 0,
        visionMode: data.senses?.darkvision ? "darkvision" : "basic",
        angle: 360
      },
      bar1: { attribute: "attributes.hp" }
    }
  };

  // Set spell slots if NPC has spellcasting
  if (data.spellcasting?.slots?.length) {
    actorData.system.spells = {};
    for (let i = 0; i < data.spellcasting.slots.length; i++) {
      const key = `spell${i + 1}`;
      actorData.system.spells[key] = {
        value: data.spellcasting.slots[i],
        max: data.spellcasting.slots[i],
        override: data.spellcasting.slots[i]
      };
    }
  }

  return actorData;
}

/**
 * Build full Foundry Actor data for a Character.
/**
 * Format appearance object into a readable string for Foundry's details.appearance field.
 * @param {object|string|null} appearance
 * @returns {string}
 */
function formatAppearance(appearance) {
  if (!appearance) return "";
  if (typeof appearance === "string") return appearance;
  const parts = [];
  if (appearance.gender) parts.push(appearance.gender);
  if (appearance.race) parts.push(appearance.race);
  if (appearance.age) parts.push(`Age ${appearance.age}`);
  if (appearance.height) parts.push(appearance.height);
  if (appearance.hair) parts.push(`${appearance.hair} hair`);
  if (appearance.eyes) parts.push(`${appearance.eyes} eyes`);
  if (appearance.skin) parts.push(`${appearance.skin} skin`);
  return parts.join(", ");
}

/**
 * @param {object} data — validated character data from validateCharacter()
 * @param {string|null} portraitPath
 * @param {string|null} tokenPath
 * @param {string|null} folderId
 * @returns {object} Actor.create()-ready data
 */
function buildCharacterActorData(data, portraitPath, tokenPath, folderId) {
  const abilities = {};
  for (const key of ABILITY_KEYS) {
    abilities[key] = {
      value: data.abilities[key],
      proficient: data.savingThrows?.includes(key) ? 1 : 0
    };
  }

  const skills = {};
  if (data.skills?.length) {
    for (const sk of data.skills) {
      skills[sk] = { value: 1, ability: SKILL_ABILITY_MAP[sk] || "" }; // 1 = proficient
    }
  }

  const actorData = {
    name: data.name || "Unnamed Character",
    type: "character",
    img: portraitPath || "icons/svg/mystery-man.svg",
    folder: folderId || null,
    system: {
      abilities,
      skills,
      attributes: {
        hp: {
          value: data.hp,
          max: data.hp,
          temp: 0,
          tempmax: 0
        },
        movement: {
          walk: data.speed?.walk || 30,
          burrow: data.speed?.burrow || null,
          climb: data.speed?.climb || null,
          fly: data.speed?.fly || null,
          swim: data.speed?.swim || null,
          units: "ft"
        },
        senses: {
          darkvision: data.senses?.darkvision || 0,
          blindsight: data.senses?.blindsight || 0,
          tremorsense: data.senses?.tremorsense || 0,
          truesight: data.senses?.truesight || 0,
          units: "ft"
        },
        spellcasting: data.spellcasting?.ability || ""
      },
      details: {
        biography: { value: data.description || "" },
        alignment: data.alignment || "neutral",
        race: data.race || "",
        background: data.background || "",
        level: data.level || 1,
        xp: { value: data.xp || 0 },
        appearance: formatAppearance(data.appearance),
        trait: data.personality || "",
        ideal: data.ideal || "",
        bond: data.bond || "",
        flaw: data.flaw || "",
        source: { custom: "Bytes AI Foundry" }
      },
      traits: {
        size: data.size || "med",
        languages: data.languages || { value: [], custom: "" }
      }
    },
    prototypeToken: {
      name: data.name || "Unnamed Character",
      texture: { src: tokenPath || portraitPath || "icons/svg/mystery-man.svg" },
      actorLink: true,
      disposition: 1, // friendly
      displayBars: 40, // ALWAYS
      displayName: 20, // OWNER
      sight: data.senses?.darkvision
        ? { enabled: true, visionMode: "darkvision", range: data.senses.darkvision }
        : { enabled: true },
      bar1: { attribute: "attributes.hp" }
    }
  };

  // Spell slots
  if (data.spellcasting?.slots?.length) {
    actorData.system.spells = {};
    for (let i = 0; i < data.spellcasting.slots.length; i++) {
      const key = `spell${i + 1}`;
      actorData.system.spells[key] = {
        value: data.spellcasting.slots[i],
        max: data.spellcasting.slots[i],
        override: data.spellcasting.slots[i]
      };
    }
  }

  // Pact magic (warlock)
  if (data.spellcasting?.pactSlots) {
    actorData.system.spells = actorData.system.spells || {};
    actorData.system.spells.pact = {
      value: data.spellcasting.pactSlots,
      max: data.spellcasting.pactSlots,
      override: data.spellcasting.pactSlots,
      level: data.spellcasting.pactLevel || 1
    };
  }

  return actorData;
}

// ─── Compendium Import Helper ───

/**
 * Resolve compendium-sourced items by importing from packs.
 * Items with _fromCompendium flag are resolved; others pass through.
 * @param {object[]} itemList
 * @returns {Promise<object[]>} resolved Item data objects
 */
async function resolveCompendiumItems(itemList) {
  const resolved = [];

  for (const item of itemList) {
    if (!item._fromCompendium) {
      resolved.push(item);
      continue;
    }

    const nameVariants = item._nameVariants || [item.name];

    // Search compendium packs for the item
    let found = false;
    for (const pack of game.packs) {
      if (pack.metadata.type !== "Item") continue;
      try {
        const index = await pack.getIndex({ fields: ["name", "type"] });
        const match = index.find(e => {
          if (item.type && e.type !== item.type) return false;
          return nameVariants.some(v => e.name.toLowerCase() === v.toLowerCase());
        });
        if (match) {
          const doc = await pack.getDocument(match._id);
          const obj = doc.toObject();

          // Auto-equip weapons, armor, and shields so AC/attacks work immediately
          if (obj.type === "weapon" || obj.type === "equipment") {
            obj.system.equipped = true;
          }

          resolved.push(obj);
          found = true;
          break;
        }
      } catch (err) {
        console.warn(`resolveCompendiumItems: skip ${pack.collection}:`, err.message);
      }
    }

    if (!found) {
      // Origin items (race/background) that fail compendium lookup are silently skipped —
      // the character still works, just without the species/background item embedded
      if (item._isOrigin) {
        console.warn(`resolveCompendiumItems: Could not find ${item.type} "${item.name}" in compendium — skipping origin item`);
        continue;
      }
      // NPC feat items carry a pre-built stub as fallback
      if (item._stubFallback) {
        resolved.push(item._stubFallback);
      } else if (item.type === "spell") {
        resolved.push(buildStubSpell(item.name));
      } else {
        resolved.push(buildEquipmentStub(item.name));
      }
    }
  }

  return resolved;
}

// ─── Main Generation Pipeline ───

/**
 * Generate a complete actor: AI JSON → validate → images → build data.
 * This is the main entry point for actor generation.
 *
 * @param {string} prompt — user's actor description
 * @param {GeneratorConfig} config
 * @param {"npc"|"character"} actorType
 * @param {object} [options={}] — { cr, creatureType, level, className, race, nameOverride }
 * @returns {Promise<ActorGenerationResult|null>} result ready for preview, or null on failure
 */
export async function generateActorData(prompt, config, actorType, options = {}) {
  if (!prompt || !config) return null;

  resetItemCostTracker();

  try {
    showProgressBar();
    updateProgressBar(5);

    // Step 1: Generate name (unless overridden)
    let actorName = options.nameOverride || null;
    if (!actorName) {
      updateProgressBar(8);
      actorName = await apiGenerateActorName(prompt, actorType, config);
      if (actorName) actorName = actorName.replace(/["']/g, "").trim();
    }
    if (!actorName) actorName = actorType === "npc" ? "Unnamed NPC" : "Unnamed Character";
    updateProgressBar(15);

    // Step 2: Generate JSON stat block via AI
    const rawJSON = await generateActorJSON(
      `${actorName}. ${prompt}`,
      config,
      actorType,
      options
    );
    updateProgressBar(40);

    if (!rawJSON) {
      ui.notifications.error("AI returned no data for actor generation.");
      hideProgressBar();
      return null;
    }

    // Step 3: Parse JSON
    const parsed = await parseActorJSON(rawJSON, config);
    if (!parsed || Object.keys(parsed).length === 0) {
      ui.notifications.error("Failed to parse actor JSON from AI.");
      hideProgressBar();
      return null;
    }

    // Ensure the AI name is used
    if (!parsed.name) parsed.name = actorName;
    // Pass through user options the validator needs
    if (options.ruleset) parsed.ruleset = options.ruleset;
    if (options.subclass && !parsed.subclass) parsed.subclass = options.subclass;
    updateProgressBar(45);

    // Step 4: Validate and fix
    const validation = actorType === "npc"
      ? validateNPC(parsed)
      : validateCharacter(parsed);
    updateProgressBar(50);

    const data = validation.data;
    data.name = parsed.name || actorName;

    // Step 5: Generate portrait image
    const portraitDesc = buildImageDescription(data, actorType);
    const portraitPath = await generateActorImage(portraitDesc, "portrait", config);
    updateProgressBar(70);

    // Step 6: Generate token image
    const tokenPath = await generateActorImage(portraitDesc, "token", config);
    updateProgressBar(85);

    // Step 7: Build embedded items
    const embeddedItems = actorType === "npc"
      ? await buildNPCEmbeddedItems(data, config.isDnd5eV4)
      : await buildCharacterEmbeddedItems(data, config.isDnd5eV4);
    updateProgressBar(90);

    // Step 8: Build the actor folder
    const folderName = actorType === "npc" ? "AI NPCs" : "AI Characters";
    const folderId = await ensureActorFolder(folderName, actorType);

    // Step 9: Build actor data
    const actorData = actorType === "npc"
      ? buildNPCActorData(data, portraitPath, tokenPath, folderId)
      : buildCharacterActorData(data, portraitPath, tokenPath, folderId);
    updateProgressBar(95);

    hideProgressBar();

    return {
      actorData,
      embeddedItems,
      portraitPath,
      tokenPath,
      validation,
      actorType,
      prompt,
      options
    };
  } catch (err) {
    console.error("Actor generation failed:", err);
    ui.notifications.error(`Actor generation failed: ${err.message}`);
    hideProgressBar();
    return null;
  }
}

/**
 * Create the Foundry Actor document from generation results.
 * @param {ActorGenerationResult} result
 * @returns {Promise<Actor|null>} created Actor, or null on failure
 */
export async function createActorFromData(result) {
  if (!result?.actorData) return null;

  try {
    // Create the base Actor
    const actor = await Actor.create(result.actorData);
    if (!actor) {
      ui.notifications.error("Failed to create actor document.");
      return null;
    }

    // Resolve compendium items and create embedded documents
    if (result.embeddedItems?.length) {
      const resolvedItems = await resolveCompendiumItems(result.embeddedItems);
      if (resolvedItems.length) {
        await actor.createEmbeddedDocuments("Item", resolvedItems);
      }
    }

    // Apply advancements for characters (fills species/background advancement values,
    // imports granted sub-items, links system.details.race/background to item IDs)
    if (result.actorType === "character" && result.validation?.data) {
      const characterLevel = result.options?.level || result.validation.data.level || 1;
      try {
        await applyAdvancements(actor, result.validation.data, characterLevel);
      } catch (err) {
        console.warn("Failed to apply advancements:", err.message);
      }
    }

    // Record in history
    recordActorHistory(result, actor);

    ui.notifications.info(`Created ${result.actorType === "npc" ? "NPC" : "Character"}: ${actor.name}`);
    return actor;
  } catch (err) {
    console.error("Error creating actor:", err);
    ui.notifications.error(`Error creating actor: ${err.message}`);
    return null;
  }
}

// ─── Regen Helpers ───

/**
 * Regenerate just the actor name.
 * @param {string} prompt
 * @param {"npc"|"character"} actorType
 * @param {GeneratorConfig} config
 * @returns {Promise<string|null>}
 */
export async function regenActorName(prompt, actorType, config) {
  const name = await apiGenerateActorName(prompt, actorType, config);
  return name ? name.replace(/["']/g, "").trim() : null;
}

/**
 * Regenerate just the portrait image.
 * @param {string} description — image description
 * @param {GeneratorConfig} config
 * @returns {Promise<string|null>}
 */
export async function regenPortrait(description, config) {
  return generateActorImage(description, "portrait", config);
}

/**
 * Regenerate just the token image.
 * @param {string} description — image description
 * @param {GeneratorConfig} config
 * @returns {Promise<string|null>}
 */
export async function regenToken(description, config) {
  return generateActorImage(description, "token", config);
}

/**
 * Regenerate just the stat block (re-run AI + validate).
 * @param {string} prompt
 * @param {GeneratorConfig} config
 * @param {"npc"|"character"} actorType
 * @param {object} options
 * @returns {Promise<object|null>} validation result { data, corrections, warnings }
 */
export async function regenStats(prompt, config, actorType, options = {}) {
  const rawJSON = await generateActorJSON(prompt, config, actorType, options);
  if (!rawJSON) return null;
  const parsed = await parseActorJSON(rawJSON, config);
  if (!parsed || Object.keys(parsed).length === 0) return null;
  if (options.ruleset) parsed.ruleset = options.ruleset;
  if (options.subclass && !parsed.subclass) parsed.subclass = options.subclass;
  return actorType === "npc" ? validateNPC(parsed) : validateCharacter(parsed);
}

// ─── Utilities ───

/**
 * Build a text description for image generation from actor data.
 * @param {object} data — validated actor data
 * @param {"npc"|"character"} actorType
 * @returns {string}
 */
function buildImageDescription(data, actorType) {
  const parts = [data.name || "A fantasy creature"];

  if (actorType === "npc") {
    if (data.size) parts.push(data.size);
    if (data.creatureType) parts.push(data.creatureType);
    if (data.creatureSubtype) parts.push(`(${data.creatureSubtype})`);
  } else {
    if (data.race) parts.push(data.race);
    if (data.className || data.class) parts.push(data.className || data.class);
    if (data.appearance) {
      const app = data.appearance;
      if (app.gender) parts.push(app.gender);
      if (app.hair) parts.push(`${app.hair} hair`);
      if (app.eyes) parts.push(`${app.eyes} eyes`);
    }
  }

  return parts.join(", ");
}

/**
 * Record an actor in session history.
 * @param {ActorGenerationResult} result
 * @param {Actor} actor
 */
function recordActorHistory(result, actor) {
  if (!game.chatGPTItemGenerator?.history) return;

  const entry = {
    objectType: "actor",
    actorType: result.actorType,
    name: actor.name,
    id: actor.id,
    uuid: actor.uuid,
    img: actor.img,
    timestamp: Date.now(),
    prompt: result.prompt || "",
    corrections: result.validation?.corrections || [],
    warnings: result.validation?.warnings || [],
    cr: result.validation?.data?.cr,
    level: result.validation?.data?.level
  };

  game.chatGPTItemGenerator.history.unshift(entry);
  if (game.chatGPTItemGenerator.history.length > MAX_HISTORY_ENTRIES) {
    game.chatGPTItemGenerator.history.length = MAX_HISTORY_ENTRIES;
  }
}
