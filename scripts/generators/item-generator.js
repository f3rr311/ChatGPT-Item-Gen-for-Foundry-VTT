/**
 * Item JSON parsing, mismatch fixing, and item document creation.
 * Supports dnd5e v3.x, v4.x, and v5.x data models.
 */

import { sanitizeJSON } from '../utils/json-utils.js';
import { fixInvalidJSON, generateItemJSON, generateItemImage, generateMagicalProperties } from '../api/openai.js';
import { transformWeaponDamage, transformWeaponProperties, buildVersatileDamage, parseDescriptionBonuses, PROPERTY_ABBREV_MAP, parseDamageFormula } from '../utils/weapon-utils.js';
import { parseDescriptionForArmor } from '../utils/armor-utils.js';
import {
  normalizeSchool, normalizeActivation, normalizeDuration,
  normalizeRange, normalizeTarget, normalizeComponents,
  normalizeMaterials, transformSpellDamage, buildSpellScaling,
  parseSpellDescription, findSpellByName, SPELL_ACTION_TYPE_MAP, ABILITY_MAP
} from '../utils/spell-utils.js';
import { showProgressBar, updateProgressBar, hideProgressBar } from '../utils/ui-utils.js';
import {
  buildAttackActivity, buildSaveActivity, buildDamageActivity,
  buildHealActivity, buildUtilityActivity, buildCastActivity,
  buildDamagePart, buildActiveEffect, mapEffectChange, durationToSeconds
} from '../utils/activity-utils.js';
import { generateItemName, ensureItemName } from './name-generator.js';
import { validateAndEnrichItem } from '../utils/description-validator.js';
import { validateAgainstCompendium, checkDuplicates, getCompendiumDefaults } from '../utils/compendium-utils.js';

const WEAPON_KEYWORDS = ["sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club", "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul", "staff", "katana"];

/** Word-boundary check to prevent substring false positives (e.g. "ring" in "charging") */
function hasWord(text, word) {
  return new RegExp(`\\b${word}\\b`, 'i').test(text);
}

/** Valid weapon classification codes for dnd5e v4+ */
const VALID_WEAPON_CODES = ["simpleM", "martialM", "simpleR", "martialR"];

/** Item types that should NOT get weight, attunement, or magical properties */
const WEIGHTLESS_TYPES = ["spell", "feat", "background"];
const NO_MAGIC_PROPS_TYPES = ["spell", "feat", "background"];

/**
 * Infer magical bonus from rarity when GPT and description scanning both fail.
 * D&D 5e convention: uncommon=+1, rare=+2, very rare=+3, legendary/artifact=+3.
 * Returns 0 if no bonus is warranted (common or unknown rarity).
 */
function inferMagicalBonusFromRarity(rarity) {
  const r = (rarity || "").toLowerCase();
  const RARITY_BONUS = { "uncommon": 1, "rare": 2, "very rare": 3, "veryrare": 3, "legendary": 3, "artifact": 3 };
  return RARITY_BONUS[r] || 0;
}

/** Consumable detection keywords for fallback type resolution */
const CONSUMABLE_DETECT_KEYWORDS = ["potion", "elixir", "philter", "draught", "scroll", "poison", "toxin", "venom", "ration", "tonic", "salve", "balm", "oil", "brew", "concoction"];

/** Tool detection keywords for fallback type resolution */
const TOOL_DETECT_KEYWORDS = [
  "dice set", "dice game", "gaming set", "playing card", "thieves' tools", "thieves tools", "lockpick",
  "alchemist's supplies", "brewer's supplies", "calligrapher's supplies", "carpenter's tools", "cartographer's tools",
  "cobbler's tools", "cook's utensils", "glassblower's tools", "jeweler's tools", "leatherworker's tools",
  "mason's tools", "painter's supplies", "potter's tools", "smith's tools", "tinker's tools", "weaver's tools",
  "woodcarver's tools", "disguise kit", "forgery kit", "herbalism kit", "navigator's tools", "poisoner's kit",
  "lute", "drum", "flute", "lyre", "bagpipe", "dulcimer", "shawm", "viol", "pan pipes"
];

/** Loot detection keywords for fallback type resolution */
const LOOT_DETECT_KEYWORDS = ["gold coin", "silver coin", "copper coin", "platinum coin", "gemstone", "raw gem", "uncut gem"];

// ---------- JSON Parsing ----------

export async function parseItemJSON(raw, config) {
  console.log("Raw JSON from GPT:", raw);
  try {
    return JSON.parse(raw);
  } catch (err1) {
    console.warn("Could not parse item JSON; second GPT fix:", err1);
    let fixed = await fixInvalidJSON(raw, config);
    try {
      return JSON.parse(fixed);
    } catch (err2) {
      console.warn("Second GPT fix also invalid, sanitizer:", err2);
      let sanitized = sanitizeJSON(raw);
      try {
        return JSON.parse(sanitized);
      } catch (err3) {
        console.error("All attempts failed => returning empty item:", err3);
        return {};
      }
    }
  }
}

// ---------- Name/Description Mismatch Fixing ----------

export function fixNameDescriptionMismatch(itemName, rawJSON, originalPrompt, explicitType = "") {
  let nameLC = itemName.toLowerCase();
  let promptLC = originalPrompt.toLowerCase();
  let parsed;
  try {
    parsed = JSON.parse(rawJSON);
  } catch (e) {
    return { json: rawJSON, name: itemName };
  }
  let desc = parsed.description || "";
  let descLC = desc.toLowerCase();
  const nameRegex = /^<b>\s*Item Name:\s*<\/b>\s*([^<]+)<br\s*\/?>/i;
  const match = desc.match(nameRegex);
  if (match && match[1]) {
    let extractedName = match[1].trim();
    parsed.description = desc.replace(nameRegex, "").trim();
    itemName = extractedName;
    nameLC = itemName.toLowerCase();
  }
  // Only do weapon-specific name replacement for weapon types
  if (!explicitType || explicitType === "Weapon") {
    if (promptLC.includes("sword")) {
      const unwanted = ["dagger", "helm", "amulet", "staff", "crossbow"];
      for (let term of unwanted) {
        if (nameLC.includes(term)) {
          itemName = itemName.replace(new RegExp(term, "gi"), "sword");
          nameLC = itemName.toLowerCase();
        }
        if (descLC.includes(term)) {
          parsed.description = parsed.description.replace(new RegExp(term, "gi"), "sword");
          descLC = parsed.description.toLowerCase();
        }
      }
    }
  }
  return { json: JSON.stringify(parsed), name: itemName };
}

// ---------- Phase A: High-Confidence Type Overrides ----------

/**
 * High-confidence type overrides based on definitive structural fields and keywords.
 * Safe to run regardless of whether explicitType was provided — these overrides
 * catch hard evidence of misclassification (e.g. spell with level+school, weapon
 * name containing "sword").
 *
 * @param {string} foundryItemType — current resolved item type
 * @param {string} generatedName — the item name
 * @param {string} finalDesc — the item description
 * @param {object} parsed — the parsed GPT JSON
 * @param {object} descBonuses — results from parseDescriptionBonuses()
 * @returns {string} — the (potentially overridden) foundryItemType
 */
