/**
 * OpenAI API calls for chat completions and image generation.
 */

import { ensureFolder, saveImageLocally } from '../utils/file-utils.js';
import { generateSDImage } from './stable-diffusion.js';

const CHAT_ENDPOINT = "https://api.openai.com/v1/chat/completions";
const IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

// ---------- Chat Completion Helpers ----------

async function chatCompletion(apiKey, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false) {
  const body = {
    model,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    max_tokens: maxTokens
  };
  if (useJsonMode) {
    body.response_format = { type: "json_object" };
  }
  const response = await fetch(CHAT_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify(body)
  });
  const data = await response.json();
  return data.choices?.[0]?.message?.content?.trim() || "";
}

// ---------- JSON Fix (uses API) ----------

export async function fixInvalidJSON(badJSON, config) {
  if (!config.apiKey) return badJSON;
  const result = await chatCompletion(
    config.apiKey,
    config.lightModel || config.chatModel,
    "You are a helpful assistant. The user provided invalid JSON. Remove any disclaimers, partial lines, or text outside of the JSON object. If there is text before or after the JSON braces, remove it. Fix it so it's strictly valid JSON with double-quoted property names. No extra commentary.",
    badJSON,
    900,
    true
  );
  return result || badJSON;
}

// ---------- Type-Specific Prompt Blocks ----------

const COMMON_PROMPT_BASE = "You are a creative fantasy writer and Foundry VTT assistant creating structured JSON for a single DnD 5e item. Write descriptions in a rich, evocative style — include sensory details (how the item looks, feels, sounds, or smells), hints of its history or origin, and a sense of wonder or danger. The description must feel cohesive with the item's name — reference it, weave it into the lore. Avoid generic phrasing; make each item feel unique and memorable, as if plucked from a legendary adventurer's tale. " +
  "Do not include an explicit item name field; instead, output the item description beginning with '<b>Item Name:</b> ' followed by the item name and a '<br>' tag, then the detailed lore. The JSON must include a non-empty 'description' field along with the fields 'rarity', 'weight', 'price', and 'requiresAttunement'. " +
  "If the item grants passive bonuses, resistances, immunities, skill advantages, or other ongoing effects when worn or attuned, include 'mechanicalEffects' as an array of objects, each with: 'name' (short label like 'Fire Resistance'), 'type' (one of 'advantage','bonus','resistance','immunity','speed','sense'), 'target' (the thing affected, e.g. 'stealth','fire','ac','darkvision','all saves'), and 'value' (numeric modifier or true). Only include for items with actual mechanical effects, omit for purely cosmetic items. " +
  "If the item can cast spells via charges (e.g. a staff that casts Web), include 'castableSpells' as an array of objects with 'name' (spell name), 'level' (0-9), 'chargeCost' (charges consumed), 'school' (full school name), 'saveAbility' (if applicable, e.g. 'dexterity'), 'damage' (object with 'formula' and 'type', if applicable), and 'description' (brief). Also include 'charges' with 'max' (total charges) and 'recovery' (object with 'period' like 'dawn','sr','lr' and 'formula' like '1d6+4'). ";

const WEAPON_PROMPT_BLOCK = "The description MUST mention the weapon's damage dice, damage type, any magical bonuses, and special abilities. If it's a weapon, include: 'weaponProperties' as an array (e.g. ['versatile','finesse']), a 'damage' object with keys 'number' (die count, e.g. 1), 'die' (die type, e.g. 'd8'), 'bonus' (numeric modifier or 0), and 'type' (damage type, e.g. 'slashing'), a nested 'type' object with 'value' (one of 'simpleM','martialM','simpleR','martialR') and 'baseItem' (e.g. 'longsword'). If the weapon has the versatile property, also include 'versatileDamage' with the same keys using the larger die. If the weapon is magical (+1,+2,+3), include 'magicalBonus' as a number. " +
  "If the weapon deals additional conditional damage beyond its base (e.g. 'extra 1d6 radiant damage to undead'), include 'extraDamage' as an array of objects with 'formula' (e.g. '1d6'), 'type' (damage type like 'radiant'), and 'condition' (when it applies, e.g. 'against undead'). ";

