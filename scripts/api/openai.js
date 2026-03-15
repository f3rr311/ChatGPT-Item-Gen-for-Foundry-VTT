/**
 * API facade for chat completions and image generation.
 * Routes text requests through the provider registry; image generation stays here.
 */

import { ensureFolder, saveImageLocally } from '../utils/file-utils.js';
import { generateSDImage } from './stable-diffusion.js';
import { stabilityAIProvider } from './providers/stability-ai-provider.js';
import { falAIProvider } from './providers/fal-ai-provider.js';
import { xaiImageProvider } from './providers/xai-image-provider.js';
import { MODULE_ID } from '../settings.js';
import { routeChatCompletion } from './provider-registry.js';
import {
  WEAPON_KEYWORDS, ARMOR_KEYWORDS, CONSUMABLE_KEYWORDS,
  SPELL_KEYWORDS, FEAT_KEYWORDS
} from '../utils/type-keywords.js';
import {
  getSubclasses, getClassFeatures, getSubclassLevel,
  getRaceData, raceHasSubraces, getAllRaces, isRaceSRD,
  CLASS_SAVING_THROWS, CLASS_SPELLCASTING_ABILITY
} from '../utils/actor-utils.js';

const IMAGE_ENDPOINT = "https://api.openai.com/v1/images/generations";

/** Maps image output formats to MIME types and file extensions. */
const IMAGE_FORMAT_MAP = {
  png:  { mime: "image/png",  ext: "png" },
  webp: { mime: "image/webp", ext: "webp" },
  jpeg: { mime: "image/jpeg", ext: "jpg" }
};

/** Default max tokens for chat completions by item category. */
const MAX_TOKENS_SPELL = 1400;
const MAX_TOKENS_DEFAULT = 900;

/**
 * Accumulate token usage from an API response onto session/item cost trackers.
 * @param {object} usageData — the `usage` object from the API response
 */
function trackTokenUsage(usageData) {
  if (!usageData || !game.chatGPTItemGenerator?.sessionCost) return;

  const usage = {
    prompt: usageData.prompt_tokens || 0,
    completion: usageData.completion_tokens || 0,
    total: usageData.total_tokens || 0
  };
  const session = game.chatGPTItemGenerator.sessionCost;
  session.promptTokens += usage.prompt;
  session.completionTokens += usage.completion;
  session.totalTokens += usage.total;
  session.apiCalls += 1;

  if (game.chatGPTItemGenerator.currentCost) {
    const current = game.chatGPTItemGenerator.currentCost;
    current.promptTokens += usage.prompt;
    current.completionTokens += usage.completion;
    current.totalTokens += usage.total;
    current.apiCalls += 1;
  }
}

/**
 * Increment image generation count on session/item cost trackers.
 */
function trackImageGeneration() {
  if (game.chatGPTItemGenerator?.sessionCost) {
    game.chatGPTItemGenerator.sessionCost.imageGenerations += 1;
  }
  if (game.chatGPTItemGenerator?.currentCost) {
    game.chatGPTItemGenerator.currentCost.imageGenerations += 1;
  }
}

// ---------- Chat Completion (routed through provider registry) ----------

/**
 * Send a chat completion request through the active provider.
 * Accumulates token usage on game.chatGPTItemGenerator for cost tracking.
 *
 * @param {GeneratorConfig} config — full module config (routes to correct provider)
 * @param {string} model — model name (e.g. "gpt-4.1")
 * @param {string} systemPrompt — system-level instructions
 * @param {string} userPrompt — user-level prompt text
 * @param {number} maxTokens — max tokens to generate
 * @param {boolean} [useJsonMode=false] — request JSON response format
 * @returns {Promise<string|null>} trimmed response text, or null on failure
 */
async function chatCompletion(config, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false) {
  const result = await routeChatCompletion(config, model, systemPrompt, userPrompt, maxTokens, useJsonMode);
  if (result?.usage) trackTokenUsage(result.usage);
  return result?.text || null;
}

// ---------- JSON Fix (uses API) ----------

/**
 * Ask the AI to fix malformed JSON returned by a previous completion.
 * @param {string} badJSON — the invalid JSON string to repair
 * @param {GeneratorConfig} config — module config with apiKey, chatModel, etc.
 * @returns {Promise<string>} repaired JSON string, or the original if no API key
 */