function applyHighConfidenceOverrides(foundryItemType, generatedName, finalDesc, parsed, descBonuses) {
  const nameLC = generatedName.toLowerCase();
  const descLC = finalDesc.toLowerCase();
  const combinedLC = nameLC + " " + descLC;
  const descWeaponKeywords = ["sword", "cutlass", "sabre", "blade", "axe", "bow", "mace", "halberd", "flail", "club", "spear", "pike", "scimitar", "katana", "claymore", "naginata", "glaive", "rapier", "longsword", "shortsword", "greatsword"];

  // Spell: structured fields are definitive
  if (foundryItemType !== "spell" && parsed.level !== undefined && parsed.school) {
    foundryItemType = "spell";
  }

  // Feat: structured fields or keyword (but only override non-weapon/non-spell)
  if (!["weapon", "spell"].includes(foundryItemType) && (parsed.featType || combinedLC.includes("feat"))) {
    foundryItemType = "feat";
  }

  // Weapon: name keywords — always override non-weapon types
  if (foundryItemType !== "weapon" && WEAPON_KEYWORDS.some(term => hasWord(nameLC, term))) {
    foundryItemType = "weapon";
  }

  // Weapon: description keywords — override if not already weapon/spell/feat
  if (!["weapon", "spell", "feat"].includes(foundryItemType)) {
    if (descBonuses.weaponHint || descWeaponKeywords.some(term => hasWord(descLC, term))) {
      foundryItemType = "weapon";
    }
  }

  return foundryItemType;
}

// ---------- Fallback Type Overrides (Phase B) ----------

/**
 * Lower-confidence type overrides — only run when the current type is still "equipment"
 * (the generic default). Checks for consumable, tool, and loot keywords.
 */
function applyFallbackTypeOverrides(foundryItemType, combinedLC) {
  if (foundryItemType !== "equipment") return foundryItemType;
  if (CONSUMABLE_DETECT_KEYWORDS.some(term => combinedLC.includes(term))) return "consumable";
  if (TOOL_DETECT_KEYWORDS.some(term => combinedLC.includes(term))) return "tool";
  if (LOOT_DETECT_KEYWORDS.some(term => combinedLC.includes(term))) return "loot";
  return foundryItemType;
}

// ---------- Subtype Resolution Helpers ----------

/** Resolve the Foundry equipment subtype from name/description keywords. */
function resolveEquipmentSubtype(nameLC, combinedText) {
  if (hasWord(nameLC, "ring"))       return "ring";
  if (hasWord(nameLC, "rod"))        return "rod";
  if (hasWord(nameLC, "wand"))       return "wand";
  if (hasWord(combinedText, "ring")) return "ring";
  if (hasWord(combinedText, "rod"))  return "rod";
  if (hasWord(combinedText, "wand")) return "wand";
  const clothingKeywords = ["clothing", "robe", "cloak", "boots", "gloves", "hat", "helm", "belt",
    "bracers", "cape", "mantle", "amulet", "necklace", "pendant", "circlet", "crown", "tiara",
    "goggles", "vestment", "gauntlet", "slippers", "sandals"];
  if (clothingKeywords.some(k => hasWord(combinedText, k))) return "clothing";
  if (hasWord(combinedText, "trinket")) return "trinket";
  if (hasWord(combinedText, "vehicle")) return "vehicle";
  return "wondrous";
}

/** Resolve the consumable subtype from combined text and GPT's itemType. */
function resolveConsumableSubtype(combinedText, parsedItemType) {
  const validConsumables = ["potion", "poison", "scroll", "wand", "rod", "food", "trinket", "ammo"];
  const consType = parsedItemType ? parsedItemType.toLowerCase() : "";
  if (validConsumables.includes(consType)) return consType;

  if (combinedText.includes("potion") || combinedText.includes("elixir") || combinedText.includes("philter") || combinedText.includes("draught") || combinedText.includes("brew") || combinedText.includes("tonic") || combinedText.includes("vial")) return "potion";
  if (combinedText.includes("poison") || combinedText.includes("toxin") || combinedText.includes("venom")) return "poison";
  if (combinedText.includes("scroll")) return "scroll";
  if (combinedText.includes("ammunition") || combinedText.includes("arrow") || combinedText.includes("bolt") || combinedText.includes("bullet") || combinedText.includes("dart") || combinedText.includes("sling stone") || combinedText.includes("needle")) return "ammo";
  if (combinedText.includes("food") || combinedText.includes("ration") || combinedText.includes("berry") || combinedText.includes("fruit") || combinedText.includes("bread") || combinedText.includes("herb") || combinedText.includes("mushroom") || combinedText.includes("feast")) return "food";
  return "potion";
}

/** Resolve the tool subtype from combined name+description text. */
function resolveToolSubtype(combinedText) {
  if (combinedText.includes("gaming") || combinedText.includes("dice") || combinedText.includes("cards") || combinedText.includes("chess") || combinedText.includes("dragonchess")) return "game";
  if (combinedText.includes("instrument") || combinedText.includes("lute") || combinedText.includes("drum") || combinedText.includes("flute") || combinedText.includes("horn") || combinedText.includes("lyre") || combinedText.includes("pan pipes") || combinedText.includes("shawm") || combinedText.includes("viol") || combinedText.includes("bagpipe") || combinedText.includes("dulcimer")) return "music";
  if (combinedText.includes("thieves") || combinedText.includes("lockpick") || combinedText.includes("pick lock")) return "thief";
  if (combinedText.includes("navigator") || combinedText.includes("navigation")) return "navg";
  if (combinedText.includes("herbalism")) return "herb";
  if (combinedText.includes("poisoner")) return "pois";
  if (combinedText.includes("vehicle") || combinedText.includes("cart") || combinedText.includes("ship") || combinedText.includes("boat")) return "vehicle";
  if (combinedText.includes("alchemist")) return "alchemist";
  if (combinedText.includes("brewer")) return "brewer";
  if (combinedText.includes("calligrapher")) return "calligrapher";
  if (combinedText.includes("carpenter")) return "carpenter";
  if (combinedText.includes("cartographer")) return "cartographer";
  if (combinedText.includes("cobbler")) return "cobbler";
  if (combinedText.includes("cook")) return "cook";
  if (combinedText.includes("glassblower")) return "glassblower";
  if (combinedText.includes("jeweler")) return "jeweler";
  if (combinedText.includes("leatherworker")) return "leatherworker";
  if (combinedText.includes("mason")) return "mason";
  if (combinedText.includes("painter")) return "painter";
  if (combinedText.includes("potter")) return "potter";
  if (combinedText.includes("smith") || combinedText.includes("forge") || combinedText.includes("anvil") || combinedText.includes("hammer") || combinedText.includes("tongs")) return "smith";
  if (combinedText.includes("tinker")) return "tinker";
  if (combinedText.includes("weaver")) return "weaver";
  if (combinedText.includes("woodcarver")) return "woodcarver";
  if (combinedText.includes("disguise")) return "disg";
  if (combinedText.includes("forgery")) return "forg";
  return "art";
}

/** Resolve the loot subtype from combined name+description text. */
function resolveLootSubtype(combinedText) {
  if (combinedText.includes("gem") || combinedText.includes("jewel") || combinedText.includes("diamond") || combinedText.includes("ruby") || combinedText.includes("sapphire") || combinedText.includes("emerald") || combinedText.includes("opal") || combinedText.includes("pearl") || combinedText.includes("amethyst") || combinedText.includes("topaz") || combinedText.includes("garnet")) return "gem";
  if (combinedText.includes("art") || combinedText.includes("painting") || combinedText.includes("sculpture") || combinedText.includes("tapestry") || combinedText.includes("idol") || combinedText.includes("statuette") || combinedText.includes("figurine") || combinedText.includes("carving") || combinedText.includes("portrait")) return "art";
  if (combinedText.includes("material") || combinedText.includes("ingot") || combinedText.includes("ore") || combinedText.includes("hide") || combinedText.includes("pelt") || combinedText.includes("silk") || combinedText.includes("cloth") || combinedText.includes("lumber") || combinedText.includes("component")) return "material";
  if (combinedText.includes("junk") || combinedText.includes("scrap") || combinedText.includes("broken") || combinedText.includes("rusty") || combinedText.includes("worthless")) return "junk";
  return "treasure";
}

// ---------- Activity Builder Helpers ----------

