/**
 * Activity & Active Effect builder utilities for dnd5e v4+/v5.
 *
 * Activities are the action system in dnd5e v4+ — attack rolls, saves,
 * damage, healing, utility actions, and spell casting from items.
 * Active Effects are Foundry core — passive bonuses, conditions, etc.
 *
 * Every builder returns a plain object ready to merge into item data.
 * Activities go into system.activities (keyed by _id).
 * Effects go into the root effects[] array.
 */

// ─────────────────────────────────────────────
//  ID Generation
// ─────────────────────────────────────────────

/** Generate a random 16-char alphanumeric ID (matches Foundry's format). */
function generateId() {
  return foundry.utils.randomID(16);
}

// ─────────────────────────────────────────────
//  Common Activity Template
// ─────────────────────────────────────────────

/**
 * Base activity structure shared by all types.
 * Merges overrides on top of sensible defaults.
 */
function activityBase(type, overrides = {}) {
  return {
    _id: generateId(),
    type,
    sort: 0,
    activation: { type: "action", override: false },
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
    useConditionText: "",
    useConditionReason: "",
    effectConditionText: "",
    macroData: { name: "", command: "" },
    ignoreTraits: { idi: false, idr: false, idv: false, ida: false, idm: false },
    ...overrides
  };
}

// ─────────────────────────────────────────────
//  Activity Builders
// ─────────────────────────────────────────────

/**
 * Build an attack activity for weapons or spell attacks.
 * @param {"melee"|"ranged"} attackType
 * @param {"weapon"|"spell"} classification
 * @param {string} bonus — attack bonus string (e.g. "" or "+1")
 * @returns {object} complete attack activity
 */
export function buildAttackActivity(attackType, classification, bonus = "") {
  return activityBase("attack", {
    attack: {
      critical: { threshold: null },
      flat: false,
      type: { value: attackType, classification },
      bonus: bonus || ""
    },
    damage: {
      critical: { bonus: "" },
      includeBase: true,
      parts: []
    }
  });
}

/**
 * Build a saving-throw activity for spells/effects.
 * @param {string} ability — 3-letter abbreviation: "dex", "wis", etc.
 * @param {Array} damageParts — array of damage part objects
 * @param {"none"|"half"} onSave — damage on successful save
 * @param {string} dcCalc — "spellcasting" or a fixed number string
 * @returns {object} complete save activity
 */
export function buildSaveActivity(ability, damageParts = [], onSave = "half", dcCalc = "spellcasting") {
  const saveObj = {
    ability: [ability],
    dc: { calculation: dcCalc }
  };

  return activityBase("save", {
    save: saveObj,
    damage: {
      onSave,
      parts: damageParts,
      critical: { allow: false }
    }
  });
}

/**
 * Build a standalone damage activity (extra damage, not part of attack).
 * @param {Array} damageParts — array of damage part objects
 * @param {string} [name] — optional activity name (e.g. "Extra Radiant Damage")
 * @returns {object} complete damage activity
 */
export function buildDamageActivity(damageParts = [], name = "") {
  return activityBase("damage", {
    name: name || "",
    damage: {
      critical: { allow: false },
      parts: damageParts
    }
  });
}

/**
 * Build a healing activity for potions, healing spells, etc.
 * @param {number} number — dice count
 * @param {number} denomination — die size (4, 6, 8, etc.)
 * @param {string} bonus — flat healing bonus as string
 * @param {Array} [consumptionTargets] — charge consumption targets
 * @returns {object} complete heal activity
 */
export function buildHealActivity(number, denomination, bonus = "0", consumptionTargets = []) {
  return activityBase("heal", {
    healing: {
      number: number || 0,
      denomination: denomination || 0,
      types: ["healing"],
      scaling: { number: 1 },
      bonus: String(bonus),
      custom: { enabled: false }
    },
    consumption: {
      scaling: { allowed: false },
      spellSlot: true,
      targets: consumptionTargets
    }
  });
}

/**
 * Build a utility activity for buffs, utility spells, etc.
 * @param {string} [name] — activity name
 * @param {string} [activationType] — "action", "bonus", "reaction"
 * @returns {object} complete utility activity
 */
export function buildUtilityActivity(name = "", activationType = "action") {
  return activityBase("utility", {
    name: name || "",
    activation: { type: activationType, override: false },
    roll: {
      prompt: false,
      visible: false,
      name: "",
      formula: ""
    }
  });
}

