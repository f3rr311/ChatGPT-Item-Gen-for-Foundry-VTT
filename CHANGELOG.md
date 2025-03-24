# Changelog

## v1.0.2 - Enhanced Roll Table & Image Storage Improvements
- ✅ **Local AI Image Storage:**  
  Switched from ephemeral image handling to saving AI-generated images locally using Base64 encoding in the module folder (`modules/chatgpt-item-generator/images`). This ensures images persist across module updates.
- ✅ **Improved Generic Roll Table Prompt:**  
  The system prompt for generic roll tables has been refined to require exactly 20 tailored entries. GPT is now explicitly instructed to include context-specific details (e.g., city, biome, or theme) to avoid overly generic outputs.
- ✅ **Roll Table Linking Enhancements:**  
  When generating roll tables in "items" mode, each roll table entry now automatically creates a unique item document and links it properly.
- ✅ **Weapon Damage Formatting:**  
  Added logic to convert damage strings into a structured damage object (using a default damage type when necessary) so that weapon damage appears correctly in the D&D 5e item sheet.
- ✅ **General Stability Improvements:**  
  Various fixes to JSON parsing and consistency checks between item names and descriptions to ensure proper mapping and formatting.
- ✅ **Unified Dialog Interface:**  
  Updated dialog now includes dropdowns for selecting between items and roll tables (with a separate mode for generic tables), streamlining the user experience.

## v1.0.1 - Improvements & Fixes
- ✅ **Ephemeral Image Generation:** Replaced local image saving with on-demand DALL·E images, opened in a new tab for manual saving.
- ✅ **Structured JSON for Items:** GPT now returns a detailed JSON object that includes advanced properties (e.g., `magical`, `weaponProperties`, `armor` details).
- ✅ **Advanced Item Type Mapping:** Expanded to cover most D&D 5e item types (weapon, armor, potion, wand, loot, backpack, etc.).
- ✅ **Armor Handling:** Properly categorizes armor by setting the `system.armor` fields (AC, type, Dex cap) for Foundry’s D&D 5e system.
- ✅ **Weapon Properties:** If the item is a weapon, GPT can specify an array of properties (e.g., finesse, heavy, light), automatically mapped to Foundry.
- ✅ **Button Placement for Foundry v12:** Switched to the `renderSidebarTab` hook so the “Generate AI D&D 5e Item” button appears correctly in the Items tab.
- ✅ **Fixes & Enhancements:**
  - Stopped duplicating item names in the description.
  - Improved Foundry D&D 5e compatibility.
  - Moved API keys to Foundry module settings instead of hardcoding.

## v1.0.0 - Initial Release
- 🎉 First version of the **ChatGPT Item Generator** module.
- ✅ AI-generated **D&D 5e items** with descriptions and effects.
- ✅ Added support for **OpenAI & DALL·E API keys**.
- ✅ UI button in **Items Directory** to generate items.