export async function fixInvalidJSON(badJSON, config) {
  if (!config.apiKey && !config.textProvider) return badJSON;
  const result = await chatCompletion(
    config,
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

/**
 * Generate item JSON via chat completion.
 * @param {string} prompt — user's item description prompt
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, chatModel, etc.
 * @param {string} [explicitType=""] — forced item type (e.g. "Weapon", "Spell")
 * @returns {Promise<string|null>} JSON string of item data, or null on failure
 */
export async function generateItemJSON(prompt, config, explicitType = "") {
  const typeNote = explicitType ? ` The item type is ${explicitType}.` : "";

  // Select type-specific prompt block
  let typePrompt = "";
  let maxTokens = MAX_TOKENS_DEFAULT;
  switch (explicitType) {
    case "Weapon":
      typePrompt = WEAPON_PROMPT_BLOCK;
      break;
    case "Armor":
      typePrompt = ARMOR_PROMPT_BLOCK;
      break;
    case "Spell":
      typePrompt = SPELL_PROMPT_BLOCK;
      maxTokens = MAX_TOKENS_SPELL;
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
        // Keyword arrays imported from utils/type-keywords.js
        if (ARMOR_KEYWORDS.some(k => promptLC.includes(k))) {
          typePrompt = ARMOR_PROMPT_BLOCK;
        } else if (SPELL_KEYWORDS.some(k => promptLC.includes(k))) {
          typePrompt = SPELL_PROMPT_BLOCK;
          maxTokens = MAX_TOKENS_SPELL;
        } else if (FEAT_KEYWORDS.some(k => promptLC.includes(k))) {
          typePrompt = FEAT_PROMPT_BLOCK;
        } else if (CONSUMABLE_KEYWORDS.some(k => promptLC.includes(k))) {
          typePrompt = "This is a consumable item (potion, scroll, poison, etc.). " +
            "Include 'itemType' set to 'consumable' in the JSON. " +
            "Include the consumable subtype as 'consumableType' (one of 'potion','scroll','poison','food','ammo','trinket','wand','rod'). " +
            "If this is a healing potion, the description MUST mention the exact healing dice formula (e.g. '2d4+2 hit points' or '4d4+4 hit points'). " +
            "If this consumable grants temporary effects when used (e.g. a potion of strength grants a strength bonus, a potion of speed grants extra movement, a poison applies the poisoned condition, an elixir grants fire resistance), you MUST include 'mechanicalEffects' as an array describing each effect. " +
            "Also include 'effectDuration' as an object with 'value' (number) and 'unit' (one of 'round','minute','hour','day') for how long the consumable's effects last. ";
        } else if (WEAPON_KEYWORDS.some(k => promptLC.includes(k))) {
          typePrompt = WEAPON_PROMPT_BLOCK;
        } else {
          // No type hints found — use a general-purpose prompt that lets GPT decide
          typePrompt = "Determine the most appropriate item type from the prompt. If it is a weapon, include weapon damage/properties/type fields. If it is equipment, describe its properties and any magical effects. Include 'itemType' in the JSON (one of 'weapon','armor','equipment','consumable','tool','loot','spell','feat'). ";
        }
      }
      // else: typePrompt remains "" from initialization
      break;
  }

  const extraPrompt = game.settings.get(MODULE_ID, "chatgptJSONPrompt");
  const fixedJSONInstructions = "Output valid JSON with double-quoted property names and no extra text.";
  const jsonPrompt = extraPrompt + " " + COMMON_PROMPT_BASE + " " + typePrompt + " " + fixedJSONInstructions + typeNote;

  return await chatCompletion(config, config.chatModel, jsonPrompt, prompt, maxTokens, true);
}

// ---------- Item Name Generation ----------

/**
 * Generate a creative fantasy item name via AI.
 * @param {string} prompt — item description prompt
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, lightModel/chatModel
 * @returns {Promise<string|null>} generated name, or null on failure
 */
export async function apiGenerateItemName(prompt, config) {
  const fixedNamePrompt = "Generate a creative, evocative fantasy item name. Use vivid or poetic language — names like 'Frostbite\\'s Lament', 'The Ashen Verdict', or 'Whisperwind Blade' rather than plain names like 'Fire Staff' or 'Magic Sword'. Even for well-known items, invent a unique name. Output only the name in plain text, no JSON.";
  const extraNamePrompt = game.settings.get(MODULE_ID, "chatgptNamePrompt");
  const namePrompt = extraNamePrompt + " " + fixedNamePrompt;

  return await chatCompletion(config, config.lightModel || config.chatModel, namePrompt, prompt, 20);
}

// ---------- Item Name Refinement ----------

/**
 * Ensure an item has a meaningful name; generate one from its description if blank.
 * @param {string} currentName — existing name (returned as-is if non-empty)
 * @param {string} description — item description to derive a name from
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, lightModel/chatModel
 * @returns {Promise<string>} the current name or an AI-generated one
 */
export async function apiEnsureItemName(currentName, description, config) {
  if (currentName && currentName.trim().length > 0) return currentName;
  const prompt = `The item description is: "${description}".
Generate a creative fantasy item name that reflects the details and flavor of the description. Output only the name in plain text.`;

  return await chatCompletion(
    config, config.lightModel || config.chatModel,
    "You are a master storyteller who names legendary artifacts. Create names that evoke mystery, power, or history — the kind of name bards sing about in taverns.",
    prompt, 20
  ) || currentName;
}

// ---------- Item Effect Validation ----------

/**
 * Send an item description back to AI to identify mechanical effects
 * that should become Activities or Active Effects.
 * Uses the light/cheap model for speed — this is a validation pass, not generation.
 *
 * @param {string} description — the item's description HTML
 * @param {string} itemType — Foundry item type: "weapon", "spell", "equipment", etc.
 * @param {boolean} isArmorItem — true if the item is armor (skips AC/stealth effects)
 * @param {GeneratorConfig} config — module config with apiKey, lightModel, chatModel
 * @returns {Promise<{mechanicalEffects: Array<object>, extraDamage: Array<object>}|null>}
 *   null when no API key, description too short, or AI call fails
 */
export async function gptValidateItemEffects(description, itemType, isArmorItem, config) {
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
  // Tell the AI to skip these so they don't double-count.
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
      config,
      config.lightModel || config.chatModel,
      systemPrompt,
      userPrompt,
      400,
      true
    );
    if (!result) return null;
    // Strip markdown fences — some providers (xAI Grok) wrap JSON despite instructions
    const cleaned = result.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "");
    const parsed = JSON.parse(cleaned);
    return {
      mechanicalEffects: Array.isArray(parsed.mechanicalEffects) ? parsed.mechanicalEffects : [],
      extraDamage: Array.isArray(parsed.extraDamage) ? parsed.extraDamage : []
    };
  } catch (err) {
    console.warn("AI item validation failed (falling back to regex only):", err.message);
    return null;
  }
}