/**
 * Build a cast activity for items that cast spells via charges.
 * @param {string} spellUuid — UUID of the spell item to cast
 * @param {number} chargeCost — number of charges consumed
 * @param {string} [name] — activity name (e.g. "Cast Web")
 * @returns {object} complete cast activity
 */
export function buildCastActivity(spellUuid, chargeCost = 1, name = "") {
  return activityBase("cast", {
    name: name || "",
    img: "systems/dnd5e/icons/svg/activity/cast.svg",
    consumption: {
      scaling: { allowed: false },
      spellSlot: false,
      targets: [{
        type: "itemUses",
        value: String(chargeCost),
        scaling: {}
      }]
    },
    spell: {
      challenge: { override: false },
      level: null,
      properties: [],
      spellbook: true,
      uuid: spellUuid || ""
    }
  });
}

// ─────────────────────────────────────────────
//  Damage Part Builder
// ─────────────────────────────────────────────

/**
 * Build a single damage part object for use inside activities.
 * @param {string|string[]} types — damage type(s), e.g. "fire" or ["fire","radiant"]
 * @param {number} number — dice count
 * @param {number} denomination — die size
 * @param {string} [bonus] — flat bonus
 * @param {string} [scalingMode] — "whole" (cantrip), "level" (per-slot), or ""
 * @returns {object} damage part
 */
export function buildDamagePart(types, number, denomination, bonus = "", scalingMode = "") {
  return {
    types: Array.isArray(types) ? types : [types],
    number: number || 0,
    denomination: denomination || 0,
    bonus: bonus || "",
    scaling: {
      mode: scalingMode || "",
      number: 1
    },
    custom: { enabled: false }
  };
}

// ─────────────────────────────────────────────
//  Active Effect Builder
// ─────────────────────────────────────────────

/**
 * Build a Foundry Active Effect document.
 * @param {string} name — effect display name
 * @param {Array} changes — array of { key, mode, value, priority }
 * @param {object} [options]
 * @param {string[]} [options.statuses] — condition statuses (e.g. ["invisible"])
 * @param {boolean} [options.transfer] — true for passive/worn effects
 * @param {object} [options.duration] — { seconds, rounds, turns }
 * @param {boolean} [options.disabled] — start disabled
 * @param {string} [options.description] — effect description text
 * @param {string} [options.img] — icon path
 * @returns {object} complete Active Effect document
 */
export function buildActiveEffect(name, changes = [], options = {}) {
  return {
    _id: generateId(),
    name: name || "Effect",
    img: options.img || "",
    description: options.description || "",
    changes: changes.map(c => ({
      key: c.key,
      mode: c.mode ?? 2,
      value: String(c.value ?? ""),
      priority: c.priority ?? 20
    })),
    statuses: options.statuses || [],
    disabled: options.disabled ?? false,
    duration: {
      startTime: null,
      seconds: options.duration?.seconds ?? null,
      rounds: options.duration?.rounds ?? null,
      turns: options.duration?.turns ?? null,
      startRound: null,
      startTurn: null,
      combat: null
    },
    origin: null,
    transfer: options.transfer ?? true,
    type: "base",
    system: {},
    tint: "#ffffff",
    sort: 0
  };
}

// ─────────────────────────────────────────────
//  Effect Key Map — human-readable → Foundry paths
// ─────────────────────────────────────────────

/**
 * Maps simplified effect descriptors to Foundry data paths.
 * Format: "type.target" → { key, mode, value }
 *
 * Modes: 0 = Custom/Add, 1 = Multiply, 2 = Override/Add, 3 = Downgrade, 4 = Upgrade, 5 = Override
 */
