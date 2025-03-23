# Changelog

## v1.0.1 - Improvements & Fixes
- ✅ **Ephemeral Image Generation**: Replaced local image saving with on-demand DALL·E images, opened in a new tab for manual saving.
- ✅ **Structured JSON for Items**: GPT now returns a detailed JSON object that includes advanced properties (e.g., `magical`, `weaponProperties`, `armor` details).
- ✅ **Advanced Item Type Mapping**: Expanded to cover most D&D 5e item types (weapon, armor, potion, wand, loot, backpack, etc.).
- ✅ **Armor Handling**: Properly categorizes armor by setting the `system.armor` fields (AC, type, Dex cap) for Foundry’s D&D 5e system.
- ✅ **Weapon Properties**: If the item is a weapon, GPT can specify an array of properties (e.g., finesse, heavy, light), automatically mapped to Foundry.
- ✅ **Button Placement for Foundry v12**: Switched to the `renderSidebarTab` hook so the “Generate AI D&D 5e Item” button appears correctly in the Items tab.
- ✅ **Fixes & Enhancements**:
  - Stopped duplicating item names in the description.
  - Improved Foundry D&D 5e compatibility.
  - Moved API keys to Foundry module settings instead of hardcoding.

## v1.0.0 - Initial Release
- 🎉 First version of the **ChatGPT Item Generator** module.
- ✅ AI-generated **D&D 5e items** with descriptions and effects.
- ✅ Added support for **OpenAI & DALL·E API keys**.
- ✅ UI button in **Items Directory** to generate items.