// ---------- Magical Properties ----------

/**
 * Generate creative magical property descriptions for an item.
 * @param {object} itemData — partial item data with name, type, and system fields
 * @param {number} count — number of properties to generate (1–3)
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, lightModel/chatModel
 * @returns {Promise<string|null>} newline-separated property descriptions, or null on failure
 */
export async function generateMagicalProperties(itemData, count, config) {
  if (!config || !itemData?.name) return null;
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
    config, config.lightModel || config.chatModel,
    "You are an expert DnD magical property generator.",
    prompt, 300
  );
}

// ---------- Roll Table JSON Generation ----------

/**
 * Generate roll table entries as JSON via AI.
 * @param {string} userPrompt — description of the desired roll table
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, chatModel
 * @param {number} [entryCount=10] — number of table entries to generate
 * @returns {Promise<string|null>} JSON string with table entries, or null on failure
 */
export async function generateRollTableJSON(userPrompt, config, entryCount = 10) {
  if (!config || !userPrompt) return null;

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
    const extraRollTablePrompt = game.settings.get(MODULE_ID, "chatgptRollTablePrompt");
    rollTableJSONPrompt += extraRollTablePrompt;
  }

  // Scale token budget: ~125 tokens per entry (structured fields + text)
  const maxTokens = Math.max(1500, entryCount * 125);
  return await chatCompletion(config, config.chatModel, rollTableJSONPrompt, userPrompt, maxTokens, true);
}

// ---------- Image Generation ----------

