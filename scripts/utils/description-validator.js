/**
 * Post-creation description validation & enrichment.
 *
 * Two-pass system:
 *   1. Regex scan — fast, free, catches common patterns instantly
 *   2. GPT scan  — sends description back to GPT to identify effects
 *                  regex missed (ambiguous phrasing, complex conditions)
 *
 * Both passes de-duplicate against existing effects so nothing doubles up.
 * Called right before Item.create() — modifies newItemData in-place.
 */

import {
  buildAttackActivity, buildDamageActivity,
  buildDamagePart, buildActiveEffect, mapEffectChange
} from './activity-utils.js';
import { parseDamageFormula } from './weapon-utils.js';
import { gptValidateItemEffects } from '../api/openai.js';

// ---------- Constants ----------

const DAMAGE_TYPES = new Set([
  "acid", "bludgeoning", "cold", "fire", "force", "lightning",
  "necrotic", "piercing", "poison", "psychic", "radiant",
  "slashing", "thunder"
]);

const CONDITIONS = new Set([
  "blinded", "charmed", "deafened", "frightened", "grappled",
  "incapacitated", "invisible", "paralyzed", "petrified",
  "poisoned", "prone", "restrained", "stunned", "unconscious"
]);

const SKILLS = new Set([
  "acrobatics", "animal handling", "arcana", "athletics", "deception",
  "history", "insight", "intimidation", "investigation", "medicine",
  "nature", "perception", "performance", "persuasion", "religion",
  "sleight of hand", "stealth", "survival"
]);

const SENSES = ["darkvision", "blindsight", "tremorsense", "truesight"];

/**
 * Capitalize the first letter of a string.
 * @param {string} s — input string
 * @returns {string} capitalized string, or "" if input is falsy
 */
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

/**
 * Effect types that are already handled by the armor system fields
 * (system.armor.value, system.armor.magicalBonus, system.armor.dex,
 *  system.properties stealthDisadvantage). These should NOT become
 * Active Effects on armor items — they'd double-count.
 */
const ARMOR_SYSTEM_TARGETS = new Set(["ac", "stealth"]);

// ---------- Effect Adder (shared by both passes) ----------

/**
 * Try to add an Active Effect from a mechanical effect descriptor.
 * Checks for duplicates before adding.
 * @param {Array<object>} effects — the item's effects array (mutated)
 * @param {object} mechEffect — effect descriptor with type, target, value, name
 * @param {string} img — item image path for the effect icon
 * @param {boolean} [isArmorItem=false] — if true, skip effects already handled by armor system
 * @returns {boolean} true if an effect was added, false if skipped/duplicate
 */
function tryAddEffect(effects, mechEffect, img, isArmorItem = false) {
  if (!mechEffect.type || !mechEffect.target) return false;

  // Armor items: AC and stealth are handled by system.armor / properties
  // Adding Active Effects for these would double-count
  if (isArmorItem && ARMOR_SYSTEM_TARGETS.has(mechEffect.target?.toLowerCase())) return false;

  const change = mapEffectChange(mechEffect.type, mechEffect.target, mechEffect.value);
  if (!change) return false;

  // De-duplicate: skip if an effect with this exact key already exists
  const already = effects.some(e =>
    e.changes?.some(c => c.key === change.key && c.value === change.value)
  );
  if (already) return false;

  const name = mechEffect.name || `${cap(mechEffect.target)} ${cap(mechEffect.type)}`;
  effects.push(buildActiveEffect(name, [change], {
    transfer: true,
    img: img
  }));
  return true;
}

/**
 * Try to add an extra damage activity. De-duplicates by damage type.
 * @param {object} activities — the item's activities map (mutated)
 * @param {string} formula — dice formula (e.g. "1d6")
 * @param {string} dmgType — damage type (e.g. "fire", "radiant")
 * @returns {boolean} true if an activity was added, false if skipped/duplicate
 */
function tryAddExtraDamage(activities, formula, dmgType) {
  if (!DAMAGE_TYPES.has(dmgType)) return false;

  const hasDmg = Object.values(activities).some(a =>
    a.type === "damage" && a.damage?.parts?.some(p => p.types?.includes(dmgType))
  );
  if (hasDmg) return false;

  const pf = parseDamageFormula(formula);
  if (!pf) return false;

  const part = buildDamagePart(dmgType, pf.number, pf.denomination, pf.bonus || "");
  const label = `Extra ${cap(dmgType)} Damage`;
  const dmgAct = buildDamageActivity([part], label);
  activities[dmgAct._id] = dmgAct;
  return true;
}

