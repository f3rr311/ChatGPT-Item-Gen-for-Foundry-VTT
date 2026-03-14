# Update Logs

## v2.2.1 — Code Health, UI Fixes & Architecture Improvements

### 🛠 Fixes

* **History Dialog Button Visibility:** Regen buttons (Name, Image, Desc) were invisible on highlighted rows due to Foundry v13 CSS layer priority. Switched to inline styles for reliable contrast in all themes.
* **History Dialog Row Readability:** All rows now have explicit dark backgrounds and light text — no more unreadable entries on selection.
* **History Dialog Default Width:** Dialog opens at 700px with a 680px minimum so the table layout isn't cramped on first open.
* **GM Guard on Generator Dialog:** Non-GM users can no longer open the item generator dialog — previously only the footer button was gated.

### ✨ Improvements

* **Modular UI Architecture:** Generator and History dialogs extracted from `main.js` into dedicated `scripts/ui/generate-dialog.js` and `scripts/ui/history-dialog.js` modules.
* **Shared Type Keywords:** Duplicated weapon/spell/feat keyword arrays consolidated into a shared `scripts/utils/type-keywords.js` module used by both `item-generator.js` and `openai.js`.
* **Deduplicated Constants:** `WEIGHTLESS_TYPES` and `NO_MAGIC_PROPS_TYPES` merged into a single `NON_PHYSICAL_ITEM_TYPES` set.
* **Type Safety JSDoc:** Added `GeneratorConfig` and `ParsedGPTItem` typedefs with full `@param`/`@returns` annotations on all major API and generator exports.
* **Utility Extraction:** `withRegenSpinner` (regen button loading state) and `enableSpellcheck` (right-click spellcheck helper) extracted into `ui-utils.js` — shared by Preview and History dialogs.
* **Empty Catch Blocks:** All silent `catch {}` blocks now log context via `console.debug`.
* **Redundant Code Cleanup:** Removed narration-style console logs, simplified boolean ternaries, hoisted repeated variables, and removed dead assignments.

---

## v2.2.0 — Item Preview, Regenerate Parts, Compendium Validation & AI Folders

### 🚀 New Features

* **Item Preview Dialog:**
  * Full preview of name, description, image, and stat badges before the item is created.
  * Editable name and description fields — tweak anything before committing.
  * Regenerate buttons for name, image, or description individually without re-running the full generation.
  * **Try Again** button re-runs the full generation with the same prompt until you get what you want.
* **Regenerate From History:**
  * Regen Name, Image, or Description for any previously created item directly from the History dialog.
  * Updates the existing item in your world — no duplicates created.
  * Roll tables show entry count; individual items show full regen controls.
* **Compendium Validation:**
  * Generated items are cross-referenced against SRD compendium packs for stat accuracy.
  * Duplicate detection warns you if a similar item already exists in your world.
  * Smart defaults fallback — when GPT misses weapon damage or armor AC, compendium data fills the gap.
* **AI Items Folder:**
  * All generated items are automatically placed in an "AI Items" folder.
  * Roll table items go into a named subfolder (e.g., "AI Items / Dragon's Hoard").
  * Folders are created automatically if they don't exist.
* **Cost Estimation (USD):**
  * Estimated dollar cost shown on the progress bar during generation.
  * Session totals in the History dialog — dollars, tokens, API calls, and images.
  * Automatically uses pricing for your configured models (GPT-4.1, GPT-4.1-mini, GPT Image 1, etc.).

### ✨ Improvements

* **Resizable Dialogs:** Generate, Preview, and History dialogs can all be resized by dragging.
* **Right-Click Spellcheck:** Native browser spellcheck enabled on all text input fields (stopPropagation on contextmenu).
* **Shortened Image Filenames:** Image files use the first 4 words of the prompt + timestamp instead of the full prompt string.
* **Stacked Regen Layout:** Regen buttons positioned below fields instead of inline for a cleaner look.
* **History Dialog Layout:** Flex-based layout ensures the table fills available space when the dialog is resized.

---

## v2.1.0 — Prompt Templates, Generation History, Token Tracking & Smarter Consumables

### 🚀 New Features