/**
 * Generate an item image using GPT Image or DALL-E (or Stable Diffusion if enabled).
 * @param {string} prompt — item description for image generation
 * @param {GeneratorConfig} config — GeneratorConfig with apiKey, imageModel, imageSize
 * @returns {Promise<string|null>} path to saved image file, or null on failure
 */
export async function generateItemImage(prompt, config) {
  if (!prompt || !config) return null;

  const imageProvider = config.imageProvider || "openai";

  // Route to non-OpenAI image providers
  if (imageProvider === "stable-diffusion") {
    try {
      const imagePath = await generateSDImage(prompt, config);
      if (imagePath) return imagePath;
      console.warn("Stable Diffusion did not return an image, falling back to OpenAI.");
    } catch (err) {
      console.error("Error generating image with Stable Diffusion:", err);
      console.warn("Falling back to OpenAI.");
    }
  } else if (imageProvider === "stability-ai") {
    return stabilityAIProvider.generateImage(prompt, config);
  } else if (imageProvider === "fal-ai") {
    return falAIProvider.generateImage(prompt, config);
  } else if (imageProvider === "xai") {
    return xaiImageProvider.generateImage(prompt, config);
  }

  // OpenAI image generation (default or fallback)
  if (!config.dalleApiKey) return null;

  const dallePrompt = game.settings.get(MODULE_ID, "dallePrompt");
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

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    console.error(`OpenAI image API error ${response.status}: ${errorBody}`);
    return null;
  }

  const data = await response.json();

  if (data.error) {
    console.error("Image generation error:", data.error);
    return null;
  }

  if (data.data && data.data[0]?.b64_json) {
    // Determine MIME type and file extension from the model/format
    const fmt = (!imageModel.startsWith("dall-e") && IMAGE_FORMAT_MAP[imageFormat])
      ? IMAGE_FORMAT_MAP[imageFormat]
      : IMAGE_FORMAT_MAP.png;

    const dataUrl = `data:${fmt.mime};base64,${data.data[0].b64_json}`;
    const shortName = prompt.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("_").toLowerCase();
    const fileName = `${shortName}_${Date.now()}.${fmt.ext}`;
    const targetFolder = config.imageFolder;
    await ensureFolder(targetFolder);

    trackImageGeneration();
    return await saveImageLocally(dataUrl, fileName, targetFolder);
  }

  return null;
}

// ---------- Actor (NPC / Character) Generation ----------

/** Max tokens for actor JSON completions — stat blocks are larger than items. */
const MAX_TOKENS_ACTOR = 2500;