/** Build weapon activities (attack + extra damage) on newItemData. */
function buildWeaponActivities(newItemData, parsed) {
  newItemData.system.activities = {};
  const classification = newItemData.system.type?.value || "simpleM";
  const isRanged = classification.endsWith("R");
  const atkType = isRanged ? "ranged" : "melee";

  const attackActivity = buildAttackActivity(atkType, "weapon", "");
  newItemData.system.activities[attackActivity._id] = attackActivity;

  if (parsed.extraDamage && Array.isArray(parsed.extraDamage)) {
    for (const extra of parsed.extraDamage) {
      const ef = parseDamageFormula(extra.formula);
      if (ef) {
        const dmgPart = buildDamagePart(extra.type || "force", ef.number, ef.denomination, ef.bonus);
        const typeName = (extra.type || "").charAt(0).toUpperCase() + (extra.type || "").slice(1);
        const dmgActivity = buildDamageActivity([dmgPart], `Extra ${typeName || "Bonus"} Damage`);
        newItemData.system.activities[dmgActivity._id] = dmgActivity;
      }
    }
  }
}

/** Build spell activities (save/attack/heal/utility) and condition effects on newItemData. */
function buildSpellActivities(newItemData, parsed, refinedName) {
  newItemData.system.activities = {};
  const spellActionType = newItemData.system.actionType;

  if (spellActionType === "save" && newItemData.system.save?.ability) {
    const spellDmgParts = [];
    const sDmg = newItemData.system.damage;
    if (sDmg && sDmg.base && sDmg.base.number) {
      const isCantrip = newItemData.system.level === 0;
      const hasUpcast = newItemData.system.scaling?.mode === "level";
      const scaleMode = isCantrip ? "whole" : (hasUpcast ? "level" : "");
      spellDmgParts.push(buildDamagePart(
        sDmg.base.types || [],
        sDmg.base.number,
        sDmg.base.denomination,
        sDmg.base.bonus || "",
        scaleMode
      ));
    }
    const saveActivity = buildSaveActivity(
      newItemData.system.save.ability,
      spellDmgParts,
      "half",
      "spellcasting"
    );
    newItemData.system.activities[saveActivity._id] = saveActivity;
  }
  else if (spellActionType === "msak" || spellActionType === "rsak") {
    const spellAtkType = spellActionType === "msak" ? "melee" : "ranged";
    const spellAtkActivity = buildAttackActivity(spellAtkType, "spell", "");
    newItemData.system.activities[spellAtkActivity._id] = spellAtkActivity;
  }
  else if (spellActionType === "heal") {
    let healNum = 0, healDenom = 0, healBonus = "0";
    const hDmg = newItemData.system.damage;
    if (hDmg && hDmg.base) {
      healNum = hDmg.base.number || 0;
      healDenom = hDmg.base.denomination || 0;
      healBonus = (hDmg.base.bonus || "0").replace(/^\+/, "");
    } else if (hDmg && hDmg.parts && hDmg.parts.length > 0) {
      const hf = parseDamageFormula(hDmg.parts[0][0]);
      if (hf) {
        healNum = hf.number;
        healDenom = hf.denomination;
        healBonus = (hf.bonus || "0").replace(/^\+/, "");
      }
    }
    const spellHealActivity = buildHealActivity(healNum, healDenom, healBonus);
    newItemData.system.activities[spellHealActivity._id] = spellHealActivity;
  }
  else {
    const actType = newItemData.system.activation?.type || "action";
    const utilActivity = buildUtilityActivity(refinedName, actType);
    newItemData.system.activities[utilActivity._id] = utilActivity;
  }

  // Spell applied condition → Active Effect linked to activity
  if (parsed.appliedCondition) {
    const conditionName = parsed.appliedCondition;
    const conditionLC = conditionName.toLowerCase();
    let effectDur = {};
    if (newItemData.system.duration) {
      const secs = durationToSeconds(newItemData.system.duration.units, newItemData.system.duration.value);
      if (secs) effectDur.seconds = secs;
    }
    const condEffect = buildActiveEffect(conditionName, [], {
      statuses: [conditionLC],
      transfer: false,
      duration: effectDur,
      img: newItemData.img
    });
    newItemData.effects = newItemData.effects || [];
    newItemData.effects.push(condEffect);
    const firstActId = Object.keys(newItemData.system.activities)[0];
    if (firstActId) {
      newItemData.system.activities[firstActId].effects.push({ _id: condEffect._id });
    }
  }
}

/** Build consumable activities (heal or utility "Use") on newItemData. */
function buildConsumableActivities(newItemData, parsed, refinedName, finalDesc) {
  const consSubtype = newItemData.system.type?.value || "";
  const consNameLC = refinedName.toLowerCase();
  const consDescPlain = finalDesc.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
  const consText = consNameLC + " " + consDescPlain;

  newItemData.system.activities = {};
  const consumptionTargets = [{ type: "itemUses", value: "1", scaling: {} }];
  let activityCreated = false;

  const isHealing = (consSubtype === "potion" || consSubtype === "food") &&
    (consText.includes("heal") || consText.includes("restore") || consText.includes("regain") || consText.includes("hit point") || consText.includes("hp"));
  if (isHealing) {
    const healMatch = consDescPlain.match(/(\d+)d(\d+)\s*([+-]\s*\d+)?/i);
    let healNum, healDenom, healBonus;
    if (healMatch) {
      healNum = parseInt(healMatch[1], 10);
      healDenom = parseInt(healMatch[2], 10);
      healBonus = (healMatch[3] || "0").replace(/\s+/g, "").replace(/^\+/, "");
    } else {
      const rarity = (parsed.rarity || "common").toLowerCase();
      const HEAL_DEFAULTS = {
        "common": { num: 2, die: 4, bonus: "2" },
        "uncommon": { num: 4, die: 4, bonus: "4" },
        "rare": { num: 8, die: 4, bonus: "8" },
        "very rare": { num: 10, die: 4, bonus: "20" },
        "veryrare": { num: 10, die: 4, bonus: "20" },
        "legendary": { num: 10, die: 4, bonus: "20" }
      };
      const def = HEAL_DEFAULTS[rarity] || HEAL_DEFAULTS["common"];
      healNum = def.num;
      healDenom = def.die;
      healBonus = def.bonus;
    }
    const potionHealActivity = buildHealActivity(healNum, healDenom, healBonus, consumptionTargets);
    potionHealActivity.activation = { type: "action", override: false };
    newItemData.system.activities[potionHealActivity._id] = potionHealActivity;
    activityCreated = true;
  }

  if (!activityCreated) {
    const useActivity = buildUtilityActivity("Use", "action");
    useActivity.consumption = {
      scaling: { allowed: false },
      spellSlot: false,
      targets: consumptionTargets
    };
    newItemData.system.activities[useActivity._id] = useActivity;
  }

  newItemData.system.uses = { max: "1", spent: 0, recovery: [], autoDestroy: true };
}

// ---------- Mechanical Effects & Castable Spells ----------

/** Apply GPT's mechanicalEffects array as Active Effects on newItemData. */
function applyMechanicalEffects(newItemData, parsed, foundryItemType) {
  if (!parsed.mechanicalEffects || !Array.isArray(parsed.mechanicalEffects) || parsed.mechanicalEffects.length === 0) return;

  const isArmorForEffects = foundryItemType === "equipment" &&
    ["light", "medium", "heavy", "natural", "shield"].includes(newItemData.system.type?.value);
  const isConsumable = foundryItemType === "consumable";

  let consumableDuration = {};
  if (isConsumable && parsed.effectDuration) {
    const secs = durationToSeconds(parsed.effectDuration.unit, parsed.effectDuration.value);
    if (secs) consumableDuration.seconds = secs;
  }

  newItemData.effects = newItemData.effects || [];
  for (const mechEffect of parsed.mechanicalEffects) {
    if (isArmorForEffects && ["ac", "stealth"].includes(mechEffect.target?.toLowerCase())) {
      continue;
    }

    const effChanges = [];
    const mapped = mapEffectChange(mechEffect.type, mechEffect.target, mechEffect.value);
    if (mapped) effChanges.push(mapped);

    if (effChanges.length > 0) {
      const effect = buildActiveEffect(mechEffect.name || "Effect", effChanges, {
        transfer: isConsumable ? false : true,
        duration: isConsumable ? consumableDuration : {},
        img: newItemData.img
      });
      newItemData.effects.push(effect);

      if (isConsumable && newItemData.system.activities) {
        const firstActId = Object.keys(newItemData.system.activities)[0];
        if (firstActId) {
          newItemData.system.activities[firstActId].effects = newItemData.system.activities[firstActId].effects || [];
          newItemData.system.activities[firstActId].effects.push({ _id: effect._id });
        }
      }
    }
  }
}

