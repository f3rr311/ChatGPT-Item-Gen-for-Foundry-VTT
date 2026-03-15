/**
 * Programmatic advancement application for AI-generated characters.
 * Reads advancement arrays from embedded species/background compendium items
 * and auto-fills their value fields so Foundry treats them as "completed."
 *
 * This work includes material taken from the System Reference Document 5.1
 * ("SRD 5.1") by Wizards of the Coast LLC, available at
 * https://www.dndbeyond.com/srd. The SRD 5.1 is licensed under the Creative
 * Commons Attribution 4.0 International License available at
 * https://creativecommons.org/licenses/by/4.0/legalcode.
 */

import { ABILITY_KEYS } from './actor-utils.js';

// ─── Trait Key Parsing ───

/**
 * Parse an advancement trait key into category/key components.
 * Examples:
 *   "skills:prc" → { category: "skills", key: "prc" }
 *   "tool:art:calligrapher" → { category: "tool", key: "art:calligrapher" }
 *   "languages:standard:common" → { category: "languages", key: "common" }
 *   "languages:standard:*" → { category: "languages", key: "*" }
 * @param {string} traitKey
 * @returns {{ category: string, key: string }}
 */
export function parseTraitKey(traitKey) {
  if (!traitKey || typeof traitKey !== "string") return { category: "", key: "" };
  const parts = traitKey.split(":");
  if (parts.length === 2) {
    return { category: parts[0], key: parts[1] };
  }
  if (parts.length >= 3) {
    // "languages:standard:elvish" → category "languages", key "elvish"
    // "tool:art:calligrapher" → category "tool", key "art:calligrapher"
    if (parts[0] === "languages") {
      return { category: "languages", key: parts[parts.length - 1] };
    }
    return { category: parts[0], key: parts.slice(1).join(":") };
  }
  return { category: parts[0], key: "" };
}

/**
 * Check if a trait key matches something in the AI-generated data.
 * @param {string} traitKey — e.g. "skills:prc"
 * @param {object} data — validated character data
 * @returns {boolean}
 */
export function matchTraitToAIData(traitKey, data) {
  const { category, key } = parseTraitKey(traitKey);
  if (!category || !key) return false;

  if (category === "skills") {
    return data.skills?.includes(key) ?? false;
  }
  if (category === "languages") {
    if (key === "*") return true; // wildcard — matches anything
    const langValues = data.languages?.value || data.languages || [];
    if (Array.isArray(langValues)) {
      return langValues.some(l => l.toLowerCase() === key.toLowerCase());
    }
    return false;
  }
  if (category === "tool") {
    // Tool proficiencies aren't always tracked separately in AI data
    // Accept any tool grant
    return true;
  }
  return false;
}

// ─── Advancement Resolvers ───

/**
 * Resolve a Size advancement.
 * @param {object} adv — advancement object
 * @param {object} data — validated character data
 * @returns {{ value: object }}
 */
export function resolveSize(adv, data) {
  const sizes = adv.configuration?.sizes || ["med"];
  const dataSize = data.size || "med";
  const size = sizes.includes(dataSize) ? dataSize : sizes[0];
  return { value: { size } };
}

/**
 * Resolve an AbilityScoreImprovement advancement.
 * The AI already set final ability scores. We fill in plausible assignments
 * to make Foundry's tracker happy without modifying actual scores.
 * @param {object} adv — advancement object
 * @param {object} data — validated character data
 * @returns {{ value: object }}
 */
export function resolveASI(adv, data) {
  const config = adv.configuration || {};
  const points = config.points || 3;
  const cap = config.cap || 2;
  const locked = new Set(config.locked || []);

  // Get unlocked abilities sorted by AI score (descending) — distribute to highest
  const unlocked = ABILITY_KEYS
    .filter(k => !locked.has(k))
    .sort((a, b) => (data.abilities?.[b] || 10) - (data.abilities?.[a] || 10));

  const assignments = {};
  let remaining = points;

  for (const ability of unlocked) {
    if (remaining <= 0) break;
    const give = Math.min(cap, remaining);
    assignments[ability] = give;
    remaining -= give;
  }

  return {
    value: {
      type: "asi",
      assignments
    }
  };
}