const NPC_PROMPT_BASE =
  "You are a creative fantasy writer and D&D 5e expert. Generate a complete NPC stat block as strictly valid JSON. " +
  "The JSON must include ALL of these fields:\n" +
  "- 'name': NPC name (creative, evocative)\n" +
  "- 'creatureType': one of 'aberration','beast','celestial','construct','dragon','elemental','fey','fiend','giant','humanoid','monstrosity','ooze','plant','undead'\n" +
  "- 'creatureSubtype': subtype string (e.g. 'goblinoid', 'orc', 'elf') or empty string\n" +
  "- 'cr': Challenge Rating as a number (0, 0.125, 0.25, 0.5, or 1-30)\n" +
  "- 'size': 'tiny','small','medium','large','huge','gargantuan'\n" +
  "- 'alignment': e.g. 'chaotic evil', 'lawful good', 'neutral', 'unaligned'\n" +
  "- 'abilities': object with 'str','dex','con','int','wis','cha' as numbers (1-30)\n" +
  "- 'ac': Armor Class number\n" +
  "- 'acType': what provides the AC (e.g. 'natural armor', 'chain mail', 'leather armor')\n" +
  "- 'hp': hit point total\n" +
  "- 'hitDice': hit dice formula (e.g. '5d8+10'). Die size must match creature size: tiny=d4, small=d6, medium=d8, large=d10, huge=d12, gargantuan=d20. The bonus equals (dice count × CON modifier).\n" +
  "- 'speed': object with 'walk' (number in feet), and optionally 'fly','swim','climb','burrow','hover'\n" +
  "- 'savingThrows': array of ability names the NPC is proficient in (e.g. ['wisdom','constitution'])\n" +
  "- 'skills': array of skill names the NPC is proficient in (e.g. ['perception','stealth'])\n" +
  "- 'senses': object with 'darkvision','blindsight','tremorsense','truesight' as numbers in feet (0 if none)\n" +
  "- 'languages': array of language names (e.g. ['common','goblin'])\n" +
  "- 'damageResistances': array of damage types (e.g. ['fire','cold'])\n" +
  "- 'damageImmunities': array of damage types\n" +
  "- 'conditionImmunities': array of condition names (e.g. ['charmed','frightened'])\n" +
  "- 'actions': array of attack/action objects, each with 'name','type' ('weapon' or 'special'),'attackType' ('melee' or 'ranged'),'damage' (dice formula like '1d6+3'),'damageType' (e.g. 'slashing'),'reach' or 'range' (string like '5 ft.' or '80/320 ft.'), and 'description' (for special actions). IMPORTANT: CR 2+ creatures should almost always have a Multiattack action (type 'special') describing how many attacks they make per turn. CR 2-4: 2 attacks. CR 5-10: 2-3 attacks. CR 11+: 3+ attacks. Multiattack is listed first in the actions array.\n" +
  "- 'traits': array of passive trait objects, each with 'name' and 'description'\n" +
  "- 'legendaryActions': array of legendary action objects with 'name','description','cost' (default 1), or empty array\n" +
  "- 'legendaryResistances': number of legendary resistances per day (0 if none)\n" +
  "- 'spellcasting': object with 'ability' (e.g. 'wisdom'), 'level' (caster level), 'spells' (array of spell names), or null if non-caster\n" +
  "- 'description': rich HTML backstory/description (2-3 paragraphs of evocative lore — who they are, their motivations, appearance, mannerisms, and role in the world). Begin with '<b>NPC Name:</b> name<br>' prefix.\n" +
  "BALANCE GUIDELINES: Follow DMG CR benchmarks. CR 1: AC 13, HP 71-85, +3 attack, 9-14 dmg/rd. CR 2: AC 13, HP 86-100, +3 attack, 15-20 dmg/rd. CR 3: AC 13, HP 101-115, +4 attack, 21-26 dmg/rd. CR 5: AC 15, HP 131-145, +6 attack, 33-38 dmg/rd. CR 10: AC 17, HP 206-220, +7 attack, 63-68 dmg/rd. High AC or many resistances/immunities should be offset by lower HP. Total damage/round (all attacks combined) should match the CR benchmark.\n" +
  "Output ONLY the JSON. No commentary, no markdown fences.";