const EFFECT_KEY_MAP = {
  // --- Skill Advantages (mode 2 = override roll mode, value "1" = advantage) ---
  "advantage.acrobatics":      { key: "system.skills.acr.roll.mode", mode: 2, value: "1" },
  "advantage.animal handling": { key: "system.skills.ani.roll.mode", mode: 2, value: "1" },
  "advantage.arcana":          { key: "system.skills.arc.roll.mode", mode: 2, value: "1" },
  "advantage.athletics":       { key: "system.skills.ath.roll.mode", mode: 2, value: "1" },
  "advantage.deception":       { key: "system.skills.dec.roll.mode", mode: 2, value: "1" },
  "advantage.history":         { key: "system.skills.his.roll.mode", mode: 2, value: "1" },
  "advantage.insight":         { key: "system.skills.ins.roll.mode", mode: 2, value: "1" },
  "advantage.intimidation":    { key: "system.skills.itm.roll.mode", mode: 2, value: "1" },
  "advantage.investigation":   { key: "system.skills.inv.roll.mode", mode: 2, value: "1" },
  "advantage.medicine":        { key: "system.skills.med.roll.mode", mode: 2, value: "1" },
  "advantage.nature":          { key: "system.skills.nat.roll.mode", mode: 2, value: "1" },
  "advantage.perception":      { key: "system.skills.prc.roll.mode", mode: 2, value: "1" },
  "advantage.performance":     { key: "system.skills.prf.roll.mode", mode: 2, value: "1" },
  "advantage.persuasion":      { key: "system.skills.per.roll.mode", mode: 2, value: "1" },
  "advantage.religion":        { key: "system.skills.rel.roll.mode", mode: 2, value: "1" },
  "advantage.sleight of hand": { key: "system.skills.slt.roll.mode", mode: 2, value: "1" },
  "advantage.stealth":         { key: "system.skills.ste.roll.mode", mode: 2, value: "1" },
  "advantage.survival":        { key: "system.skills.sur.roll.mode", mode: 2, value: "1" },

  // --- Ability Score Bonuses (mode 2 = add to checks, value filled dynamically) ---
  "bonus.strength":     { key: "system.abilities.str.bonuses.check", mode: 2 },
  "bonus.dexterity":    { key: "system.abilities.dex.bonuses.check", mode: 2 },
  "bonus.constitution": { key: "system.abilities.con.bonuses.check", mode: 2 },
  "bonus.intelligence": { key: "system.abilities.int.bonuses.check", mode: 2 },
  "bonus.wisdom":       { key: "system.abilities.wis.bonuses.check", mode: 2 },
  "bonus.charisma":     { key: "system.abilities.cha.bonuses.check", mode: 2 },

  // --- Saving Throw Bonuses ---
  "bonus.strength save":     { key: "system.abilities.str.bonuses.save", mode: 2 },
  "bonus.dexterity save":    { key: "system.abilities.dex.bonuses.save", mode: 2 },
  "bonus.constitution save": { key: "system.abilities.con.bonuses.save", mode: 2 },
  "bonus.intelligence save": { key: "system.abilities.int.bonuses.save", mode: 2 },
  "bonus.wisdom save":       { key: "system.abilities.wis.bonuses.save", mode: 2 },
  "bonus.charisma save":     { key: "system.abilities.cha.bonuses.save", mode: 2 },
  "bonus.all saves":         { key: "system.bonuses.abilities.save", mode: 2 },

  // --- AC Bonus ---
  "bonus.ac": { key: "system.attributes.ac.bonus", mode: 2 },

  // --- Movement (mode 2 = add to base, value filled dynamically) ---
  "speed.walk":   { key: "system.attributes.movement.walk",  mode: 2 },
  "speed.fly":    { key: "system.attributes.movement.fly",   mode: 2 },
  "speed.swim":   { key: "system.attributes.movement.swim",  mode: 2 },
  "speed.climb":  { key: "system.attributes.movement.climb", mode: 2 },
  "speed.burrow": { key: "system.attributes.movement.burrow", mode: 2 },

  // --- Damage Resistances (mode 0 = add to set) ---
  "resistance.acid":        { key: "system.traits.dr.value", mode: 0, value: "acid" },
  "resistance.bludgeoning": { key: "system.traits.dr.value", mode: 0, value: "bludgeoning" },
  "resistance.cold":        { key: "system.traits.dr.value", mode: 0, value: "cold" },
  "resistance.fire":        { key: "system.traits.dr.value", mode: 0, value: "fire" },
  "resistance.force":       { key: "system.traits.dr.value", mode: 0, value: "force" },
  "resistance.lightning":   { key: "system.traits.dr.value", mode: 0, value: "lightning" },
  "resistance.necrotic":    { key: "system.traits.dr.value", mode: 0, value: "necrotic" },
  "resistance.piercing":    { key: "system.traits.dr.value", mode: 0, value: "piercing" },
  "resistance.poison":      { key: "system.traits.dr.value", mode: 0, value: "poison" },
  "resistance.psychic":     { key: "system.traits.dr.value", mode: 0, value: "psychic" },
  "resistance.radiant":     { key: "system.traits.dr.value", mode: 0, value: "radiant" },
  "resistance.slashing":    { key: "system.traits.dr.value", mode: 0, value: "slashing" },
  "resistance.thunder":     { key: "system.traits.dr.value", mode: 0, value: "thunder" },

  // --- Damage Immunities (mode 0 = add to set) ---
  "immunity.acid":        { key: "system.traits.di.value", mode: 0, value: "acid" },
  "immunity.cold":        { key: "system.traits.di.value", mode: 0, value: "cold" },
  "immunity.fire":        { key: "system.traits.di.value", mode: 0, value: "fire" },
  "immunity.force":       { key: "system.traits.di.value", mode: 0, value: "force" },
  "immunity.lightning":   { key: "system.traits.di.value", mode: 0, value: "lightning" },
  "immunity.necrotic":    { key: "system.traits.di.value", mode: 0, value: "necrotic" },
  "immunity.poison":      { key: "system.traits.di.value", mode: 0, value: "poison" },
  "immunity.psychic":     { key: "system.traits.di.value", mode: 0, value: "psychic" },
  "immunity.radiant":     { key: "system.traits.di.value", mode: 0, value: "radiant" },
  "immunity.thunder":     { key: "system.traits.di.value", mode: 0, value: "thunder" },

  // --- Condition Immunities (mode 0 = add to set) ---
  "immunity.blinded":     { key: "system.traits.ci.value", mode: 0, value: "blinded" },
  "immunity.charmed":     { key: "system.traits.ci.value", mode: 0, value: "charmed" },
  "immunity.deafened":    { key: "system.traits.ci.value", mode: 0, value: "deafened" },
  "immunity.frightened":  { key: "system.traits.ci.value", mode: 0, value: "frightened" },
  "immunity.grappled":    { key: "system.traits.ci.value", mode: 0, value: "grappled" },
  "immunity.incapacitated": { key: "system.traits.ci.value", mode: 0, value: "incapacitated" },
  "immunity.paralyzed":   { key: "system.traits.ci.value", mode: 0, value: "paralyzed" },
  "immunity.petrified":   { key: "system.traits.ci.value", mode: 0, value: "petrified" },
  "immunity.poisoned":    { key: "system.traits.ci.value", mode: 0, value: "poisoned" },
  "immunity.prone":       { key: "system.traits.ci.value", mode: 0, value: "prone" },
  "immunity.restrained":  { key: "system.traits.ci.value", mode: 0, value: "restrained" },
  "immunity.stunned":     { key: "system.traits.ci.value", mode: 0, value: "stunned" },
  "immunity.unconscious": { key: "system.traits.ci.value", mode: 0, value: "unconscious" },

  // --- Senses (mode 4 = upgrade existing value) ---
  "sense.darkvision":     { key: "system.attributes.senses.darkvision",    mode: 4 },
  "sense.blindsight":     { key: "system.attributes.senses.blindsight",    mode: 4 },
  "sense.tremorsense":    { key: "system.attributes.senses.tremorsense",   mode: 4 },
  "sense.truesight":      { key: "system.attributes.senses.truesight",     mode: 4 }
};