/**
 * Resolve a Trait advancement (proficiency grants + choices).
 * @param {object} adv — advancement object
 * @param {object} data — validated character data
 * @returns {{ value: object }}
 */
export function resolveTrait(adv, data) {
  const config = adv.configuration || {};
  const grants = config.grants || [];
  const choices = config.choices || [];

  const chosen = [];

  // Auto-accept all granted traits
  for (const grant of grants) {
    chosen.push(grant);
  }

  // For choice pools, try to match AI-generated data
  for (const choice of choices) {
    const pool = choice.pool || [];
    const count = choice.count || 1;
    let picked = 0;

    // First pass: pick traits the AI already selected
    for (const traitKey of pool) {
      if (picked >= count) break;
      if (traitKey.endsWith(":*")) {
        // Wildcard pool — need to pick specific options from AI data
        const { category } = parseTraitKey(traitKey);
        if (category === "languages") {
          const aiLangs = data.languages?.value || data.languages || [];
          const langArr = Array.isArray(aiLangs) ? aiLangs : [];
          const prefix = traitKey.replace(":*", ":");
          for (const lang of langArr) {
            if (picked >= count) break;
            const fullKey = `${prefix}${lang.toLowerCase()}`;
            if (!chosen.includes(fullKey)) {
              chosen.push(fullKey);
              picked++;
            }
          }
        }
        continue;
      }
      if (matchTraitToAIData(traitKey, data) && !chosen.includes(traitKey)) {
        chosen.push(traitKey);
        picked++;
      }
    }

    // Second pass: fill remaining with first available options
    for (const traitKey of pool) {
      if (picked >= count) break;
      if (traitKey.endsWith(":*")) continue; // skip wildcards on fallback
      if (!chosen.includes(traitKey)) {
        chosen.push(traitKey);
        picked++;
      }
    }
  }

  return { value: { chosen } };
}

/**
 * Resolve an ItemGrant advancement — determines which items to import.
 * Does NOT import them — returns the list for the orchestrator to batch-import.
 * @param {object} adv — advancement object
 * @param {number} characterLevel
 * @returns {{ uuidsToGrant: string[], spellConfig: object|null }}
 */
export function resolveItemGrant(adv, characterLevel) {
  const advLevel = adv.level || 0;
  if (advLevel > characterLevel) {
    return { uuidsToGrant: [], spellConfig: null };
  }

  const items = adv.configuration?.items || [];
  const uuids = items
    .filter(i => !i.optional) // only non-optional items
    .map(i => i.uuid)
    .filter(Boolean);

  return {
    uuidsToGrant: uuids,
    spellConfig: adv.configuration?.spell || null
  };
}

// ─── Main Orchestrator ───

/**
 * Apply all advancements from embedded species/background items on an actor.
 * Reads each item's system.advancement[], fills value fields, imports granted
 * sub-items, and links system.details.race/background.
 *
 * @param {Actor} actor — the created Foundry Actor
 * @param {object} data — validated character data from the generator
 * @param {number} characterLevel — character level for level-gated advancements
 * @returns {Promise<void>}
 */