const CHARACTER_PROMPT_BASE =
  "You are a creative fantasy writer and D&D 5e expert. Generate a complete player character as strictly valid JSON. " +
  "The JSON must include ALL of these fields:\n" +
  "- 'name': character name (creative, evocative)\n" +
  "- 'race': race name (e.g. 'human','elf','dwarf','half-orc','tiefling','dragonborn','halfling','gnome','half-elf')\n" +
  "- 'class': class name (e.g. 'fighter','wizard','rogue','cleric','ranger','paladin','bard','warlock','sorcerer','druid','monk','barbarian','artificer')\n" +
  "- 'subclass': subclass name (e.g. 'champion','evocation','thief','life domain','hunter','oath of devotion')\n" +
  "- 'level': character level (1-20)\n" +
  "- 'background': background name (e.g. 'soldier','sage','criminal','outlander','noble')\n" +
  "- 'alignment': e.g. 'chaotic good', 'lawful neutral'\n" +
  "- 'abilities': object with 'str','dex','con','int','wis','cha' as numbers (8-15). These must be BASE ability scores using standard array (15,14,13,12,10,8) or point buy — do NOT include racial, background, or level-up ASI bonuses. The Foundry character wizard will apply those separately. Allocate the highest base scores to the class's primary abilities.\n" +
  "- 'skills': array of skill names the character is proficient in (based on class + background)\n" +
  "- 'savingThrows': array of ability names for saving throw proficiencies (based on class)\n" +
  "- 'appearance': object with 'gender','eyes','hair','skin','height','weight','age' as strings\n" +
  "- 'personality': personality trait string\n" +
  "- 'ideal': character ideal string\n" +
  "- 'bond': character bond string\n" +
  "- 'flaw': character flaw string\n" +
  "- 'equipment': array of equipment names (e.g. ['longsword','chain mail','shield','explorer\\'s pack'])\n" +
  "- 'spellcasting': object with 'ability' (e.g. 'wisdom') and 'spells' (array of known/prepared spell names INCLUDING CANTRIPS), or null if non-caster. Cantrips are critical — a level 5 wizard knows 3-4 cantrips (e.g. Fire Bolt, Prestidigitation, Minor Illusion, Mage Hand). List cantrips first, then leveled spells.\n" +
  "- 'features': array of CLASS feature names only at the character's level (e.g. Arcane Recovery, Sneak Attack, Spellcasting, Uncanny Dodge). Do NOT include racial traits here — use the 'racialTraits' array for non-SRD races. SRD racial traits will be added separately by the user.\n" +
  "- 'languages': array of language names\n" +
  "- 'racialTraits': array of objects [{name, description}] — ONLY include this for homebrew/non-SRD races. Each trait needs a unique name and 1-2 sentence description. Omit for SRD races. Traits MUST match the official race's power level and theme — include equivalent abilities (e.g., a Tiefling should have fire resistance, darkvision, and an infernal spellcasting trait; a Tabaxi should have feline agility, claws, and climbing speed).\n" +
  "- 'backgroundTraits': array of objects [{name, description}] — ONLY include this for homebrew/non-SRD backgrounds. Each trait has a unique name and 1-2 sentence description of an original background feature. Omit for SRD backgrounds (Acolyte, Charlatan, Criminal, Entertainer, Folk Hero, Gladiator, Guild Artisan, Guild Merchant, Hermit, Knight, Noble, Outlander, Pirate, Sage, Sailor, Soldier, Urchin, Wayfarer). Background traits may include mechanical effect fields if they have game-mechanical impact: 'resistances', 'immunities', 'conditionImmunities', 'darkvision', 'speed' (same format as racialTraits). Most background traits are roleplay/social features, but include mechanical fields when appropriate.\n" +
  "- 'description': rich HTML backstory (2-3 paragraphs — origin, motivations, personality, key events that shaped them). Begin with '<b>Character Name:</b> name<br>' prefix.\n" +
  "Output ONLY the JSON. No commentary, no markdown fences.";

/**
 * Generate NPC or Character JSON via chat completion.
 * @param {string} prompt — user's actor description
 * @param {GeneratorConfig} config
 * @param {"npc"|"character"} actorType
 * @param {object} [options={}] — { cr, creatureType, level, className, race } from dialog
 * @returns {Promise<string|null>} JSON string, or null on failure
 */