/** Process castable spells (staves, wands, rings) and add cast activities. */
async function applyCastableSpells(newItemData, parsed, config) {
  if (!parsed.castableSpells || !Array.isArray(parsed.castableSpells) || parsed.castableSpells.length === 0 || !config.isDnd5eV4) return;

  if (!newItemData.system.activities) newItemData.system.activities = {};

  const uniqueSpells = new Map();
  for (const sp of parsed.castableSpells) {
    const key = (sp.name || "Unknown Spell").toLowerCase().trim();
    if (!uniqueSpells.has(key)) {
      uniqueSpells.set(key, sp);
    }
  }

  for (const [, spellData] of uniqueSpells) {
    try {
      let spellUuid = await findSpellByName(spellData.name);

      if (!spellUuid) {
        const newSpell = await Item.create({
          name: spellData.name || "Unknown Spell",
          type: "spell",
          system: {
            level: spellData.level ?? 1,
            school: normalizeSchool(spellData.school || "evocation"),
            description: { value: spellData.description || "" },
            preparation: { mode: "atwill" }
          }
        });
        spellUuid = newSpell.uuid;
      }

      const castAct = buildCastActivity(
        spellUuid,
        spellData.chargeCost || 1,
        `Cast ${spellData.name || "Spell"}`
      );
      newItemData.system.activities[castAct._id] = castAct;
    } catch (err) {
      console.error(`Error processing castable spell "${spellData.name}":`, err);
    }
  }
}

// ---------- Core Item Document Creation ----------

/**
 * Generate item data without creating the Foundry document.
 * Returns all the data needed to preview or create the item.
 */