* **Prompt Templates:**
  * 10 built-in presets: Uncommon Weapon, Rare Armor, Legendary Wondrous Item, Healing Potion, 3rd-Level Spell, Cursed Artifact, Magical Staff, Character Feat, Random Loot Table, Wild Magic Table.
  * Selecting a template auto-fills the prompt textarea, sets the item type dropdown, and switches between Item/Roll Table mode.
* **Generation History:**
  * Session log tracks every generated item and roll table with name, type, rarity, and timestamp.
  * Accessible via the "History" button on the generator dialog.
  * Back button returns to the generator without losing context.
  * Stores up to 50 entries per session.
* **Token Cost Tracker:**
  * Live per-item token count displayed in the progress bar during generation (tokens, API calls, images).
  * Session totals shown in the History dialog footer.
  * Tracks both chat completion tokens and image generations.
* **Rarity-Based Magical Bonus Fallback:**
  * Weapons and armor automatically receive +1 (uncommon), +2 (rare), or +3 (very rare/legendary) magical bonus when the AI omits it.
  * Checks GPT output, description regex, and rarity as a final safety net.
* **Consumable Activities:**
  * Healing potions always get a **Heal activity** with correct dice formula. If the AI omits the dice, PHB-scaled defaults are used (Common: 2d4+2 through Very Rare: 10d4+20).
  * Non-healing consumables (poisons, oils, buff potions) get a **Utility "Use" activity** so they are always usable in Foundry.
* **Consumable Effects on Use:**
  * Buff potions, poisons, and elixirs now generate Active Effects with `transfer: false` — effects apply when the item is used, not passively.
  * Effects are linked to the consumable's activity and include proper duration from the AI's `effectDuration` field.
  * GPT prompt for consumables now explicitly requests `mechanicalEffects` and `effectDuration` for buff/debuff items.
* **Roll Table Safety Net:**
  * High-confidence type overrides (spell, feat, weapon detection) now run on roll table entries too — previously skipped when an explicit type was passed.
  * Extracted into standalone `applyHighConfidenceOverrides()` function.
* **Image Failure Notification:**
  * Clear `ui.notifications.warn()` toast when image generation fails instead of silent fallback to default icon.
* **DALL-E Deprecation Warning:**
  * Permanent notification on world load if using `dall-e-2` or `dall-e-3` image models (deprecated May 12, 2026).

### ✨ Improvements

* **Per-Item Progress Bar:** Progress bar now shows the current item's token cost, not a running session total. Session total displayed separately below.
* **Consumable GPT Prompt:** Expanded to request `mechanicalEffects` for buff potions, poisons, and stat-boosting consumables, plus `effectDuration` for timed effects.
* **Armor Magical Bonus Check:** Fixed `mgc` property check to use `newItemData.system.magicalBonus` instead of only checking `parsed.magicalBonus`.

### 🛠 Fixes

* **Armor `mgc` Property:** Rarity fallback now correctly syncs `system.armor.magicalBonus` with `system.magicalBonus` and sets the `mgc` property flag.
* **Roll Table Type Override:** Phase A safety net no longer skipped for items with explicit types — prevents misclassified roll table entries.

---

## v2.0.0 — Complete Rewrite: Modular Architecture & dnd5e v4/v5 Native Support

### 🚀 New Features

* **Modular Architecture:** Monolithic `script.js` fully refactored into 15 ES modules with clean separation of concerns (API, generators, utilities, UI).
* **D&D 5e v4/v5 Activities System:**
  * Automatically creates **Attack**, **Save**, **Damage**, **Heal**, **Utility**, and **Cast** activities on generated items.
  * Correct damage formulas, save DCs, ability modifiers, and scaling.
* **Active Effects Engine:**
  * Parses item descriptions and maps bonuses to **80+ effect keys** — skills, ability scores, saves, AC, movement, resistances, damage immunities, condition immunities, senses, and more.
  * `EFFECT_KEY_MAP` covers the full dnd5e v4 effect vocabulary.
* **PHB Defaults Tables:**
  * **40+ weapons** with official PHB stats (damage dice, damage type, properties, weight, cost, 2024 mastery).
  * **18 armor types** with official AC, dex cap, strength requirement, and stealth disadvantage.
  * Authoritative fallback when AI provides incomplete data.