const SPELL_PROMPT_BLOCK = "This is a spell. The description should read like a D&D spell description, mentioning the effect, damage or healing if any, area of effect, and duration. Include these structured fields in the JSON: " +
  "'level' (integer 0 for cantrip through 9), " +
  "'school' (full name: 'abjuration','conjuration','divination','enchantment','evocation','illusion','necromancy','transmutation'), " +
  "'components' as an object with boolean keys 'verbal', 'somatic', 'material', " +
  "'materialDescription' (string describing material components if material is true, empty string if none), " +
  "'materialConsumed' (boolean), " +
  "'materialCost' (number in gold pieces, 0 if no cost), " +
  "'castingTime' as an object with 'type' (one of 'action','bonus action','reaction','1 minute','10 minutes','1 hour') and 'cost' (number, usually 1), " +
  "'duration' as an object with 'value' (number or null for instantaneous) and 'unit' (one of 'instantaneous','round','minute','hour','day','permanent','special'), " +
  "'concentration' (boolean), " +
  "'ritual' (boolean), " +
  "'range' as an object with 'value' (number or null for self/touch) and 'unit' (one of 'self','touch','feet','mile','special'), " +
  "'target' as an object with 'value' (number), 'type' (one of 'creature','object','point','cone','cube','cylinder','line','sphere','wall'), and 'units' ('ft' or 'mi'), " +
  "'actionType' (one of 'melee spell attack','ranged spell attack','saving throw','healing','utility'), " +
  "'saveAbility' (if actionType is 'saving throw': one of 'strength','dexterity','constitution','intelligence','wisdom','charisma'), " +
  "'damage' as an object with 'formula' (e.g. '8d6') and 'type' (e.g. 'fire'), or null if no damage, " +
  "'scaling' as an object with 'mode' ('cantrip' for cantrips, 'level' for spells that scale with slot level, 'none') and 'formula' (the per-level scaling die, e.g. '1d6'), " +
  "'higherLevels' (string describing what changes when cast at higher levels, or empty). " +
  "If the spell applies a condition on the target (invisible, frightened, restrained, poisoned, etc.), include 'appliedCondition' as a string with the condition name (e.g. 'invisible', 'frightened'). ";

const FEAT_PROMPT_BLOCK = "This is a feat or feature. Include 'itemType' set to 'feat' in the JSON. The description should contain the full mechanical benefit and flavor text. Include: 'featType' (one of 'feat','class','monster','race'), 'requirements' (string describing prerequisites like 'Dexterity 13 or higher', or empty string if none). ";

const CONTAINER_PROMPT_BLOCK = "This is a container (bag, chest, pouch, etc.). The description should describe its appearance and any magical properties. Include: 'capacity' as an object with 'value' (number, weight in pounds or item count) and 'type' ('weight' or 'items'), 'weightlessContents' (boolean, true if contents don't count toward encumbrance). ";

const BACKGROUND_PROMPT_BLOCK = "This is a character background. The description should include the background's feature, personality traits, ideals, bonds, flaws, and flavor text. Include: 'skillProficiencies' as an array of skill names (e.g. ['Perception','Stealth']), 'toolProficiencies' as an array (e.g. ['Thieves Tools']). ";