export async function generateItemData(itemPrompt, config, forcedName = null, explicitType = "") {
  if (!game.user.isGM) {
    ui.notifications.warn("Only the GM can generate items.");
    return null;
  }

  let combined = itemPrompt + (explicitType ? " - " + explicitType : "");

  // Generate the item name (or use the override if provided)
  let generatedName = (forcedName && forcedName.trim().length > 0)
    ? forcedName
    : await generateItemName(combined, config);

  // Generate the image and update progress to 20%
  let imagePath = await generateItemImage(combined, config);
  if (!imagePath) {
    ui.notifications.warn("Image generation failed — using default icon.");
  }
  updateProgressBar(20);

  // Generate the item JSON and update progress to 40%
  let rawItemJSON = await generateItemJSON(combined, config, explicitType);
  updateProgressBar(40);

  // Fix and parse the JSON (pass explicitType to guard weapon-specific name replacement)
  let mismatchResult = fixNameDescriptionMismatch(generatedName, rawItemJSON, combined, explicitType);
  let fixedJSON = mismatchResult.json;
  generatedName = mismatchResult.name;
  let parsed = await parseItemJSON(fixedJSON, config);

  // Transform weapon damage into the correct format for the dnd5e version
  if (parsed.damage && (explicitType === "Weapon" || WEAPON_KEYWORDS.some(term => generatedName.toLowerCase().includes(term)))) {
    parsed.damage = transformWeaponDamage(parsed.damage, config.isDnd5eV4);
  }
  updateProgressBar(60);

  let finalDesc = parsed.description || "No description provided.";

  // ---------- Scan description for weapon stats, bonuses, and hints ----------
  // The description is the source of truth — GPT puts damage, bonuses, and
  // special powers in the description text. We extract these to fill gaps
  // in the structured JSON fields.
  const descBonuses = parseDescriptionBonuses(finalDesc);
  console.log("Description scan results:", descBonuses);

  // Refine the item name based on the description if no override was provided
  let refinedName = (forcedName && forcedName.trim().length > 0)
    ? forcedName
    : await ensureItemName(generatedName, finalDesc, config);
  updateProgressBar(80);

  // Pre-compute lowercase variants used by type detection and field resolution
  const nameLC = refinedName.toLowerCase();
  const descLC = finalDesc.toLowerCase();

  // ---------- Determine the Foundry item type ----------
  // Three-stage resolution:
  //   1. Explicit type from the UI dropdown (highest priority)
  //   2. GPT's parsed.itemType from the JSON
  //   3. Keyword/field safety-net — ALWAYS runs when result is "equipment" (the
  //      generic default) to catch GPT misclassifications like a potion or spell
  //      being returned as "equipment".

  let foundryItemType = "equipment";
  if (explicitType) {
    // Stage 1: v4+ has dedicated item types; v3 falls back for types that don't exist
    const explicitMapping = config.isDnd5eV4
      ? { "Weapon": "weapon", "Armor": "equipment", "Equipment": "equipment", "Consumable": "consumable", "Tool": "tool", "Loot": "loot", "Spell": "spell", "Feat": "feat", "Container": "container", "Background": "background" }
      : { "Weapon": "weapon", "Armor": "equipment", "Equipment": "equipment", "Consumable": "consumable", "Tool": "tool", "Loot": "loot", "Spell": "spell", "Feat": "feat", "Container": "loot", "Background": "loot" };
    foundryItemType = explicitMapping[explicitType] || "equipment";
  } else {
    // --- Stage 2: GPT's itemType from the JSON ---
    if (parsed.itemType) {
      let typeStr = parsed.itemType.toLowerCase().trim();
      if (WEAPON_KEYWORDS.some(term => typeStr.includes(term) || typeStr.includes("weapon"))) {
        foundryItemType = "weapon";
      } else {
        const map = config.isDnd5eV4
          ? { "armor": "equipment", "potion": "consumable", "scroll": "consumable", "rod": "equipment", "wand": "equipment", "ammunition": "consumable", "ammo": "consumable", "gear": "equipment", "loot": "loot", "tool": "tool", "spell": "spell", "feat": "feat", "feature": "feat", "container": "container", "background": "background", "consumable": "consumable" }
          : { "armor": "equipment", "potion": "consumable", "scroll": "consumable", "rod": "equipment", "wand": "equipment", "ammunition": "consumable", "ammo": "consumable", "gear": "equipment", "loot": "loot", "tool": "tool", "spell": "spell", "feat": "feat", "feature": "feat", "container": "loot", "background": "loot", "consumable": "consumable" };
        foundryItemType = map[typeStr] || "equipment";
      }
    }
  }

  // --- Phase A: High-confidence overrides — ALWAYS run (even with explicitType). ---
  // Catches definitive misclassifications like a longsword tagged "consumable" in a
  // roll table, or a spell with level+school fields forced into "equipment".
  foundryItemType = applyHighConfidenceOverrides(foundryItemType, generatedName, finalDesc, parsed, descBonuses);

  // --- Phase B: Fallback overrides — only run in auto-detect mode when still "equipment". ---
  if (!explicitType) {
    const combinedLC = generatedName.toLowerCase() + " " + finalDesc.toLowerCase();
    foundryItemType = applyFallbackTypeOverrides(foundryItemType, combinedLC);
  }

  // ---------- Parse the GPT type object ----------

  // GPT returns type as { value: "simpleM"|"martialM"|"simpleR"|"martialR", baseItem: "longsword" }
  let gptType = null;
  if (parsed.type && typeof parsed.type === "object") {
    gptType = parsed.type;
  } else if (foundryItemType === "weapon") {
    gptType = { value: "simpleM", baseItem: "" };
  }

  // ---------- Use description weapon hint to fill missing type/baseItem ----------

  if (foundryItemType === "weapon" && descBonuses.weaponHint) {
    const hint = descBonuses.weaponHint;
    // Always use PHB-accurate classification and baseItem when we identify the weapon.
    // GPT often returns wrong classification or malformed baseItem values.
    if (gptType) {
      gptType.value = hint.classification;
      gptType.baseItem = hint.baseItem;
    }
  }

  // ---------- Build the new item data ----------

  let newItemData = {
    name: refinedName,
    type: foundryItemType,
    img: imagePath || "icons/svg/d20-highlight.svg",
    system: {
      description: { value: finalDesc },
      rarity: parsed.rarity || "common",
      price: { value: parsed.price || 100, denomination: "gp" }
    }
  };

  // Attunement only applies to equipment-like items, not spells/backgrounds
  if (!WEIGHTLESS_TYPES.includes(foundryItemType)) {
    newItemData.system.attunement = parsed.requiresAttunement ? 1 : 0;
    newItemData.system.activation = parsed.activation || { type: "", cost: 0 };
    newItemData.system.uses = parsed.uses || {};
  }

  // ---------- Weight: GPT > weapon defaults > fallback ----------
  // Spells, feats, backgrounds don't have weight

  if (!WEIGHTLESS_TYPES.includes(foundryItemType)) {
    const hint = descBonuses.weaponHint; // shorthand for weapon defaults from description
    let weightVal = Number(parsed.weight) || (hint ? hint.weight : null) || 1;

    if (config.isDnd5eV4) {
      newItemData.system.weight = { value: weightVal, units: "lb" };
    } else {
      newItemData.system.weight = weightVal;
    }

    // ---------- Cost: GPT > weapon defaults > fallback ----------
    if (!parsed.price && hint && hint.cost) {
      newItemData.system.price = { value: hint.cost.value, denomination: hint.cost.denomination };
    }
  }

  // ---------- Weapon-specific fields ----------

  const hint = descBonuses.weaponHint; // shorthand available for weapon block

  if (foundryItemType === "weapon") {
    // Transform properties with abbreviations for v4+
    let weaponProps = [];
    if (parsed.weaponProperties) {
      weaponProps = transformWeaponProperties(parsed.weaponProperties, config.isDnd5eV4);
    }

    // When a known PHB weapon is identified from the description, use its
    // authoritative physical properties instead of GPT's guesses.
    // GPT often incorrectly adds "versatile" to non-versatile weapons.
    // We keep any enchantment/material properties GPT added (magical, returning,
    // silvered, adamantine) since those come from the item's magic, not its base type.
    if (hint && hint.properties) {
      const PHYSICAL_PROPS = new Set(config.isDnd5eV4
        ? ["fin", "lgt", "hvy", "two", "ver", "rch", "thr", "amm", "lod", "spc", "foc"]
        : ["finesse", "light", "heavy", "two-handed", "twohanded", "two handed", "versatile", "reach", "thrown", "ammunition", "loading", "special", "focus"]);
      // Keep only enchantment/material properties from GPT (mgc, ret, sil, ada, etc.)
      const enchantments = weaponProps.filter(p => !PHYSICAL_PROPS.has(p));
      weaponProps = config.isDnd5eV4
        ? [...hint.properties, ...enchantments]
        : [...hint.properties.map(abbr => {
            for (const [full, short] of Object.entries(PROPERTY_ABBREV_MAP)) {
              if (short === abbr) return full;
            }
            return abbr;
          }), ...enchantments];
    }
    newItemData.system.properties = weaponProps;

    // ---------- Damage: GPT JSON > description-extracted > weapon defaults ----------

    let damageData = parsed.damage;

    // If GPT didn't provide damage or it's empty, try description then weapon defaults
    const isDamageEmpty = !damageData
      || (config.isDnd5eV4 && (!damageData.base || damageData.base.number === undefined || damageData.base.number === null))
      || (!config.isDnd5eV4 && (!damageData.parts || damageData.parts.length === 0));

    if (isDamageEmpty) {
      if (descBonuses.damage) {
        // Description had damage info like "deals 1d8 slashing damage"
        const descDamage = { dice: descBonuses.damage.formula, type: descBonuses.damage.type };
        damageData = transformWeaponDamage(descDamage, config.isDnd5eV4);
      } else if (hint && hint.damage) {
        // Fall back to PHB weapon defaults (e.g., longsword = 1d8 slashing)
        const def = hint.damage;
        if (config.isDnd5eV4) {
          damageData = {
            base: {
              number: def.number,
              denomination: def.denomination,
              bonus: "",
              types: [def.type]
            }
          };
        } else {
          damageData = { parts: [[`${def.number}d${def.denomination}`, def.type]] };
        }
      } else {
        // Fall back to compendium lookup (for homebrew/exotic weapons not in PHB tables)
        try {
          const compDefaults = await getCompendiumDefaults(refinedName, "weapon");
          if (compDefaults?.damage) {
            damageData = compDefaults.damage;
          }
        } catch (err) {
          // Compendium fallback is optional — continue without it
        }
      }
    }

    newItemData.system.damage = damageData || (config.isDnd5eV4 ? {} : { parts: [] });

    if (config.isDnd5eV4) {
      // v4+/v5: system.type.value is the weapon classification code (simpleM, martialM, etc.)
      let typeCode = "simpleM";
      if (gptType && gptType.value) {
        typeCode = VALID_WEAPON_CODES.includes(gptType.value) ? gptType.value : "simpleM";
      }
      // Normalize baseItem to Foundry's format: lowercase, no spaces (e.g. "Longsword" → "longsword", "Hand Crossbow" → "handcrossbow")
      let rawBase = ((gptType && gptType.baseItem) || "").toLowerCase().replace(/\s+/g, "");
      newItemData.system.type = { value: typeCode, baseItem: rawBase };

      // --- Staff auto-detection: staffs are quarterstaffs (simple melee) ---
      // If the item name contains "staff" and no baseItem was set, default to quarterstaff.
      // This ensures Staff of Frost, Staff of Power, etc. get correct weapon stats.
      if (!rawBase && hasWord(refinedName.toLowerCase(), "staff")) {
        typeCode = "simpleM";
        newItemData.system.type = { value: typeCode, baseItem: "quarterstaff" };
        // Quarterstaff defaults: 1d6 bludgeoning, versatile 1d8, 4 lb
        if (!newItemData.system.properties.includes("ver")) {
          newItemData.system.properties.push("ver");
        }
      }

      // --- Magical staff properties: staffs with spells get "foc" (focus) + "mgc" (magical) ---
      // D&D 5e: magical staffs are spellcasting focuses. Auto-add these properties when
      // the staff has castable spells, a magical bonus, or requires attunement.
      if (hasWord(refinedName.toLowerCase(), "staff") &&
          (parsed.castableSpells?.length > 0 || parsed.magicalBonus > 0 || parsed.requiresAttunement)) {
        if (!newItemData.system.properties.includes("foc")) {
          newItemData.system.properties.push("foc");
        }
        if (!newItemData.system.properties.includes("mgc")) {
          newItemData.system.properties.push("mgc");
        }
      }

      // ---------- Range: GPT (if valid) > weapon defaults > generic fallback ----------
      // Guard against GPT returning malformed range like { value: null, units: "" }
      const hasValidRange = parsed.range && (parsed.range.value || parsed.range.units);
      if (hasValidRange) {
        newItemData.system.range = parsed.range;
      } else if (hint && hint.range) {
        // Use PHB-accurate range (e.g., longbow 150/600, dagger 20/60, longsword 5ft)
        newItemData.system.range = { ...hint.range };
      } else {
        const isRanged = typeCode.endsWith("R");
        newItemData.system.range = isRanged
          ? { value: 80, long: 320, units: "ft" }
          : { value: 5, units: "ft" };
      }

      // ---------- Magical bonus: GPT JSON > description scan ----------
      if (parsed.magicalBonus !== undefined && Number(parsed.magicalBonus) > 0) {
        newItemData.system.magicalBonus = Number(parsed.magicalBonus);
      } else if (descBonuses.magicalBonus !== null) {
        newItemData.system.magicalBonus = descBonuses.magicalBonus;
      }

      // Rarity fallback: infer from rarity when both GPT JSON and description scan missed it
      if (!newItemData.system.magicalBonus || newItemData.system.magicalBonus <= 0) {
        const rarityBonus = inferMagicalBonusFromRarity(parsed.rarity);
        if (rarityBonus > 0) {
          newItemData.system.magicalBonus = rarityBonus;
        }
      }

      // Auto-add "mgc" property when item has a magical bonus
      if (newItemData.system.magicalBonus && newItemData.system.magicalBonus > 0) {
        if (!newItemData.system.properties.includes("mgc")) {
          newItemData.system.properties.push("mgc");
        }
      }

      // ---------- Versatile damage ----------
      const hasVersatile = newItemData.system.properties.includes(config.isDnd5eV4 ? "ver" : "versatile");
      if (hasVersatile && newItemData.system.damage.base) {
        const baseComp = {
          number: newItemData.system.damage.base.number,
          denomination: newItemData.system.damage.base.denomination,
          bonus: newItemData.system.damage.base.bonus || ""
        };
        const damageType = (newItemData.system.damage.base.types && newItemData.system.damage.base.types[0]) || "";

        // Use weapon defaults versatileDie if GPT didn't provide versatileDamage
        let gptVersatile = parsed.versatileDamage || null;
        if (!gptVersatile && hint && hint.versatileDie) {
          // Build from PHB defaults (e.g., longsword: base d8 → versatile d10)
          gptVersatile = {
            number: baseComp.number,
            denomination: hint.versatileDie,
            bonus: baseComp.bonus,
            type: damageType
          };
        }

        const versatile = buildVersatileDamage(gptVersatile, baseComp, damageType);
        if (versatile) {
          newItemData.system.damage.versatile = versatile;
        }
      }

      // ---------- Weapon Mastery (2024 Modern Rules) ----------
      // Each PHB weapon has a specific mastery property (cleave, graze, nick, etc.).
      // The mastery field exists in dnd5e v4+ regardless of rules version — it simply
      // has no mechanical effect under Legacy (2014) rules, so it's safe to always set.
      if (hint && hint.mastery) {
        newItemData.system.mastery = hint.mastery;
      }
    } else {
      // v3: system.type is the full object { value: "simpleM", baseItem: "longsword" }
      newItemData.system.type = gptType;
      newItemData.system.armor = { value: 10 };
    }
  }

  // ---------- Spell-specific fields ----------

  if (foundryItemType === "spell") {
    // Scan description for fallback hints (like weapon description scanning)
    const spellHints = parseSpellDescription(finalDesc);
    console.log("Spell description scan results:", spellHints);

    // --- Level ---
    let spellLevel = parseInt(parsed.level, 10);
    if (isNaN(spellLevel) || spellLevel < 0 || spellLevel > 9) {
      spellLevel = spellHints.level ?? 1;
    }
    newItemData.system.level = spellLevel;

    // --- School ---
    newItemData.system.school = normalizeSchool(parsed.school || spellHints.school || "evocation");

    // --- Components ---
    const rawComponents = parsed.components || {};
    newItemData.system.components = normalizeComponents({
      ...rawComponents,
      concentration: parsed.concentration ?? spellHints.concentration ?? false,
      ritual: parsed.ritual ?? false
    });

    // --- Materials ---
    if (rawComponents.material || parsed.materialDescription) {
      newItemData.system.materials = normalizeMaterials(parsed);
    }

    // --- Activation (Casting Time) ---
    newItemData.system.activation = normalizeActivation(
      parsed.castingTime || parsed.activation || spellHints.castingTime || { type: "action", cost: 1 }
    );

    // --- Duration ---
    newItemData.system.duration = normalizeDuration(
      parsed.duration || spellHints.duration || { value: null, unit: "instantaneous" }
    );

    // --- Range ---
    newItemData.system.range = normalizeRange(
      parsed.range || spellHints.range || { value: null, unit: "self" }
    );

    // --- Target ---
    if (parsed.target || spellHints.target) {
      newItemData.system.target = normalizeTarget(parsed.target || spellHints.target);
    }

    // --- Action Type (attack vs save vs heal vs utility) ---
    let actionType = "util";
    if (parsed.actionType) {
      const atLower = parsed.actionType.toLowerCase();
      actionType = SPELL_ACTION_TYPE_MAP[atLower] || "util";
    } else if (spellHints.actionType) {
      actionType = spellHints.actionType;
    }
    newItemData.system.actionType = actionType;

    // --- Save ---
    if (actionType === "save") {
      const saveAbility = parsed.saveAbility
        ? (ABILITY_MAP[parsed.saveAbility.toLowerCase()] || parsed.saveAbility.toLowerCase().slice(0, 3))
        : (spellHints.saveAbility || "dex");
      newItemData.system.save = {
        ability: saveAbility,
        dc: null,
        scaling: "spell"
      };
    }

    // --- Damage ---
    if (parsed.damage || spellHints.damage) {
      const rawDamage = parsed.damage || spellHints.damage;
      newItemData.system.damage = transformSpellDamage(rawDamage, config.isDnd5eV4);
    }

    // --- Scaling ---
    newItemData.system.scaling = buildSpellScaling(
      parsed.scaling || null,
      spellLevel
    );

    // --- Higher Levels (append to description) ---
    if (parsed.higherLevels) {
      newItemData.system.description.value +=
        `<br><br><strong>At Higher Levels.</strong> ${parsed.higherLevels}`;
    }

    // --- Preparation (default to "prepared") ---
    newItemData.system.preparation = { mode: "prepared" };

    // --- Spell Properties (v4+) ---
    // In dnd5e v4+, spell components are stored as properties array entries
    if (config.isDnd5eV4) {
      const spellProps = newItemData.system.properties || [];
      const comps = newItemData.system.components;
      if (comps) {
        if (comps.vocal && !spellProps.includes("vocal")) spellProps.push("vocal");
        if (comps.somatic && !spellProps.includes("somatic")) spellProps.push("somatic");
        if (comps.material && !spellProps.includes("material")) spellProps.push("material");
        if (comps.concentration && !spellProps.includes("concentration")) spellProps.push("concentration");
        if (comps.ritual && !spellProps.includes("ritual")) spellProps.push("ritual");
      }
      newItemData.system.properties = spellProps;
    }
  }

  // ---------- Feat-specific fields ----------

  if (foundryItemType === "feat") {
    const featType = (parsed.featType || "feat").toLowerCase();
    if (config.isDnd5eV4) {
      newItemData.system.type = { value: featType };
    } else {
      newItemData.system.type = { value: featType };
    }

    if (parsed.requirements) {
      newItemData.system.requirements = parsed.requirements;
    }
  }

  // ---------- Container-specific fields ----------

  if (foundryItemType === "container" && config.isDnd5eV4) {
    newItemData.system.capacity = {
      value: parsed.capacity?.value ?? 100,
      type: parsed.capacity?.type ?? "weight"
    };

    if (parsed.weightlessContents) {
      newItemData.system.properties = newItemData.system.properties || [];
      newItemData.system.properties.push("weightlessContents");
    }
  }

  // ---------- Magical properties ----------
  // Skip for spells, feats, and backgrounds — they don't get random magical properties

  if (!NO_MAGIC_PROPS_TYPES.includes(foundryItemType)) {
    const isMagic = (
      (parsed.magical !== undefined && String(parsed.magical).toLowerCase() === "true") ||
      (parsed.magic !== undefined && String(parsed.magic).toLowerCase() === "true")
    );
    const magList = ["rare", "very rare", "legendary", "artifact"];
    const rarityLower = (parsed.rarity || "").toLowerCase();
    if (isMagic || (magList.includes(rarityLower) && Math.random() < 0.5)) {
      const count = Math.floor(Math.random() * 3) + 1;
      const magProps = await generateMagicalProperties(newItemData, count, config);
      if (magProps) {
        newItemData.system.description.value += `<br><br><strong>Magical Properties:</strong><br>${magProps.replace(/\n/g, "<br>")}`;
      }
    }
  }

  // ---------- Armor/Shield handling ----------
  // Armor is type "equipment" with system.type.value set to the armor subtype
  // (light, medium, heavy, natural, shield). The AC fields must be populated.
  // Uses ARMOR_DEFAULTS for PHB-accurate stats, just like weapons use WEAPON_DEFAULTS.

  const armorDetectKeywords = ["armor", "shield", "mail ", "plate", "breastplate", "chainmail", "chain shirt", "half plate", "splint", "hide armor"];
  const promptHasArmor = !explicitType && armorDetectKeywords.some(k => itemPrompt.toLowerCase().includes(k));

  const isArmorItem = explicitType === "Armor"
    || (parsed.armorType && ["light", "medium", "heavy", "natural", "shield"].includes((parsed.armorType || "").toLowerCase()))
    || (parsed.itemType && ["armor", "shield"].includes(parsed.itemType.toLowerCase()))
    || promptHasArmor;

  if (isArmorItem) {
    newItemData.type = "equipment";

    // --- Identify base armor from description/name using ARMOR_DEFAULTS ---
    // This works like weapon hint detection: scan the name + description for
    // known armor types and use PHB-accurate defaults.
    const armorHint = parseDescriptionForArmor(refinedName + " " + finalDesc + " " + itemPrompt);
    if (armorHint) {
    }

    // Armor type: PHB defaults > GPT > fallback
    const VALID_ARMOR_TYPES = ["light", "medium", "heavy", "natural", "shield"];
    let armorType = (armorHint ? armorHint.armorType : null)
      || (parsed.armorType || (parsed.itemType?.toLowerCase() === "shield" ? "shield" : "medium")).toLowerCase();

    // Validate armor type — GPT sometimes confuses damage type with armor category
    if (!VALID_ARMOR_TYPES.includes(armorType)) {
      console.warn(`Invalid armor type "${armorType}" from GPT, falling back to description inference`);
      const descLower = finalDesc.toLowerCase();
      if (descLower.includes("light armor") || descLower.includes("leather") || descLower.includes("padded") || descLower.includes("studded")) armorType = "light";
      else if (descLower.includes("heavy armor") || descLower.includes("chain mail") || descLower.includes("plate") || descLower.includes("splint") || descLower.includes("ring mail")) armorType = "heavy";
      else if (descLower.includes("shield")) armorType = "shield";
      else armorType = "medium"; // safe default
    }

    // AC: GPT explicit value > PHB defaults > compendium > generic fallback
    let acValue;
    if (parsed.ac && Number(parsed.ac) > 0) {
      acValue = Number(parsed.ac);
    } else if (armorHint) {
      acValue = armorHint.ac;
    } else {
      // Try compendium as fallback before generic default
      let compAC = null;
      try {
        const compDefaults = await getCompendiumDefaults(refinedName, "equipment");
        if (compDefaults?.armor?.value) {
          compAC = compDefaults.armor.value;
        }
      } catch (err) { /* optional fallback */ }
      acValue = compAC || (armorType === "shield" ? 2 : 14);
    }

    // Max DEX modifier: PHB defaults > calculated from type
    let dexCap;
    if (armorHint && armorHint.dexCap !== undefined) {
      dexCap = armorHint.dexCap;
    } else if (armorType === "light" || armorType === "shield") {
      dexCap = null;
    } else if (armorType === "medium") {
      dexCap = 2;
    } else {
      dexCap = 0;
    }

    // Stealth disadvantage: PHB defaults > GPT > fallback based on type
    let stealthDisadvantage;
    if (armorHint) {
      stealthDisadvantage = armorHint.stealthDisadvantage;
    } else if (parsed.stealthDisadvantage !== undefined) {
      stealthDisadvantage = !!parsed.stealthDisadvantage;
    } else {
      // Heavy armor always has stealth disadvantage; padded + scale mail + half plate too
      stealthDisadvantage = armorType === "heavy";
    }

    // Strength requirement: GPT > PHB defaults > type-based fallback
    let strengthReq;
    if (parsed.strengthRequirement && Number(parsed.strengthRequirement) > 0) {
      strengthReq = Number(parsed.strengthRequirement);
    } else if (armorHint) {
      strengthReq = armorHint.strengthRequirement;
    } else {
      strengthReq = armorType === "heavy" ? 13 : 0;
    }

    // Weight: GPT > PHB defaults > generic fallback
    if (armorHint && armorHint.weight) {
      const weightVal = Number(parsed.weight) || armorHint.weight;
      if (config.isDnd5eV4) {
        newItemData.system.weight = { value: weightVal, units: "lb" };
      } else {
        newItemData.system.weight = weightVal;
      }
    }

    // Cost: GPT > PHB defaults
    if (armorHint && armorHint.cost && !parsed.price) {
      newItemData.system.price = { value: armorHint.cost.value, denomination: armorHint.cost.denomination };
    }

    if (config.isDnd5eV4) {
      // v4+/v5: system.type.value is the armor subtype, system.armor holds AC data
      // Base item: PHB defaults > GPT (normalized to Foundry format)
      let armorBaseItem = "";
      if (armorHint && armorHint.baseItem) {
        armorBaseItem = armorHint.baseItem;
      } else if (parsed.baseItem) {
        armorBaseItem = parsed.baseItem.toLowerCase().replace(/\s+/g, "");
      }
      newItemData.system.type = { value: armorType, baseItem: armorBaseItem };
      newItemData.system.armor = {
        value: acValue,
        magicalBonus: Number(parsed.magicalBonus) || 0,
        dex: dexCap
      };
      newItemData.system.strength = strengthReq;

      // Magical bonus at the top level (same field as weapons use)
      if (parsed.magicalBonus && Number(parsed.magicalBonus) > 0) {
        newItemData.system.magicalBonus = Number(parsed.magicalBonus);
      }

      // Rarity fallback: infer from rarity when GPT didn't provide magicalBonus
      if (!newItemData.system.magicalBonus || newItemData.system.magicalBonus <= 0) {
        const rarityBonus = inferMagicalBonusFromRarity(parsed.rarity);
        if (rarityBonus > 0) {
          newItemData.system.magicalBonus = rarityBonus;
          // Sync the armor object's magicalBonus to keep both in alignment
          if (newItemData.system.armor) {
            newItemData.system.armor.magicalBonus = rarityBonus;
          }
        }
      }

      // Equipment properties
      let armorProps = newItemData.system.properties || [];
      if (stealthDisadvantage) {
        if (!armorProps.includes("stealthDisadvantage")) armorProps.push("stealthDisadvantage");
      }
      if ((newItemData.system.magicalBonus && newItemData.system.magicalBonus > 0) ||
          (parsed.magicalBonus && Number(parsed.magicalBonus) > 0)) {
        if (!armorProps.includes("mgc")) armorProps.push("mgc");
      }
      newItemData.system.properties = armorProps;
    } else {
      // v3: system.armor holds type + AC
      newItemData.system.equipmentType = "armor";
      newItemData.system.armor = { type: armorType, value: acValue, dex: dexCap };
    }

    // Armor doesn't use charges — clear any spurious uses from GPT
    newItemData.system.uses = {};
  }

  // ---------- Equipment subtype handling ----------
  // For non-armor equipment items (rings, rods, wands, clothing, trinkets, wondrous items),
  // set system.type.value to the appropriate equipment subtype.
  // Also handle magical bonus + mgc property for equipment items.

  if (!isArmorItem && foundryItemType === "equipment") {
    const combined = nameLC + " " + descLC;

    if (config.isDnd5eV4) {
      newItemData.system.type = { value: resolveEquipmentSubtype(nameLC, combined) };
    }

    // Magical bonus for equipment (e.g., +1 Ring of Protection, +2 Cloak of Protection)
    // Same detection logic as weapons: GPT JSON > description scan
    if (parsed.magicalBonus !== undefined && Number(parsed.magicalBonus) > 0) {
      if (config.isDnd5eV4) {
        newItemData.system.magicalBonus = Number(parsed.magicalBonus);
      }
    } else if (descBonuses.magicalBonus !== null) {
      if (config.isDnd5eV4) {
        newItemData.system.magicalBonus = descBonuses.magicalBonus;
      }
    }

    // Rarity fallback for equipment
    if (config.isDnd5eV4 && (!newItemData.system.magicalBonus || newItemData.system.magicalBonus <= 0)) {
      const rarityBonus = inferMagicalBonusFromRarity(parsed.rarity);
      if (rarityBonus > 0) {
        newItemData.system.magicalBonus = rarityBonus;
      }
    }

    // Equipment properties: set mgc for magical items
    let equipProps = newItemData.system.properties || [];
    const isMagicalEquip = (newItemData.system.magicalBonus && newItemData.system.magicalBonus > 0)
      || (parsed.magical !== undefined && String(parsed.magical).toLowerCase() === "true")
      || (parsed.magic !== undefined && String(parsed.magic).toLowerCase() === "true")
      || (parsed.requiresAttunement)
      || ["rare", "very rare", "legendary", "artifact"].includes((parsed.rarity || "").toLowerCase());
    if (isMagicalEquip && config.isDnd5eV4) {
      if (!equipProps.includes("mgc")) equipProps.push("mgc");
      // Focus property for rods, wands, staffs (can be used as spellcasting focus)
      if ((hasWord(combined, "rod") || hasWord(combined, "wand") || hasWord(combined, "staff")) && !equipProps.includes("foc")) {
        equipProps.push("foc");
      }
    }
    if (config.isDnd5eV4) {
      newItemData.system.properties = equipProps;
    }
  }

  // ---------- Consumable subtype ----------

  if (foundryItemType === "consumable") {
    const combined = nameLC + " " + descLC;
    const consType = resolveConsumableSubtype(combined, parsed.itemType);

    if (config.isDnd5eV4) {
      newItemData.system.type = { value: consType };
    } else {
      newItemData.system.consumableType = consType;
    }

    // Consumable properties — magical consumables should have mgc
    if (config.isDnd5eV4) {
      let consProps = newItemData.system.properties || [];
      const isMagicalCons = (parsed.magical !== undefined && String(parsed.magical).toLowerCase() === "true")
        || (parsed.magic !== undefined && String(parsed.magic).toLowerCase() === "true")
        || ["rare", "very rare", "legendary", "artifact"].includes((parsed.rarity || "").toLowerCase())
        || consType === "scroll" || consType === "potion";
      if (isMagicalCons && !consProps.includes("mgc")) {
        consProps.push("mgc");
      }
      newItemData.system.properties = consProps;
    }
  }

  // ---------- Tool subtype ----------

  if (foundryItemType === "tool" && config.isDnd5eV4) {
    const combined = nameLC + " " + descLC;
    newItemData.system.type = { value: resolveToolSubtype(combined) };
  }

  // ---------- Loot subtype ----------

  if (foundryItemType === "loot" && config.isDnd5eV4) {
    const combined = nameLC + " " + descLC;
    newItemData.system.type = { value: resolveLootSubtype(combined) };
  }

  // ---------- Activities (dnd5e v4+ only) ----------

  if (config.isDnd5eV4) {
    if (foundryItemType === "weapon") {
      buildWeaponActivities(newItemData, parsed);
    } else if (foundryItemType === "spell") {
      buildSpellActivities(newItemData, parsed, refinedName);
    } else if (foundryItemType === "consumable") {
      buildConsumableActivities(newItemData, parsed, refinedName, finalDesc);
    }
  }

  // ---------- Active Effects (ALL dnd5e versions) ----------

  applyMechanicalEffects(newItemData, parsed, foundryItemType);

  // --- Charges for items with spell-casting abilities ---
  if (parsed.charges && parsed.charges.max) {
    newItemData.system.uses = {
      max: String(parsed.charges.max),
      spent: 0,
      recovery: parsed.charges.recovery ? [{
        period: parsed.charges.recovery.period || "dawn",
        type: "formula",
        formula: parsed.charges.recovery.formula || "1d6"
      }] : []
    };
  }

  // ---------- Castable spells (staves, wands, rings, etc.) ----------

  await applyCastableSpells(newItemData, parsed, config);

  // ---------- Description validation pass ----------
  // Scan the description text for mechanical effects that GPT didn't capture
  // in structured data — adds missing Activities and Active Effects.
  await validateAndEnrichItem(newItemData, finalDesc, foundryItemType, config);

  // ---------- Compendium validation pass ----------
  // Cross-reference against SRD/compendium packs and check for duplicates.
  let compendiumWarnings = [];
  let duplicates = [];
  try {
    const compResult = await validateAgainstCompendium(newItemData);
    compendiumWarnings = compResult.warnings;
    duplicates = await checkDuplicates(newItemData.name);
  } catch (err) {
    // Compendium validation is optional — don't block generation if it fails
    console.warn("Compendium validation skipped:", err.message);
  }

  // Return all data needed to preview or create the item
  return {
    newItemData,
    imagePath: imagePath || "",
    refinedName,
    prompt: itemPrompt,
    config,
    explicitType,
    foundryItemType,
    rarity: parsed.rarity || "common",
    compendiumWarnings,
    duplicates
  };
}

