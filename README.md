Looking for others that would like to work on this with me, as I am not a programmer really.

# ChatGPT Item Generator for Foundry VTT

## Overview
This module uses **ChatGPT** and **DALL·E** to dynamically generate **D&D 5e items** within Foundry VTT. You can prompt for an item type (weapon, armor, potion, etc.) and a brief description; the module will then:
- **Generate a short, thematic item name** via ChatGPT.
- **Produce a long, detailed description** with structured D&D 5e stats (e.g., rarity, magical, weapon properties, armor details).
- **Optionally generate an AI image** using DALL·E, opened in a new tab for manual saving if desired.

## Installation
1. **Download or install** the module via Foundry’s module manager.
2. **Enable** it in `Game Settings > Manage Modules`.
3. **Enter** your OpenAI API keys in **`Game Settings > Module Settings > ChatGPT Item Generator`**: (Not Working Currently) (They show up under "Unmapped")
   - **OpenAI API Key** (for ChatGPT text generation).
   - **DALL·E API Key** (for image generation).
4. Open the **Items** tab, then click **Generate AI D&D 5e Item**.(Not Wokring Currently) Must use this Macro ATM:

```
console.log("Checking if ChatGPT Item Generator is loaded...");
console.log("game.chatGPTItemGenerator:", game.chatGPTItemGenerator);

if (game.chatGPTItemGenerator) {
    console.log("Module is loaded! Running createFoundryItem...");
    game.chatGPTItemGenerator.createFoundryItem();
} else {
    console.error("ChatGPT Item Generator module is NOT loaded.");
    ui.notifications.error("ChatGPT Item Generator module is not loaded.");
}
```

## Features
- **AI-Generated Item Names**: Short, thematic titles for your fantasy items.
- **Long, Structured Descriptions**: ChatGPT can provide detailed lore, rarity, attunement, and other D&D 5e fields in JSON format.
- **Weapon & Armor Support**:
  - **Weapon Properties** (e.g., finesse, heavy, light) can be automatically assigned.
  - **Armor Fields** (AC, type, Dex cap) are handled under the D&D 5e system.
- **Magical or Mundane**: ChatGPT decides if the item is magical, or you can rely on the rarity to mark it as magical.
- **Advanced Item Type Mapping**: Supports typical 5e types like weapon, armor, potion, scroll, ring, wand, tool, loot, etc.
- **Ephemeral AI Images**:
  - The module **opens** DALL·E images in a new tab instead of saving them locally.
  - You can **right-click and save** them if desired.
- **No Hardcoded Keys**: Enter API keys in Foundry’s settings for security.

## Setup & Usage
1. **Enable** the module in your world under `Manage Modules`.
2. **Enter** your OpenAI keys in `Game Settings > Module Settings > ChatGPT Item Generator`.
3. **Open the Items tab** (in Foundry v12, the button is placed via the `renderSidebarTab` hook).
4. **Click** **Generate AI D&D 5e Item** to prompt for item type and a description.
5. **Enjoy** your newly generated item with ephemeral AI art!

## Notes
- **Images are ephemeral** and may expire after a short time. The link will break, so if you want to preserve them, **right-click & save** the opened image.
- If ChatGPT marks the item as `magical = true` or if the item’s rarity is Rare or higher, the module will flag the item as magical in Foundry.

## Support
For issues or feature requests, visit [GitHub Issues](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/issues).

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