export async function generateActorJSON(prompt, config, actorType, options = {}) {
  if (!config || !prompt) return null;

  let systemPrompt;
  let constraints = "";

  if (actorType === "character") {
    systemPrompt = CHARACTER_PROMPT_BASE;
    const ruleset = options.ruleset || "all";
    if (options.level) constraints += ` The character is level ${options.level}.`;
    if (options.className) {
      constraints += ` The class is ${options.className}.`;
      // Inject valid subclass list for this class and ruleset
      const subclasses = getSubclasses(options.className, ruleset);
      const subLevel = getSubclassLevel(options.className);
      if (subclasses.length) {
        const level = options.level || 1;
        if (level >= subLevel) {
          constraints += ` The character must have a subclass. Valid subclasses for ${options.className}: ${subclasses.join(", ")}.`;
        }
        // Inject expected class features
        const features = getClassFeatures(options.className, level);
        if (features.length) {
          constraints += ` Expected class features at level ${level}: ${features.join(", ")}.`;
        }
      }
      // Inject saving throw proficiencies
      const saves = CLASS_SAVING_THROWS[options.className.toLowerCase()];
      if (saves) constraints += ` Saving throw proficiencies: ${saves.join(", ")}.`;
      // Inject spellcasting ability
      const spellAbility = CLASS_SPELLCASTING_ABILITY[options.className.toLowerCase()];
      if (spellAbility) constraints += ` Spellcasting ability: ${spellAbility}.`;
    }
    if (options.race) {
      // If generic race with subraces (e.g. "elf"), tell AI to pick a specific one
      if (raceHasSubraces(options.race)) {
        const ruleset = options.ruleset || "all";
        const subRaces = getAllRaces(ruleset).filter(r =>
          r.toLowerCase().includes(options.race.toLowerCase())
        );
        if (subRaces.length) {
          constraints += ` The race must be one of: ${subRaces.join(", ")}. Pick the most fitting specific subrace for the character concept.`;
        } else {
          constraints += ` The race is ${options.race}.`;
        }
      } else {
        constraints += ` The race is ${options.race}.`;
      }
      // Inject racial traits
      const raceInfo = getRaceData(options.race);
      if (raceInfo) {
        if (raceInfo.traits.length) constraints += ` Racial traits to include: ${raceInfo.traits.join(", ")}.`;
        if (raceInfo.darkvision) constraints += ` Has darkvision ${raceInfo.darkvision} ft.`;
        constraints += ` Base walking speed: ${raceInfo.speed} ft.`;
        if (raceInfo.languages.length) constraints += ` Default languages: ${raceInfo.languages.join(", ")}.`;
      }
      // Homebrew racial traits for non-SRD races
      if (!isRaceSRD(options.race)) {
        constraints += ` The race "${options.race}" is homebrew. Generate 3-4 original racial traits with unique names and descriptions in the "racialTraits" array.` +
          ` Each trait MUST have: name (string), description (1-2 sentences of original text).` +
          ` Each trait may ALSO include these optional mechanical effect fields:` +
          ` "acFormula" (string) — natural armor formula like "13 + @abilities.dex.mod" (only for natural armor traits),` +
          ` "resistances" (array of strings) — damage resistances like ["fire"] or ["psychic","poison"],` +
          ` "immunities" (array of strings) — damage immunities like ["poison"],` +
          ` "conditionImmunities" (array of strings) — condition immunities like ["poisoned","charmed"],` +
          ` "speed" (object) — speed overrides like {"walk":35} or {"swim":30,"climb":30},` +
          ` "darkvision" (number) — darkvision range in feet like 60 or 120.` +
          ` IMPORTANT: Include mechanical fields whenever a trait has a game-mechanical effect. Do NOT put mechanical effects only in the description — use the structured fields so they can be applied automatically.` +
          ` Do NOT copy from published D&D sourcebooks — create original content.` +
          ` Traits must be balanced for the character's level — no free extra attacks, no at-will powerful spells, no ability scores above 20.` +
          ` Use SRD races as a power benchmark (e.g., Elf gets darkvision + Fey Ancestry + Trance).` +
          ` IMPORTANT: Since this is a homebrew race, ability scores must be FINAL values (not base).` +
          ` Start from standard array or point buy, then add +3 total for racial bonuses (e.g., +2 to one and +1 to another).` +
          ` Also add any ASI from class advancement (e.g., +2 at level 4, +2 at level 8, etc.).` +
          ` Scores can go above 15 but never above 20.`;
      } else {
        // SRD race: remind AI to keep base scores since the wizard handles bonuses
        constraints += ` IMPORTANT: Since "${options.race}" is an SRD race, keep ability scores as BASE values (8-15 range, standard array or point buy). Do NOT add racial, background, or ASI bonuses — the Foundry character wizard will apply those.`;
      }
    }
    if (options.subclass) constraints += ` The subclass is ${options.subclass}.`;
    const extraPrompt = game.settings.get(MODULE_ID, "actorCharacterPrompt") || "";
    if (extraPrompt) systemPrompt += "\n" + extraPrompt;
  } else {
    systemPrompt = NPC_PROMPT_BASE;
    if (options.cr != null) constraints += ` The Challenge Rating must be ${options.cr}.`;
    if (options.creatureType) constraints += ` The creature type is ${options.creatureType}.`;
    const extraPrompt = game.settings.get(MODULE_ID, "actorNPCPrompt") || "";
    if (extraPrompt) systemPrompt += "\n" + extraPrompt;
  }

  const fullPrompt = constraints ? prompt + constraints : prompt;
  return await chatCompletion(config, config.chatModel, systemPrompt, fullPrompt, MAX_TOKENS_ACTOR, true);
}

/**
 * Generate a creative actor name via AI.
 * @param {string} prompt — actor description prompt
 * @param {"npc"|"character"} actorType
 * @param {GeneratorConfig} config
 * @returns {Promise<string|null>}
 */