/**
 * Create a Foundry Item document from pre-generated data and record it in history.
 * @param {object} result — the object returned by generateItemData()
 * @returns {Item} the created Foundry Item document
 */
/**
 * Find or create an Item folder by name. If parentId is given, creates as a subfolder.
 */
export async function getOrCreateItemFolder(name, parentId = null) {
  const existing = game.folders.find(f => f.name === name && f.type === "Item" && (f.folder?.id ?? f.folder ?? null) === parentId);
  if (existing) return existing.id;
  const data = { name, type: "Item" };
  if (parentId) data.folder = parentId;
  const folder = await Folder.create(data);
  return folder.id;
}

export async function createItemFromData(result, folderOverride = null) {
  const { newItemData, imagePath, refinedName, prompt, config, explicitType, foundryItemType, rarity } = result;

  // Place item in the specified folder, or default "AI Items" folder
  try {
    newItemData.folder = folderOverride ?? await getOrCreateItemFolder("AI Items");
  } catch (err) {
    console.warn("chatgpt-item-generator: Could not assign folder:", err.message);
  }

  let createdItem = await Item.create(newItemData);

  // Record in generation history (includes config + explicitType for regen support)
  if (game.chatGPTItemGenerator?.history) {
    const hist = game.chatGPTItemGenerator.history;
    hist.push({
      timestamp: Date.now(),
      prompt,
      itemName: createdItem.name,
      itemType: foundryItemType,
      itemId: createdItem.id,
      imagePath: imagePath || "",
      rarity: rarity || "common",
      config,
      explicitType: explicitType || ""
    });
    if (hist.length > 50) hist.shift();
  }

  return createdItem;
}

/**
 * Original entry point — generates item data and immediately creates the document.
 * Used by roll table generation and any existing callers. Behavior is identical to pre-refactor.
 */
export async function createUniqueItemDoc(itemPrompt, config, forcedName = null, explicitType = "", folderOverride = null) {
  showProgressBar();
  const result = await generateItemData(itemPrompt, config, forcedName, explicitType);
  const createdItem = await createItemFromData(result, folderOverride);
  updateProgressBar(100);
  hideProgressBar();
  ui.notifications.info(`New D&D 5e item created: ${result.refinedName} (Image: ${result.imagePath})`);
  return createdItem;
}