* **Two-Pass Description Validation:**
  * **Pass 1 (Regex):** Instant scan of 10 pattern categories — weapon attack bonuses, extra damage, resistances, immunities, skill advantages, senses, speed, AC, and save bonuses.
  * **Pass 2 (GPT):** Informed re-scan catches nuanced bonuses the regex missed.
  * Both passes de-duplicate against existing effects and protect against armor AC double-counting.
* **Three-Stage Type Safety Net:**
  * **Stage 1:** Explicit UI selection (user override).
  * **Stage 2:** GPT's `itemType` field from the generated JSON.
  * **Stage 3:** Keyword-based safety net with Phase A (high-confidence: spell, feat, weapon) always running, and Phase B (equipment fallback: consumable, tool, loot) only when still classified as equipment.
* **Themed Dialog UI:**
  * New dark-themed dialog with purple accent, scoped CSS using Foundry variables.
  * Responsive layout, proper form controls, and polished button styling.
* **Foundry v13 Native DOM:**
  * `renderItemDirectory` hook uses native DOM for v13, jQuery for v12 — no deprecation warnings on either version.

### ✨ Improvements

* **Spell Normalization:** Full normalization of school, activation cost, duration, range, target, and component fields with compendium lookup support.
* **Weapon Damage Transforms:** Robust parsing of damage formulas, versatile damage, and generic weapon mapping (e.g., katana → longsword, cutlass → scimitar).
* **Armor Parsing:** Longest-first matching ensures "half plate" doesn't match "plate" — correct base stats every time.
* **Charges & Uses:** Consumables, wondrous items, and equipment automatically get charges/uses with correct recovery formulas.
* **Castable Spell Embedding:** Items with `castableSpells` get Cast activities linked to real spell documents (searched world items, then compendiums).

### 🛠 Fixes

* **Feat Type Detection:** Feats no longer misclassified as consumables — dedicated `FEAT_PROMPT_BLOCK` and Phase A keyword detection.
* **Weapon Type Detection:** Weapons with ambiguous descriptions no longer fall through to "equipment" — Phase A scans both name and description for weapon keywords.
* **`system.type.baseItem` Path:** Fixed for dnd5e v4 — uses `system.type.baseItem` (not the v3 `system.baseItem` path).
* **Consumable Subtype:** Potions, scrolls, ammunition, and food correctly set `system.type.value` instead of defaulting to blank.
* **Armor AC Calculation:** Base AC pulled from PHB defaults, magical bonus added on top — no more doubled or missing AC values.
* **Equipment Subtype Mapping:** Trinkets, cloaks, rings, and amulets correctly mapped to equipment subtypes instead of falling through.
* **Description Cleaning:** Embedded item names in `<b>Item Name:</b>` format properly stripped from descriptions.
* **JSON Parse Resilience:** Triple-layer fallback (native → GPT repair → regex extraction) dramatically reduces generation failures.

---

## v1.0.8 — Foundry V13 Ready, JSON Hardening, UX Polish

### 🚀 New Features

* **Foundry VTT v13 Compatibility:**
  * Updated for Core v13+ (`game.release.generation >= 13`).
  * Correct usage of `document` for `TableResult.type` and `collectionName` for table linking.
  * No more deprecation warnings in v13.
* **Improved JSON Parsing Resilience:**
  * Triple-layer fallback: native `JSON.parse` → GPT auto-repair → regex extraction.

### ✨ Improvements

* **Name-in-Description Extraction:** Stronger regex handling for varied HTML formats.
* **Accurate Progress Bar:** Step-by-step updates at 20/40/60/80/100%.
* **Smarter Weapon Detection:** Expanded keywords — katana, scimitar, rapier, pike, quarterstaff, cutlass, sabre.
* **Armor & Consumable Fields:** Correct `system.type.value` for consumables (v4+), proper `dexCap`, `strength`, and `ac` for armor.
* **Stable Diffusion Polling Fix:** 60-attempt cap prevents hangs on malformed task IDs.
* **Responsive Dialog:** Auto-height resizing, no clipping on smaller screens.
* **Roll Table Generic Mode:** Now fully ignores item-name prompts.
* **Refined Default Prompts:** Updated item name and roll table prompts.
* **Code Quality:** Cleaned section headers, better comments, removed dead code.