export async function apiGenerateActorName(prompt, actorType, config) {
  const namePrompt = actorType === "character"
    ? "Generate a creative fantasy character name appropriate for a D&D 5e player character. Consider the race and class if mentioned. Use evocative names — 'Thalia Moonwhisper', 'Grim Ashford', 'Zephyra Dawnblade'. Output only the name in plain text, no JSON."
    : "Generate a creative fantasy NPC name appropriate for a D&D 5e creature or non-player character. Consider the creature type if mentioned. Use evocative names — 'Morghast the Undying', 'Sable Whisperthorn', 'Ironjaw'. Output only the name in plain text, no JSON.";

  return await chatCompletion(config, config.lightModel || config.chatModel, namePrompt, prompt, 20);
}

/**
 * Generate an actor image (portrait or token).
 * Routes through the same image provider system as item images.
 * @param {string} prompt — image description
 * @param {"portrait"|"token"} imageType
 * @param {GeneratorConfig} config
 * @returns {Promise<string|null>} saved image path, or null on failure
 */
export async function generateActorImage(prompt, imageType, config) {
  if (!prompt || !config) return null;

  // Get custom prompt template from settings, or use defaults
  let imagePrompt;
  if (imageType === "token") {
    const template = game.settings.get(MODULE_ID, "actorTokenPrompt") ||
      "A top-down token view of {prompt}. Circular token, dark background, RPG battle map token style. No text, no letters, no words.";
    imagePrompt = template.replace("{prompt}", prompt);
  } else {
    const template = game.settings.get(MODULE_ID, "actorPortraitPrompt") ||
      "A portrait of {prompt}. Dark fantasy RPG character portrait style. Detailed face and upper body. No text, no letters, no words.";
    imagePrompt = template.replace("{prompt}", prompt);
  }

  // Determine save folder
  const subfolder = imageType === "token" ? "tokens" : "portraits";
  const targetFolder = `${config.imageFolder}/${subfolder}`;

  const imageProvider = config.imageProvider || "openai";

  // Route to non-OpenAI image providers
  if (imageProvider === "stable-diffusion") {
    try {
      const sdConfig = { ...config, imageFolder: targetFolder };
      const imagePath = await generateSDImage(imagePrompt, sdConfig);
      if (imagePath) return imagePath;
    } catch (err) {
      console.error("SD actor image failed:", err);
    }
  } else if (imageProvider === "stability-ai") {
    return stabilityAIProvider.generateImage(imagePrompt, { ...config, imageFolder: targetFolder });
  } else if (imageProvider === "fal-ai") {
    return falAIProvider.generateImage(imagePrompt, { ...config, imageFolder: targetFolder });
  } else if (imageProvider === "xai") {
    return xaiImageProvider.generateImage(imagePrompt, { ...config, imageFolder: targetFolder });
  }

  // OpenAI image generation (default)
  if (!config.dalleApiKey) return null;

  const imageModel = config.imageModel;
  const imageFormat = config.imageFormat || "png";

  const requestBody = {
    model: imageModel,
    prompt: imagePrompt,
    n: 1,
    size: "1024x1024"
  };

  if (imageModel.startsWith("dall-e")) {
    requestBody.response_format = "b64_json";
  } else {
    requestBody.quality = "medium";
    requestBody.output_format = imageFormat;
  }

  try {
    const response = await fetch(IMAGE_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${config.dalleApiKey}`
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => "");
      console.error(`Actor image API error ${response.status}: ${errorBody}`);
      return null;
    }

    const data = await response.json();
    if (data.error) {
      console.error("Actor image generation error:", data.error);
      return null;
    }

    if (data.data?.[0]?.b64_json) {
      const fmt = (!imageModel.startsWith("dall-e") && IMAGE_FORMAT_MAP[imageFormat])
        ? IMAGE_FORMAT_MAP[imageFormat]
        : IMAGE_FORMAT_MAP.png;

      const dataUrl = `data:${fmt.mime};base64,${data.data[0].b64_json}`;
      const shortName = prompt.replace(/[^a-zA-Z0-9 ]/g, "").split(/\s+/).slice(0, 4).join("_").toLowerCase();
      const fileName = `${shortName}_${imageType}_${Date.now()}.${fmt.ext}`;
      await ensureFolder(targetFolder);

      trackImageGeneration();
      return await saveImageLocally(dataUrl, fileName, targetFolder);
    }
  } catch (err) {
    console.error("Actor image request failed:", err.message);
  }

  return null;
}
