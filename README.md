# ChatGPT Item Generator for Foundry VTT

![image](https://github.com/user-attachments/assets/6b890c07-544d-42b1-829a-4f93b0a73827)


## Overview
This module uses **ChatGPT** and **DALL·E** to dynamically generate **D&D 5e items** within Foundry VTT. You can prompt for an item type (weapon, armor, potion, etc.) and a brief description; the module will then:
- **Generate a short, thematic item name** via ChatGPT.
- **Produce a long, detailed description** with structured D&D 5e stats (e.g., rarity, magical flag, weapon properties, armor details, damage calculations).
- **Generate and store an AI image locally** using Base64 encoding, ensuring that images persist across module updates.
- **Optionally create a roll table**, with tailored entries that include additional context (such as city, biome, or theme details) and automatically link generated items.

## Features

### AI Integration with ChatGPT and DALL·E 
- Make sure to make your API keys here: https://platform.openai.com/api-keys
- Uses ChatGPT (via GPT-4) to generate structured JSON for D&D 5e items and roll tables.
- Utilizes DALL·E for on-demand image generation for items, saving images locally.

### Robust JSON Handling
- Implements multiple strategies for sanitizing and fixing invalid JSON (using the OpenAI API for corrections if necessary).
- Ensures output JSON adheres to Foundry’s expected structure for items and roll tables.

### Item Generation Features
- Automatically maps generated JSON fields (description, rarity, weight, price, attunement) to Foundry 5e item sheet fields.
- Processes weapon-specific data:
  - Maps raw damage data (e.g. `"dice": "1d6"` and `"bonusModifiers": "+1"`) into Foundry’s damage structure if provided.
  - Applies a default damage type (e.g. `"slashing"`) and supports bonus modifiers if provided.
  - Maps and enforces weapon properties (e.g. melee, range, versatile, finesse) into the item’s properties array if provided.
- Includes consistency fixes that extract the item name from the description if it’s embedded there.

### Roll Table Generation
- Generates strictly valid JSON for roll tables with a fixed number of entries.
- Supports two types of roll tables:
  - **Generic Roll Tables:** Customizable entries based on thematic or location-based prompts.
  - **Item Roll Tables:** Automatically generates items for each roll table entry, using the entry text as the item name.

### User Interface Enhancements
- **Unified Dialog Interface:**
  - Provides a custom dialog window with dropdowns to select between item and roll table generation.
  - Offers a separate dropdown for explicit item type selection (e.g., Weapon, Armor, Consumable) which appears based on context.
  - Displays a separate dropdown for roll table mode (Items vs. Generic) when roll table generation is selected.
- **Auto-Resizing Dialog:**
  - Adjusts the dialog window to auto-resize so that all controls and the Generate button are immediately visible without scrolling.
- **Progress Bar:**
  - Displays a progress bar overlay during AI generation to provide visual feedback on processing steps.
- **Footer Button Integration:**
  - Adds a "Generate AI (Item or RollTable)" button to the Items directory footer.
  - The button is conditionally displayed only to Game Masters, keeping it hidden from players.

### Damage Mapping and Weapon Classification
- Tweaks the damage mapping logic to correctly reformat ChatGPT’s raw damage data into Foundry’s expected damage structure.
- Includes explicit weapon type mapping and base weapon classification to better support weapon items.

### Local Image Storage
- Creates and verifies designated folders in the Foundry data directory.
- Saves generated images using Base64 encoding, ensuring they are stored locally with proper error handling.

### API Key Integration and Security
- Moves API keys (for ChatGPT and DALL·E) to module settings for enhanced security and easier configuration.


## Setup & Usage
1. **Enable** the module in your world under `Game Settings > Manage Modules`.
2. **Enter** your OpenAI API keys in `Game Settings > Configure Settings > ChatGPT Item Generator`.
3. **Open the Items tab** (in Foundry v12, the button is placed via the `renderItemDirectory` hook).
4. **Click** **Generate AI (Item or RollTable)** to open the dialog, then choose whether to generate an item or a roll table.
5. For roll tables:
   - Select "Items" mode to automatically create and link generated item documents.
   - Select "Generic" mode to generate a tailored table with 20 descriptive entries.
6. **Enjoy** your dynamically generated content!

## Notes
- **Local Image Storage:**  
  Generated images are saved in the module folder under `data/chatgpt-item-generator/`. Ensure that you have appropriate permissions for file writing.
- **Roll Table Generation:**  
  The module requires GPT to generate exactly 20 entries for generic roll tables. If the table is empty, try re-running the prompt with more specific environmental details.
- **Damage Calculations:**  
  For weapons, if GPT provides a damage string (e.g., "1d8"), it is automatically converted into a structured damage object that matches the D&D 5e system’s requirements.
  
## Support
For issues or feature requests, visit [GitHub Issues](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/issues).

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