// ---------- Pass 1: Regex Scan ----------

/**
 * Pass 1: scan item description with regex patterns to find mechanical effects.
 * @param {object} activities — the item's activities map (mutated)
 * @param {Array<object>} effects — the item's effects array (mutated)
 * @param {string} text — plain text description (HTML stripped)
 * @param {string} textLC — lowercase version of text
 * @param {string} foundryItemType — Foundry item type (e.g. "weapon", "equipment")
 * @param {object} config — module config (needs isDnd5eV4)
 * @param {string} img — item image path
 * @param {boolean} isArmorItem — true if armor (skips AC/stealth effects)
 * @param {string} weaponClassification — weapon classification code (e.g. "simpleM")
 * @returns {{addedAct: number, addedEff: number}} count of added activities and effects
 */
function regexScan(activities, effects, text, textLC, foundryItemType, config, img, isArmorItem, weaponClassification) {
  let addedAct = 0;
  let addedEff = 0;

  // ── 1. Weapons: ensure attack activity exists ──────────────────
  if (foundryItemType === "weapon" && config.isDnd5eV4) {
    const hasAttack = Object.values(activities).some(a => a.type === "attack");
    if (!hasAttack) {
      const classification = weaponClassification || "simpleM";
      const isRanged = classification.endsWith("R");
      const atkType = isRanged ? "ranged" : "melee";
      const atk = buildAttackActivity(atkType, "weapon", "");
      activities[atk._id] = atk;
      addedAct++;
      console.debug("Validator: Added missing attack activity for weapon");
    }
  }

  // ── 2. Extra damage from description (weapons) ────────────────
  if (foundryItemType === "weapon" && config.isDnd5eV4) {
    const extraDmgPattern = /(?:additional|extra|bonus|plus)\s+(\d+d\d+(?:\s*[+-]\s*\d+)?)\s+(\w+)\s+damage/gi;
    let match;
    while ((match = extraDmgPattern.exec(text)) !== null) {
      const formula = match[1].replace(/\s+/g, "");
      const dmgType = match[2].toLowerCase();
      if (tryAddExtraDamage(activities, formula, dmgType)) {
        addedAct++;

      }
    }
  }

  // ── 3. Resistances ─────────────────────────────────────────────
  const resistPatterns = [
    /(?:resistance|resistant)\s+to\s+(.{3,80}?)(?:\s+damage|\.|;|,\s*(?:and\s+)?(?:advantage|you|the|it|this|while))/gi,
    /(?:grants?|provides?|gives?|gain)\s+(?:you\s+)?(?:[\w\s]{0,20}?)resistance\s+to\s+(.{3,60}?)(?:\s+damage|\.|;|$)/gi
  ];
  for (const pattern of resistPatterns) {
    let match;
    while ((match = pattern.exec(textLC)) !== null) {
      for (const dt of DAMAGE_TYPES) {
        if (match[1].includes(dt)) {
          if (tryAddEffect(effects, { name: `${cap(dt)} Resistance`, type: "resistance", target: dt, value: true }, img, isArmorItem)) {
            addedEff++;
          }
        }
      }
    }
  }

  // ── 4. Damage immunities ───────────────────────────────────────
  const dmgImmPattern = /(?:immune|immunity)\s+to\s+(.{3,60}?)\s+damage/gi;
  let dmgImmMatch;
  while ((dmgImmMatch = dmgImmPattern.exec(textLC)) !== null) {
    for (const dt of DAMAGE_TYPES) {
      if (dmgImmMatch[1].includes(dt)) {
        if (tryAddEffect(effects, { name: `${cap(dt)} Damage Immunity`, type: "immunity", target: dt, value: true }, img, isArmorItem)) {
          addedEff++;
        }
      }
    }
  }

  // ── 5. Condition immunities ────────────────────────────────────
  const condImmPatterns = [
    /(?:immune|immunity)\s+to\s+(?:the\s+)?(?:being\s+)?(\w+)(?:\s+condition)?/gi,
    /(?:can'?t|cannot)\s+be\s+(\w+)/gi
  ];
  for (const pattern of condImmPatterns) {
    let match;
    while ((match = pattern.exec(textLC)) !== null) {
      const cond = match[1].toLowerCase();
      if (CONDITIONS.has(cond)) {
        if (tryAddEffect(effects, { name: `${cap(cond)} Immunity`, type: "immunity", target: cond, value: true }, img, isArmorItem)) {
          addedEff++;
        }
      }
    }
  }

  // ── 6. Skill advantages ────────────────────────────────────────
  const skillAdvPattern = /\badvantage\s+on\s+([\w\s]+?)\s+checks?/gi;
  let skillMatch;
  while ((skillMatch = skillAdvPattern.exec(textLC)) !== null) {
    const skillName = skillMatch[1].trim();
    if (SKILLS.has(skillName)) {
      const label = skillName.split(" ").map(w => cap(w)).join(" ");
      if (tryAddEffect(effects, { name: `${label} Advantage`, type: "advantage", target: skillName, value: "1" }, img, isArmorItem)) {
        addedEff++;
      }
    }
  }

  // ── 7. Senses ──────────────────────────────────────────────────
  for (const sense of SENSES) {
    const patterns = [
      new RegExp(`${sense}\\s+(?:out\\s+to\\s+|to\\s+(?:a\\s+)?(?:range\\s+of\\s+)?|of\\s+|up\\s+to\\s+)?(\\d+)\\s*(?:feet|ft\\.?)`, "gi"),
      new RegExp(`(\\d+)\\s*(?:feet|ft\\.?)\\s+(?:of\\s+)?${sense}`, "gi")
    ];
    for (const pattern of patterns) {
      const senseMatch = pattern.exec(textLC);
      if (senseMatch) {
        const distance = parseInt(senseMatch[1], 10);
        if (distance > 0) {
          if (tryAddEffect(effects, { name: `${cap(sense)} ${distance} ft.`, type: "sense", target: sense, value: distance }, img, isArmorItem)) {
            addedEff++;
          }
        }
        break;
      }
    }
  }

  // ── 8. Speed bonuses ───────────────────────────────────────────
  const speedChecks = [
    { pattern: /(?:walking|movement)\s+speed\s+(?:increases?|is\s+increased)\s+by\s+(\d+)/gi, type: "walk" },
    { pattern: /(?:gain|have)\s+(?:a\s+)?(?:fly|flying)\s+speed\s+(?:of\s+)?(\d+)/gi, type: "fly" },
    { pattern: /(?:gain|have)\s+(?:a\s+)?(?:swim|swimming)\s+speed\s+(?:of\s+)?(\d+)/gi, type: "swim" },
    { pattern: /(?:gain|have)\s+(?:a\s+)?(?:climb|climbing)\s+speed\s+(?:of\s+)?(\d+)/gi, type: "climb" },
    { pattern: /(?:gain|have)\s+(?:a\s+)?(?:burrow|burrowing)\s+speed\s+(?:of\s+)?(\d+)/gi, type: "burrow" }
  ];
  for (const { pattern, type } of speedChecks) {
    const speedMatch = pattern.exec(textLC);
    if (speedMatch) {
      const distance = parseInt(speedMatch[1], 10);
      if (distance > 0) {
        if (tryAddEffect(effects, { name: `${cap(type)} Speed +${distance} ft.`, type: "speed", target: type, value: distance }, img, isArmorItem)) {
          addedEff++;
        }
      }
    }
  }

  // ── 9. AC bonus (skip for armor — armor system handles AC) ────
  if (!isArmorItem) {
    const acPatterns = [
      /\+(\d)\s+(?:bonus\s+)?to\s+(?:your\s+)?(?:armor class|ac)/gi,
      /(?:armor class|ac)\s+(?:increases?|is\s+increased)\s+by\s+(\d)/gi,
      /grants?\s+(?:a\s+)?\+(\d)\s+(?:bonus\s+)?to\s+(?:armor class|ac)/gi
    ];
    for (const pattern of acPatterns) {
      const acMatch = pattern.exec(textLC);
      if (acMatch) {
        const bonus = parseInt(acMatch[1], 10);
        if (bonus > 0 && bonus <= 5) {
          if (tryAddEffect(effects, { name: `AC +${bonus}`, type: "bonus", target: "ac", value: bonus }, img)) {
            addedEff++;
          }
        }
        break;
      }
    }
  }

  // ── 10. Save bonuses ───────────────────────────────────────────
  const saveBonusPattern = /\+(\d)\s+(?:bonus\s+)?to\s+(?:all\s+)?saving\s+throws?/gi;
  const saveBonusMatch = saveBonusPattern.exec(textLC);
  if (saveBonusMatch) {
    const bonus = parseInt(saveBonusMatch[1], 10);
    if (bonus > 0 && bonus <= 5) {
      if (tryAddEffect(effects, { name: `Save Bonus +${bonus}`, type: "bonus", target: "all saves", value: bonus }, img, isArmorItem)) {
        addedEff++;
      }
    }
  }

  return { addedAct, addedEff };
}

// ---------- Pass 2: GPT Informed Scan ----------

/**
 * Pass 2: send description to GPT to find mechanical effects regex missed.
 * @param {object} activities — the item's activities map (mutated)
 * @param {Array<object>} effects — the item's effects array (mutated)
 * @param {string} description — raw HTML description
 * @param {string} foundryItemType — Foundry item type
 * @param {object} config — module config (needs apiKey, isDnd5eV4)
 * @param {string} img — item image path
 * @param {boolean} isArmorItem — true if armor
 * @returns {Promise<{addedAct: number, addedEff: number}>} count of added activities and effects
 */
async function gptScan(activities, effects, description, foundryItemType, config, img, isArmorItem) {
  let addedAct = 0;
  let addedEff = 0;

  const gptResult = await gptValidateItemEffects(description, foundryItemType, isArmorItem, config);
  if (!gptResult) return { addedAct, addedEff };

  // Process mechanical effects from GPT
  if (gptResult.mechanicalEffects && gptResult.mechanicalEffects.length > 0) {
    for (const mechEffect of gptResult.mechanicalEffects) {
      if (tryAddEffect(effects, mechEffect, img, isArmorItem)) {
        addedEff++;
      }
    }
  }

  // Process extra damage from GPT (weapons only)
  if (foundryItemType === "weapon" && config.isDnd5eV4 && gptResult.extraDamage && gptResult.extraDamage.length > 0) {
    for (const extraDmg of gptResult.extraDamage) {
      const dmgType = (extraDmg.type || "").toLowerCase();
      if (tryAddExtraDamage(activities, extraDmg.formula, dmgType)) {
        addedAct++;
      }
    }
  }

  return { addedAct, addedEff };
}

// ---------- Main Validator (public API) ----------

/**
 * Scan the item description and add missing Activities / Active Effects.
 * Runs two passes: regex (instant) then GPT (informed).
 * Both de-duplicate against existing + each other's additions.
 *
 * @param {object} newItemData  — the item data object being built (mutated)
 * @param {string} description  — the item description HTML
 * @param {string} foundryItemType — "weapon", "spell", "equipment", etc.
 * @param {object} config — module config (needs isDnd5eV4, apiKey)
 */
export async function validateAndEnrichItem(newItemData, description, foundryItemType, config) {
  if (!description) return;

  // Strip HTML and normalize
  const text = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  const textLC = text.toLowerCase();

  // Ensure arrays exist
  if (!newItemData.system.activities) newItemData.system.activities = {};
  if (!newItemData.effects) newItemData.effects = [];
  const activities = newItemData.system.activities;
  const effects = newItemData.effects;
  const img = newItemData.img;

  // Extract weapon classification for the regex scan (avoid mutating config)
  const weaponClassification = newItemData.system.type?.value || "simpleM";

  // Detect armor items: AC, stealth, dex cap are handled by system.armor fields
  // Active Effects for these would double-count, so both passes skip them
  const isArmorItem = foundryItemType === "equipment" &&
    ["light", "medium", "heavy", "natural", "shield"].includes(newItemData.system.type?.value);

  // Pass 1: Regex — fast, free, catches common patterns
  const regexResults = regexScan(activities, effects, text, textLC, foundryItemType, config, img, isArmorItem, weaponClassification);

  // Pass 2: GPT — informed, catches nuanced phrasing regex misses
  const gptResults = await gptScan(activities, effects, description, foundryItemType, config, img, isArmorItem);

  const totalAct = regexResults.addedAct + gptResults.addedAct;
  const totalEff = regexResults.addedEff + gptResults.addedEff;

  if (totalAct > 0 || totalEff > 0) {
    console.log(`Description validator: Added ${totalAct} activities (regex: ${regexResults.addedAct}, GPT: ${gptResults.addedAct}) and ${totalEff} effects (regex: ${regexResults.addedEff}, GPT: ${gptResults.addedEff})`);
  }
}