export async function applyAdvancements(actor, data, characterLevel = 1) {
  const actorUpdates = {};
  const itemsToGrant = []; // { itemData, parentItemId, advancementId }
  const itemUpdates = [];  // { _id, system.advancement }

  // Process race and background items
  for (const item of actor.items) {
    if (item.type !== "race" && item.type !== "background") continue;

    const advancements = item.system?.advancement || [];
    if (!advancements.length) continue;

    // Link the item ID to system.details
    if (item.type === "race") {
      actorUpdates["system.details.race"] = item.id;
    } else if (item.type === "background") {
      actorUpdates["system.details.background"] = item.id;
    }

    // Process each advancement
    const updatedAdvancement = advancements.map(adv => {
      const advCopy = JSON.parse(JSON.stringify(adv));

      try {
        switch (adv.type) {
          case "Size": {
            const result = resolveSize(adv, data);
            advCopy.value = result.value;
            break;
          }
          case "AbilityScoreImprovement": {
            const result = resolveASI(adv, data);
            advCopy.value = result.value;
            break;
          }
          case "Trait": {
            const result = resolveTrait(adv, data);
            advCopy.value = result.value;
            break;
          }
          case "ItemGrant": {
            const result = resolveItemGrant(adv, characterLevel);
            // Queue items for import — value.added gets filled after creation
            for (const uuid of result.uuidsToGrant) {
              itemsToGrant.push({
                uuid,
                parentItemId: item.id,
                advancementId: adv._id,
                spellConfig: result.spellConfig
              });
            }
            // value.added will be set after items are created
            break;
          }
          case "ItemChoice": {
            // Leave empty — these require specific user choices we can't reliably auto-fill
            console.debug(`advancement-utils: Skipping ItemChoice on ${item.name}`);
            break;
          }
          default:
            console.debug(`advancement-utils: Unknown advancement type "${adv.type}" on ${item.name}`);
        }
      } catch (err) {
        console.warn(`advancement-utils: Error resolving ${adv.type} on ${item.name}:`, err.message);
      }

      return advCopy;
    });

    itemUpdates.push({
      _id: item.id,
      "system.advancement": updatedAdvancement
    });
  }

  // Import granted items from compendium
  if (itemsToGrant.length) {
    const grantedItemData = [];

    for (const grant of itemsToGrant) {
      try {
        const doc = await fromUuid(grant.uuid);
        if (!doc) {
          console.warn(`advancement-utils: Could not resolve UUID ${grant.uuid}`);
          continue;
        }

        const itemData = doc.toObject();
        // Set advancement origin flags
        itemData.flags = itemData.flags || {};
        itemData.flags.dnd5e = {
          ...(itemData.flags.dnd5e || {}),
          sourceId: grant.uuid,
          advancementOrigin: `${grant.parentItemId}.${grant.advancementId}`,
          advancementRoot: `${grant.parentItemId}.${grant.advancementId}`
        };

        // Apply spell config if this is a spell grant
        if (grant.spellConfig && itemData.type === "spell") {
          const sc = grant.spellConfig;
          if (sc.ability) {
            const abilityKey = Array.isArray(sc.ability) ? sc.ability[0] : sc.ability;
            itemData.system = itemData.system || {};
            itemData.system.ability = abilityKey;
          }
          if (sc.prepared != null) {
            itemData.system = itemData.system || {};
            itemData.system.preparation = {
              ...(itemData.system.preparation || {}),
              mode: sc.prepared === 2 ? "always" : "prepared",
              prepared: sc.prepared > 0
            };
          }
          if (sc.uses?.max) {
            itemData.system = itemData.system || {};
            itemData.system.uses = {
              ...(itemData.system.uses || {}),
              max: sc.uses.max,
              per: sc.uses.per || "lr",
              value: parseInt(sc.uses.max, 10) || 1
            };
          }
        }

        grantedItemData.push({
          data: itemData,
          parentItemId: grant.parentItemId,
          advancementId: grant.advancementId,
          uuid: grant.uuid
        });
      } catch (err) {
        console.warn(`advancement-utils: Failed to import ${grant.uuid}:`, err.message);
      }
    }

    if (grantedItemData.length) {
      try {
        const created = await actor.createEmbeddedDocuments(
          "Item",
          grantedItemData.map(g => g.data)
        );

        // Update ItemGrant advancement value.added with created item IDs
        if (created?.length) {
          for (let i = 0; i < created.length; i++) {
            const createdItem = created[i];
            const grantInfo = grantedItemData[i];
            if (!grantInfo) continue;

            // Find the matching item update and advancement
            const itemUpdate = itemUpdates.find(u => u._id === grantInfo.parentItemId);
            if (itemUpdate) {
              const adv = itemUpdate["system.advancement"]?.find(a => a._id === grantInfo.advancementId);
              if (adv) {
                adv.value = adv.value || {};
                adv.value.added = adv.value.added || {};
                adv.value.added[createdItem.id] = grantInfo.uuid;
              }
            }
          }
        }
      } catch (err) {
        console.warn("advancement-utils: Failed to create granted items:", err.message);
      }
    }
  }

  // Batch update: actor details + item advancement values
  try {
    if (Object.keys(actorUpdates).length) {
      await actor.update(actorUpdates);
    }
    if (itemUpdates.length) {
      await actor.updateEmbeddedDocuments("Item", itemUpdates);
    }
  } catch (err) {
    console.warn("advancement-utils: Failed to update actor/items:", err.message);
  }
}