/** Export the map for direct use if needed. */
export { EFFECT_KEY_MAP };

/**
 * Look up a human-readable effect descriptor and return a Foundry change object.
 * Handles both exact matches ("advantage.stealth") and type+target combinations.
 *
 * @param {string} type — effect type: "advantage", "bonus", "resistance", "immunity", "speed", "sense"
 * @param {string} target — what it affects: "stealth", "fire", "ac", "darkvision", etc.
 * @param {*} value — the value (numeric bonus, boolean, distance, etc.)
 * @returns {{ key: string, mode: number, value: string }|null}
 */
export function mapEffectChange(type, target, value) {
  if (!type || !target) return null;

  const lookupKey = `${type.toLowerCase()}.${target.toLowerCase()}`;
  const entry = EFFECT_KEY_MAP[lookupKey];

  if (!entry) return null;

  // Clone the entry and fill in dynamic value
  const change = { key: entry.key, mode: entry.mode };

  if (entry.value !== undefined) {
    // Static value (e.g., resistance targets, condition names)
    change.value = entry.value;
  } else {
    // Dynamic value (e.g., bonus amounts, movement distances)
    change.value = String(value ?? "");
  }

  return change;
}

/**
 * Convert duration units + value to seconds for Active Effect duration.
 * @param {string} units — "inst", "round", "minute", "hour", "day"
 * @param {number|string} value — duration value
 * @returns {number|null} seconds, or null for instantaneous/permanent
 */
export function durationToSeconds(units, value) {
  const num = parseInt(value) || 0;
  switch (units) {
    case "round":  return num * 6;
    case "minute": return num * 60;
    case "hour":   return num * 3600;
    case "day":    return num * 86400;
    default:       return null; // inst, perm, spec
  }
}
