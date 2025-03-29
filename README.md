# ChatGPT Item Generator for Foundry VTT

![image](https://github.com/user-attachments/assets/6b890c07-544d-42b1-829a-4f93b0a73827)

## Overview
This module leverages **ChatGPT**, **DALL·E 3**, and **Stable Diffusion** to dynamically create **D&D 5e items** within Foundry VTT. Simply provide an item type (such as weapon, armor, or potion) along with a brief description, and the module will:

- **Generate a concise, thematic item name and description** using ChatGPT.
- **Produce a comprehensive description** complete with structured D&D 5e stats, including rarity, magical properties, weapon details, armor specifications, and damage calculations.
- **Create and locally store an AI-generated image** using Base64 encoding, ensuring the image remains available even after module updates.
- **Build roll tables** with customized entries that incorporate additional context (like city, biome, or theme details) while simultaneously generating linked items.

## Features

### AI Integration with ChatGPT, DALL·E, and Stable Diffusion
- **API Key Setup:** Obtain your API keys at [OpenAI API Keys](https://platform.openai.com/api-keys). Stable Diffusion access is also configurable.
- **Structured JSON Generation:** Uses ChatGPT (via GPT-4) to produce structured JSON for both D&D 5e items and roll tables.
- **On-Demand Image Generation:**  
  - **DALL‑E Integration:** Utilizes DALL‑E 3 (with fallback to DALL‑E 2) for creating item images on the fly.
  - **Stable Diffusion Integration:** Optionally uses Stable Diffusion for image generation. The module polls for task completion before retrieving the image.
- **Media Optimizer Support:** Ensures that generated images are compatible with the Media Optimizer module by preserving file naming and conversion behavior.
- **Exposed Promts:** Prompts are now exposed in the Modules settings to allow for further custimzation. (GPT, DALL-E and Stable Diffusion)

### Robust JSON Handling
- **Error Correction:** Employs multiple strategies to sanitize and fix invalid JSON, including using the OpenAI API for corrections.
- **Compliance:** Ensures that the generated JSON adheres to Foundry’s expected structure for items and roll tables.

### Item Generation Capabilities
- **Automatic Mapping:** Seamlessly maps generated JSON fields (description, rarity, weight, price, attunement, etc.) to the corresponding Foundry 5e item sheet fields.
- **Weapon Data Processing:**
  - Converts raw damage data (e.g., `"dice": "1d6"` with modifiers) into Foundry’s structured damage format.
  - Applies default damage types and enforces weapon properties within the item’s properties array.
- **Name Extraction & Refinement:**  
  - Extracts the item name from the description if embedded.
  - Supports name override via the dialog (which now takes precedence over auto-generation).

### Roll Table Generation
- **Valid JSON Output:** Generates strictly valid JSON for roll tables, ensuring a consistent number of entries.
- **Dual Modes:**  
  - **Generic Roll Tables:** Customizable entries based on thematic or location-based prompts.
  - **Item Roll Tables:** Automatically creates items for each roll table entry, using the entry text as the item name.

### User Interface Enhancements
- **Unified Dialog Interface:**  
  - Custom dialog with dropdown menus for selecting between item and roll table generation.
  - Contextual dropdown for explicit item type selection (e.g., Weapon, Armor, Consumable).
  - Separate dropdown for roll table mode (Items vs. Generic) when generating a roll table.
  - Editable fields for API keys, prompts (for ChatGPT and DALL‑E), and Stable Diffusion settings, complete with human-readable labels and disclaimers.
- **Progress Bar:** Includes a visual progress bar overlay during AI generation to indicate processing status.
- **Footer Button Integration:** Adds a "Generate AI (Item or RollTable)" button to the Items directory footer, visible only to Game Masters.

### Damage Mapping and Weapon Classification
- **Accurate Formatting:** Refines the damage mapping logic to convert ChatGPT’s raw damage data into the format required by Foundry.
- **Weapon Classification:** Features explicit weapon type mapping and classification to better support weapon items.

### Local Image Storage
- **Directory Management:** Creates and verifies designated folders within the Foundry data directory.
- **Persistent Storage:** Saves AI-generated images using Base64 encoding with robust error handling and media optimizer compatibility.

## Setup & Usage

1. **Install** the module via Foundry VTT’s Module Management.
2. **Enable** the module in your world via `Game Settings > Manage Modules`.
3. **Configure** your API keys and prompt settings in `Game Settings > Configure Settings > ChatGPT Item Generator`. Adjust Stable Diffusion and Media Optimizer settings as needed.
4. **Access** the Items tab (in Foundry v12, the "Generate AI (Item or RollTable)" button is integrated into the Items directory footer, visible only to GMs).
5. **Click** the button to open the dialog, then choose whether to generate an item or a roll table.
   - For roll tables:
     - Select "Items" mode to automatically create and link generated item documents.
     - Select "Generic" mode to produce a custom table with 20 descriptive entries.
6. **Enjoy** your dynamically generated content!

## Troubleshooting & FAQ
- **Common Issues:**
  - **API Key Errors:** Verify that your API keys are correctly entered in the module settings.
  - **Image Saving Failures:** Ensure the module folder (`data/chatgpt-item-generator/`) has the necessary write permissions.
  - **JSON Formatting Problems:** If the output JSON is invalid, try re-running the prompt or check the OpenAI API response.
- **General FAQs:**  
  Refer to the [GitHub Issues](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/issues) page for community-driven solutions and additional support.

## Example Prompts
- **Item Prompt:**  
  "Generate a mystical sword with an enchanted blade that glows in the dark."
- **Roll Table Prompt:**  
  "Create a generic roll table for a haunted village with eerie, atmospheric entries."

## Future Roadmap
- **Planned Features:**
  - Enhanced UI customization for easier item editing.
  - Support for additional game systems beyond D&D 5e.
  - More robust error handling and logging for AI generation failures.
- **Community Contributions:**  
  Feedback and contributions are welcome to help shape future versions of the module.

## Contribution Guidelines
- **How to Contribute:**  
  Interested in contributing? Please follow our [GitHub Contribution Guidelines](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/issues).

## Additional Notes
- **Local Image Storage:**  
  Images are saved in the module folder at `data/chatgpt-item-generator/`. Ensure you have the necessary file write permissions.
- **Roll Table Generation:**  
  The module requires GPT to generate exactly 20 entries for generic roll tables. If the table appears empty, try rerunning the prompt with more specific details.
- **Damage Calculations:**  
  For weapons, any provided damage string (e.g., "1d8") is automatically converted into a structured damage object that aligns with D&D 5e system requirements.
- **Media Optimizer Compatibility:**  
  Generated images are processed to be compatible with the Media Optimizer module, ensuring they are optimized for web delivery.
- **Stable Diffusion Settings:**  
  You will need to add the following to your webui-user.bat/sh file: `set COMMANDLINE_ARGS=--cors-allow-origins="*" --api` and `set API_KEY=yourkey`

## Support
For issues or feature requests, please visit [GitHub Issues](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/issues).

## License
This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).