const ARMOR_PROMPT_BLOCK = "This is armor or a shield. The description MUST mention the AC value, type of armor, any magical bonuses, and special properties. Do NOT include weapon damage dice or weapon properties. Include these structured fields in the JSON: " +
  "'armorType' (one of 'light', 'medium', 'heavy', 'natural', 'shield'), " +
  "'ac' (base AC number — Light: 11 for padded, 11 for leather, 12 for studded leather; Medium: 12 for hide, 13 for chain shirt, 14 for scale mail, 14 for breastplate, 15 for half plate; Heavy: 14 for ring mail, 16 for chain mail, 17 for splint, 18 for plate; Shield: 2), " +
  "'baseItem' (the base armor name, e.g. 'chain mail', 'plate', 'leather', 'shield', 'hide', 'studded leather', 'breastplate'), " +
  "'magicalBonus' (numeric modifier, e.g. 1 for +1 armor, 0 if not magical), " +
  "'stealthDisadvantage' (boolean, true if the armor imposes disadvantage on Stealth checks — true for padded, scale mail, half plate, ring mail, chain mail, splint, plate; false for leather, studded leather, hide, chain shirt, breastplate, shield), " +
  "'strengthRequirement' (minimum Strength score needed, e.g. 13 for chain mail, 15 for splint/plate, 0 if none). ";

// ---------- Item JSON Generation ----------