---

## v1.0.7 — Prompt Customization & Progress Feedback

### ✨ Improvements

* **Secured Prompt Settings:** Essential JSON formatting and D&D details are now hard-coded; extra instructions remain editable via settings.
* **Separated Fixed vs. Editable Prompts:** Fixed D&D 5e item details remain unchanged, editable extra instructions appended before the JSON formatting requirement.
* **Improved Item Name Prompt:** Default now avoids "dragon" unless explicitly requested.
* **Roll Table JSON Update:** Generic tables now ignore extra roll table JSON settings and use only the fixed prompt.
* **Enhanced Progress Bar:** Granular updates at image generation, JSON generation, parsing/fixing, name refinement, and final creation.

### 🛠 Fixes

* **Item JSON Setting:** Corrected issue with the script not following the item JSON setting.

---

## v1.0.6 — Stable Diffusion, Prompt Customization, Media Optimizer

### 🚀 New Features

* **Stable Diffusion Integration:**
  * Alternative to DALL-E for image generation.
  * New settings: Enabled toggle, API Key, Endpoint, Main Prompt, Negative Prompt, Steps, CFG Scale, Sampler Name.
  * Polls for task completion before falling back to DALL-E.
* **ChatGPT Prompt Customization:**
  * Configurable prompts for item names, item JSON, and DALL-E via module settings.
  * Improved keyword forcing logic.
* **Media Optimizer Support:** Compatibility with Media Optimizer module for file naming and conversion.
* **Name Override:** Item names can be manually set in the dialog; leave blank for AI naming.

---

## v1.0.5 — API Key Refresh

### 🛠 Fixes

* **API Key Change:** When the OpenAI API key is changed, the session now refreshes to apply the new token immediately.

---

## v1.0.4 — Nested Types, Magic Detection, DALL-E 2 Fallback

### ✨ Improvements

* **Nested Type Handling:** Checks for nested type objects in parsed JSON; defaults to `{ value: "simpleM", baseItem: "" }` for weapons if absent.
* **Magic Fix:** Checks for both "magical" and "magic" properties using robust string comparison.

### 🛠 Fixes

* **DALL-E 2 Fallback:** Falls back to DALL-E 2 if DALL-E 3 fails or is unavailable.

---

## v1.0.3 — Roll Tables, Weapon Mapping, Unified Dialog

### 🚀 New Features

* **Forced Name Override for Roll Tables:** Roll table entry text is used as the final item name.
* **Unified Dialog Interface:** Custom dialog with dropdowns for item vs. roll table generation.
* **Footer Button Integration:** "Generate AI" button added to Items directory footer via `renderItemDirectory` hook.

### ✨ Improvements

* **Enhanced Name Consistency:** Extracts item name from description if it starts with `<b>Item Name:</b>`.
* **Refined JSON Output:** Strengthened system prompt for strictly valid JSON from roll tables.
* **Image Prompt Update:** DALL-E now explicitly instructed to generate images without text.
* **Expanded Weapon Keywords:** Added sabre, blade, lance, longbow, shortbow, sling, javelin, handaxe, warhammer, maul. Removed "wand".
* **Weapon Type Mapping:** Reformatted damage data into Foundry's structure with explicit weapon classification.

### 🛠 Fixes

* **Local Image Storage:** Updated folder creation and checks with proper error handling.

---

## v1.0.2 — Local Image Storage, Roll Table Linking, Damage Formatting

### 🚀 New Features

* **Local AI Image Storage:** Images saved locally via Base64 encoding in `data/chatgpt-item-generator/`, persisting across module updates.
* **Roll Table Linking:** Item-mode roll tables automatically create and link unique item documents per entry.
* **Unified Dialog Interface:** Dropdowns for items, item roll tables, and generic roll tables.

### ✨ Improvements

* **Improved Generic Roll Table Prompt:** Requires exactly 20 tailored entries with context-specific details.
* **Weapon Damage Formatting:** Converts damage strings into structured damage objects with default damage types.
* **General Stability:** Various fixes to JSON parsing and name/description consistency.

---

## v1.0.1 — Initial Release

* Testing release — first public version of ChatGPT Item Generator for Foundry VTT.
