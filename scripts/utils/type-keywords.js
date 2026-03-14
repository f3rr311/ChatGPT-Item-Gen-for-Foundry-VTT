/**
 * Shared item-type detection keyword arrays.
 * Used by openai.js (prompt type selection) and item-generator.js (type resolution).
 * Centralised here to eliminate duplication and keep detection consistent.
 */

/** Weapon-related keywords for type detection. */
export const WEAPON_KEYWORDS = [
  "sword", "longsword", "shortsword", "greatsword",
  "dagger", "axe", "handaxe", "bow", "longbow", "shortbow", "crossbow",
  "mace", "halberd", "flail", "club", "sabre", "cutlass", "blade",
  "lance", "spear", "pike", "sling", "javelin", "warhammer", "maul",
  "staff", "katana", "rapier", "scimitar", "claymore", "naginata",
  "glaive", "trident", "morningstar", "whip", "musket", "pistol"
];

/** Armor/shield keywords for type detection. */
export const ARMOR_KEYWORDS = [
  "armor", "shield", "mail ", "plate", "breastplate", "chainmail",
  "chain shirt", "half plate", "splint", "hide armor", "scale mail", "ring mail"
];

/** Consumable keywords for type detection. */
export const CONSUMABLE_KEYWORDS = [
  "potion", "elixir", "philter", "draught", "scroll", "poison",
  "toxin", "venom", "ration", "tonic", "salve", "balm", "oil",
  "brew", "concoction", "antidote", "vial"
];

/** Spell keywords for type detection. */
export const SPELL_KEYWORDS = ["spell", "cantrip", "incantation"];

/** Feat/feature keywords for type detection. */
export const FEAT_KEYWORDS = ["feat", "feature", "ability"];

/** Tool/instrument keywords for type detection. */
export const TOOL_KEYWORDS = [
  "dice set", "dice game", "gaming set", "playing card",
  "thieves' tools", "thieves tools", "lockpick",
  "alchemist's supplies", "brewer's supplies", "calligrapher's supplies",
  "carpenter's tools", "cartographer's tools", "cobbler's tools",
  "cook's utensils", "glassblower's tools", "jeweler's tools",
  "leatherworker's tools", "mason's tools", "painter's supplies",
  "potter's tools", "smith's tools", "tinker's tools",
  "weaver's tools", "woodcarver's tools", "disguise kit",
  "forgery kit", "herbalism kit", "navigator's tools", "poisoner's kit",
  "lute", "drum", "flute", "lyre", "bagpipe", "dulcimer", "shawm", "viol", "pan pipes"
];

/** Loot/treasure keywords for type detection. */
export const LOOT_KEYWORDS = [
  "gold coin", "silver coin", "copper coin", "platinum coin",
  "gemstone", "raw gem", "uncut gem"
];

/** Name-forcing keywords — items whose prompts mention these get the keyword appended to the name. */
export const NAME_KEYWORDS = ["ring", "amulet", "dagger", "sword", "shield", "gloves", "cloak", "potion"];

// ---------- Shared Module Constants ----------

/** Default icon path used when no item image is available. */
export const DEFAULT_ICON = "icons/svg/d20-highlight.svg";

/** Maximum number of history entries retained per session. */
export const MAX_HISTORY_ENTRIES = 50;

/** Clothing/wearable keywords for equipment subtype resolution. */
export const CLOTHING_KEYWORDS = [
  "clothing", "robe", "cloak", "boots", "gloves", "hat", "helm", "belt",
  "bracers", "cape", "mantle", "amulet", "necklace", "pendant", "circlet",
  "crown", "tiara", "goggles", "vestment", "gauntlet", "slippers", "sandals"
];