export async function generateItemJSON(prompt, config, explicitType = "") {
  if (!config.apiKey) return "{}";
  const typeNote = explicitType ? ` The item type is ${explicitType}.` : "";

  // Select type-specific prompt block
  let typePrompt = "";
  let maxTokens = 900;
  switch (explicitType) {
    case "Weapon":
      typePrompt = WEAPON_PROMPT_BLOCK;
      break;
    case "Armor":
      typePrompt = ARMOR_PROMPT_BLOCK;
      break;
    case "Spell":
      typePrompt = SPELL_PROMPT_BLOCK;
      maxTokens = 1400; // Spells have many more structured fields
      break;
    case "Feat":
      typePrompt = FEAT_PROMPT_BLOCK;
      break;
    case "Container":
      typePrompt = CONTAINER_PROMPT_BLOCK;
      break;
    case "Background":
      typePrompt = BACKGROUND_PROMPT_BLOCK;
      break;
    default:
      // For explicit non-weapon/armor types (Equipment, Consumable, Tool, Loot),
      // no special fields needed. For auto-detect (empty explicitType),
      // analyze the prompt to pick the best prompt block.
      if (!explicitType) {
        const promptLC = prompt.toLowerCase();
        const armorHints = ["armor", "shield", "mail ", "plate", "breastplate", "chainmail", "chain shirt", "half plate", "splint", "hide armor", "scale mail", "ring mail"];
        const spellHints = ["spell", "cantrip", "incantation"];
        const featHints = ["feat", "feature", "ability"];
        const consumableHints = ["potion", "elixir", "philter", "draught", "scroll", "poison", "tonic", "salve", "oil", "balm", "brew", "concoction", "antidote", "vial"];
        const weaponHints = ["sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "lance", "javelin", "warhammer", "maul", "rapier", "scimitar", "trident", "pike", "glaive", "morningstar", "crossbow", "longbow", "shortbow", "whip", "katana", "blade", "cutlass", "sabre", "musket", "pistol"];
        if (armorHints.some(k => promptLC.includes(k))) {
          typePrompt = ARMOR_PROMPT_BLOCK;
        } else if (spellHints.some(k => promptLC.includes(k))) {
          typePrompt = SPELL_PROMPT_BLOCK;
          maxTokens = 1400;
        } else if (featHints.some(k => promptLC.includes(k))) {
          typePrompt = FEAT_PROMPT_BLOCK;
        } else if (consumableHints.some(k => promptLC.includes(k))) {
          typePrompt = "This is a consumable item (potion, scroll, poison, etc.). " +
            "Include 'itemType' set to 'consumable' in the JSON. " +
            "Include the consumable subtype as 'consumableType' (one of 'potion','scroll','poison','food','ammo','trinket','wand','rod'). " +
            "If this is a healing potion, the description MUST mention the exact healing dice formula (e.g. '2d4+2 hit points' or '4d4+4 hit points'). ";
        } else if (weaponHints.some(k => promptLC.includes(k))) {
          typePrompt = WEAPON_PROMPT_BLOCK;
        } else {
          // No type hints found — use a general-purpose prompt that lets GPT decide
          typePrompt = "Determine the most appropriate item type from the prompt. If it is a weapon, include weapon damage/properties/type fields. If it is equipment, describe its properties and any magical effects. Include 'itemType' in the JSON (one of 'weapon','armor','equipment','consumable','tool','loot','spell','feat'). ";
        }
      } else {
        typePrompt = "";
      }
      break;
  }

  const extraPrompt = game.settings.get("chatgpt-item-generator", "chatgptJSONPrompt");
  const fixedJSONInstructions = "Output valid JSON with double-quoted property names and no extra text.";
  const jsonPrompt = extraPrompt + " " + COMMON_PROMPT_BASE + " " + typePrompt + " " + fixedJSONInstructions + typeNote;

  console.log("Generated JSON prompt:", jsonPrompt);

  return await chatCompletion(config.apiKey, config.chatModel, jsonPrompt, prompt, maxTokens, true);
}

// ---------- Item Name Generation ----------

export async function generateItemName(prompt, config) {
  if (!config.apiKey) return "Unnamed";
  const fixedNamePrompt = "Generate a creative, evocative fantasy item name. Use vivid or poetic language — names like 'Frostbite\\'s Lament', 'The Ashen Verdict', or 'Whisperwind Blade' rather than plain names like 'Fire Staff' or 'Magic Sword'. Even for well-known items, invent a unique name. Output only the name in plain text, no JSON.";
  const extraNamePrompt = game.settings.get("chatgpt-item-generator", "chatgptNamePrompt");
  const namePrompt = extraNamePrompt + " " + fixedNamePrompt;

  return await chatCompletion(config.apiKey, config.lightModel || config.chatModel, namePrompt, prompt, 20);
}

// ---------- Item Name Refinement ----------

export async function refineItemName(currentName, description, config) {
  if (currentName && currentName.trim().length > 0) return currentName;
  const prompt = `The current item name is: "${currentName}".
The item description is: "${description}".
Please provide a refined, improved item name that better reflects the details and flavor of the description. Output only the name in plain text.`;

  return await chatCompletion(
    config.apiKey, config.lightModel || config.chatModel,
    "You are a master storyteller who names legendary artifacts. Create names that evoke mystery, power, or history — the kind of name bards sing about in taverns.",
    prompt, 20
  ) || currentName;
}

// ---------- Mismatch Fix ----------

export async function gptFixMismatch(expectedName, foundType, itemName, rawJSON, config) {
  if (!config.apiKey) return rawJSON;
  const fixedMismatchPrompt = "You are a Foundry VTT assistant. The item name or prompt indicates it is a " + expectedName + ", but the JSON indicates it is a " + foundType + ". Fix the JSON so that the item is consistent as a " + expectedName + ". ";
  const extraMismatchPrompt = game.settings.get("chatgpt-item-generator", "chatgptFixMismatchPrompt");
  const systemMessage = fixedMismatchPrompt + extraMismatchPrompt + "Output only valid JSON.";

  return await chatCompletion(config.apiKey, config.lightModel || config.chatModel, systemMessage, rawJSON, 900, true) || rawJSON;
}

// ---------- Item Effect Validation ----------

/**
 * Send an item description back to GPT to identify mechanical effects
 * that should become Activities or Active Effects.
 * Uses the light/cheap model for speed — this is a validation pass, not generation.
 *
 * @param {string} description — the item's description HTML
 * @param {string} itemType — Foundry item type: "weapon", "spell", "equipment", etc.
 * @param {object} config — module config with apiKey, lightModel, chatModel
 * @returns {Promise<{mechanicalEffects: Array, extraDamage: Array}|null>}
 */
export async function gptValidateItemEffects(description, itemType, config, isArmorItem = false) {
  if (!config.apiKey) return null;

  const plainDesc = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (plainDesc.length < 20) return null;

  let systemPrompt =
    "You are a D&D 5e rules expert. Analyze the item description and identify ONLY the mechanical game effects. " +
    "Return a JSON object with:\n" +
    "- \"mechanicalEffects\": array of passive effects when equipped/attuned. Each object: " +
    "{ \"name\": \"short label\", \"type\": one of \"resistance\"|\"immunity\"|\"advantage\"|\"bonus\"|\"speed\"|\"sense\", " +
    "\"target\": what it affects (damage type like \"fire\", condition like \"frightened\", skill like \"stealth\", " +
    "or \"ac\", \"all saves\", \"darkvision\", \"walk\", \"fly\"), " +
    "\"value\": true for resistance/immunity/advantage, number for bonuses/speed/senses in feet }\n" +
    "- \"extraDamage\": array of additional damage beyond base weapon damage (weapons only). " +
    "Each object: { \"formula\": dice like \"1d6\", \"type\": damage type like \"fire\" }\n" +
    "Only include effects with clear mechanical rules impact. Omit flavor text and cosmetic effects. " +
    "If no mechanical effects exist, return empty arrays. Output ONLY valid JSON.";

  // Armor items: AC, magical bonus, dex cap, and stealth disadvantage are
  // already handled by the armor system fields — NOT Active Effects.
  // Tell GPT to skip these so they don't double-count.
  if (isArmorItem) {
    systemPrompt +=
      "\n\nIMPORTANT: This is an armor item. Do NOT include the following as mechanical effects — " +
      "they are already handled by the armor system and would double-count:\n" +
      "- Base AC value (e.g. AC 14, AC 18)\n" +
      "- Magical AC bonus (e.g. +1 bonus to AC)\n" +
      "- Maximum Dexterity modifier cap\n" +
      "- Stealth disadvantage\n" +
      "Only return effects BEYOND the armor's basic stats (resistances, immunities, senses, speed, etc.).";
  }

  const userPrompt = `Item type: ${itemType}\nDescription: ${plainDesc}`;

  try {
    const result = await chatCompletion(
      config.apiKey,
      config.lightModel || config.chatModel,
      systemPrompt,
      userPrompt,
      400,
      true
    );
    if (!result) return null;
    const parsed = JSON.parse(result);
    return {
      mechanicalEffects: Array.isArray(parsed.mechanicalEffects) ? parsed.mechanicalEffects : [],
      extraDamage: Array.isArray(parsed.extraDamage) ? parsed.extraDamage : []
    };
  } catch (err) {
    console.warn("GPT item validation failed (falling back to regex only):", err.message);
    return null;
  }
}

// ---------- Magical Properties ----------

export async function generateMagicalProperties(itemData, count, config) {
  const prompt = `Generate ${count} creative, unique, and flavorful magical property descriptions for the following DnD 5e item. Each description should be a concise sentence describing a special ability or effect that fits the item details. Provide each property on its own line.

Item Details:
Name: ${itemData.name}
Type: ${itemData.type}
Rarity: ${itemData.system.rarity}
Weight: ${itemData.system.weight}
Price: ${itemData.system.price.value} ${itemData.system.price.denomination}
Description: ${itemData.system.description.value}

Output only the descriptions, one per line, with no numbering or extra commentary.`;

  return await chatCompletion(
    config.apiKey, config.lightModel || config.chatModel,
    "You are an expert DnD magical property generator.",
    prompt, 300
  );
}

// ---------- Roll Table JSON Generation ----------

export async function generateRollTableJSON(userPrompt, config, entryCount = 10) {
  if (!config.apiKey) return "{}";

  const isGeneric = userPrompt.includes("-- tableType=generic");

  // Base prompt shared by both modes
  const basePrompt = `You are a Foundry VTT assistant creating strictly valid JSON for a DnD 5e roll table. Do not alter the JSON formatting: output only a valid JSON object with double-quoted property names and no extra commentary or text before or after the JSON object. The JSON must include the following fields: 'name', 'formula' (set to '1d${entryCount}'), 'description', 'tableType', and 'entries'. Ensure that the output contains exactly ${entryCount} entries, numbered with minRange and maxRange from 1 to ${entryCount}. `;

  let typePrompt;
  if (isGeneric) {
    // Generic/Text mode: random effects, events, encounters, wild magic surges, etc.
    typePrompt = `Set 'tableType' to 'generic'. Each entry must be an object with 'text' (a creative, descriptive result — e.g. a potion effect, a random event, an encounter, a wild magic surge, a trap effect, a personality quirk, or whatever fits the user's prompt), 'minRange', 'maxRange', and 'weight' (set to 1). The 'text' for each entry should be a vivid, flavorful 1-2 sentence description of the result. Make each entry unique and interesting. `;
  } else {
    // Items mode: creates actual Foundry items
    typePrompt = `Set 'tableType' to 'items'. Each entry must be an object with 'text' (the item name/description), 'minRange', 'maxRange', 'weight', 'documentCollection' set to 'Item', and 'itemType' set to the appropriate DnD 5e item category (one of 'Weapon', 'Armor', 'Equipment', 'Consumable', 'Tool', 'Loot', 'Spell', 'Feat'). Choose the itemType based on what the item actually is — for example a cloak is 'Equipment', a potion is 'Consumable', a sword is 'Weapon', a shield or chainmail is 'Armor', a gem is 'Loot', a scroll with a spell is 'Spell'. `;
  }

  let rollTableJSONPrompt = basePrompt + typePrompt;

  if (!isGeneric) {
    const extraRollTablePrompt = game.settings.get("chatgpt-item-generator", "chatgptRollTablePrompt");
    rollTableJSONPrompt += extraRollTablePrompt;
  }

  // Scale token budget: ~125 tokens per entry (structured fields + text)
  const maxTokens = Math.max(1500, entryCount * 125);
  return await chatCompletion(config.apiKey, config.chatModel, rollTableJSONPrompt, userPrompt, maxTokens, true);
}

// ---------- Image Generation ----------

export async function generateItemImage(prompt, config) {
  // Check if Stable Diffusion is enabled
  const useSD = game.settings.get("chatgpt-item-generator", "stableDiffusionEnabled");
  if (useSD) {
    try {
      const imagePath = await generateSDImage(prompt, config);
      if (imagePath) return imagePath;
      console.warn("Stable Diffusion did not return an image, falling back to OpenAI.");
    } catch (err) {
      console.error("Error generating image with Stable Diffusion:", err);
      console.warn("Falling back to OpenAI.");
    }
  }

  // OpenAI image generation
  if (!config.dalleApiKey) return "";

  const dallePrompt = game.settings.get("chatgpt-item-generator", "dallePrompt");
  const imageModel = config.imageModel;
  const imageFormat = config.imageFormat || "png";

  const requestBody = {
    model: imageModel,
    prompt: dallePrompt.replace("{prompt}", prompt),
    n: 1,
    size: "1024x1024"
  };

  // gpt-image-1 always returns base64, does NOT accept response_format
  if (imageModel.startsWith("dall-e")) {
    requestBody.response_format = "b64_json";
  } else {
    // gpt-image-1 parameters
    requestBody.quality = "medium";
    requestBody.output_format = imageFormat;
  }

  const response = await fetch(IMAGE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${config.dalleApiKey}`
    },
    body: JSON.stringify(requestBody)
  });
  const data = await response.json();

  if (data.error) {
    console.error("Image generation error:", data.error);
    return "";
  }

  if (data.data && data.data[0]?.b64_json) {
    // Determine MIME type and file extension from the model/format
    let mimeType = "image/png";
    let fileExt = "png";
    if (!imageModel.startsWith("dall-e")) {
      const formatMap = { png: "image/png", webp: "image/webp", jpeg: "image/jpeg" };
      const extMap = { png: "png", webp: "webp", jpeg: "jpg" };
      mimeType = formatMap[imageFormat] || "image/png";
      fileExt = extMap[imageFormat] || "png";
    }

    const dataUrl = `data:${mimeType};base64,${data.data[0].b64_json}`;
    const fileName = `${prompt.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.${fileExt}`;
    const targetFolder = config.imageFolder;
    await ensureFolder(targetFolder);
    return await saveImageLocally(dataUrl, fileName, targetFolder);
  }

  return "";
}
