/**
 * Compendium-aware validation utilities.
 * Provides SRD cross-reference, duplicate detection, and smart defaults
 * from compendium packs as a fallback layer.
 */

// Session-level cache for compendium pack indexes to avoid repeated loading
const _indexCache = new Map();

/**
 * Get the index for a compendium pack, using cache when available.
 * @param {CompendiumCollection} pack
 * @returns {Promise<Collection>}
 */
async function getCachedIndex(pack) {
  const key = pack.collection;
  if (_indexCache.has(key)) return _indexCache.get(key);
  try {
    const index = await pack.getIndex({ fields: ["name", "type", "system"] });
    _indexCache.set(key, index);
    return index;
  } catch (err) {
    console.warn(`compendium-utils: Could not index ${key}:`, err.message);
    return null;
  }
}

/**
 * Search world items and compendium packs for an item matching by name and optional type.
 * Does NOT import the item — returns the match info.
 *
 * @param {string} name — item name to search for
 * @param {string} [type] — optional Foundry item type filter (e.g. "weapon", "spell")
 * @returns {Promise<{name: string, type: string, source: string, pack: string, system: object}|null>}
 */
export async function findCompendiumItem(name, type) {
  if (!name) return null;
  const nameLower = name.toLowerCase().trim();

  // 1. Check world items
  const worldMatch = game.items.find(i => {
    if (type && i.type !== type) return false;
    return i.name.toLowerCase() === nameLower;
  });
  if (worldMatch) {
    return {
      name: worldMatch.name,
      type: worldMatch.type,
      source: "world",
      pack: "World Items",
      system: worldMatch.system
    };
  }

  // 2. Search compendium packs
  for (const pack of game.packs) {
    if (pack.metadata.type !== "Item") continue;
    const index = await getCachedIndex(pack);
    if (!index) continue;

    const match = index.find(e => {
      if (type && e.type !== type) return false;
      return e.name.toLowerCase() === nameLower;
    });
    if (match) {
      return {
        name: match.name,
        type: match.type,
        source: "compendium",
        pack: pack.metadata.label || pack.collection,
        system: match.system || {}
      };
    }
  }

  return null;
}

/**
 * Get system data from a compendium item to use as defaults.
 * Returns a partial system data object, or null if not found.
 *
 * @param {string} name — item name
 * @param {string} type — Foundry item type
 * @returns {Promise<object|null>} partial system data
 */
export async function getCompendiumDefaults(name, type) {
  const match = await findCompendiumItem(name, type);
  if (!match || !match.system) return null;
  return match.system;
}

/**
 * Check for duplicate items by name across world and compendium packs.
 * Returns all matches (could be multiple across different packs).
 *
 * @param {string} name — item name to check
 * @returns {Promise<Array<{name: string, source: string, pack: string}>>}
 */
export async function checkDuplicates(name) {
  if (!name) return [];
  const nameLower = name.toLowerCase().trim();
  const duplicates = [];

  // Check world items
  const worldMatches = game.items.filter(i => i.name.toLowerCase() === nameLower);
  for (const item of worldMatches) {
    duplicates.push({
      name: item.name,
      source: "world",
      pack: "World Items"
    });
  }

  // Check compendium packs
  for (const pack of game.packs) {
    if (pack.metadata.type !== "Item") continue;
    const index = await getCachedIndex(pack);
    if (!index) continue;

    const matches = index.filter(e => e.name.toLowerCase() === nameLower);
    for (const match of matches) {
      duplicates.push({
        name: match.name,
        source: "compendium",
        pack: pack.metadata.label || pack.collection
      });
    }
  }

  return duplicates;
}

/**
 * Validate generated item data against compendium/SRD equivalents.
 * Returns warnings about discrepancies and suggestions for corrections.
 *
 * @param {object} newItemData — the generated item data (pre-creation)
 * @returns {Promise<{warnings: string[], suggestions: Array<{field: string, expected: any, actual: any}>}>}
 */
export async function validateAgainstCompendium(newItemData) {
  const warnings = [];
  const suggestions = [];

  if (!newItemData?.name) return { warnings, suggestions };

  const match = await findCompendiumItem(newItemData.name, newItemData.type);
  if (!match || !match.system) return { warnings, suggestions };

  const gen = newItemData.system || {};
  const srd = match.system;

  // Compare key fields based on item type
  if (newItemData.type === "weapon") {
    // Damage comparison
    const genDmg = gen.damage?.base || gen.damage;
    const srdDmg = srd.damage?.base || srd.damage;
    if (genDmg && srdDmg) {
      if (genDmg.denomination !== srdDmg.denomination || genDmg.number !== srdDmg.number) {
        const genStr = `${genDmg.number || 1}d${genDmg.denomination || "?"}`;
        const srdStr = `${srdDmg.number || 1}d${srdDmg.denomination || "?"}`;
        if (genStr !== srdStr) {
          warnings.push(`Damage dice: generated ${genStr}, SRD has ${srdStr}`);
          suggestions.push({ field: "damage", expected: srdStr, actual: genStr });
        }
      }
    }
  }

  if (newItemData.type === "equipment" && gen.armor?.value && srd.armor?.value) {
    if (gen.armor.value !== srd.armor.value) {
      warnings.push(`AC: generated ${gen.armor.value}, SRD has ${srd.armor.value}`);
      suggestions.push({ field: "armor.value", expected: srd.armor.value, actual: gen.armor.value });
    }
  }

  if (newItemData.type === "spell") {
    if (gen.level !== undefined && srd.level !== undefined && gen.level !== srd.level) {
      warnings.push(`Spell level: generated ${gen.level}, SRD has ${srd.level}`);
      suggestions.push({ field: "level", expected: srd.level, actual: gen.level });
    }
    if (gen.school && srd.school && gen.school !== srd.school) {
      warnings.push(`School: generated ${gen.school}, SRD has ${srd.school}`);
      suggestions.push({ field: "school", expected: srd.school, actual: gen.school });
    }
  }

  return { warnings, suggestions };
}
