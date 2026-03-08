<div align="center">

<img width="1974" height="1294" alt="image" src="https://github.com/user-attachments/assets/6ff2855d-b7da-44da-bc53-287909156f12" />


# ChatGPT Item Generator for Foundry VTT

![Foundry v13 Compatible](https://img.shields.io/badge/Foundry-v13-brightgreen?style=flat-square) ![Foundry v12 Compatible](https://img.shields.io/badge/Foundry-v12-green?style=flat-square) ![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)
[![Version](https://img.shields.io/badge/Version-2.0.0-orange?style=flat-square)](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/releases) [![D&D 5e](https://img.shields.io/badge/D%26D_5e-v3.3_%E2%80%93_v5.x-red?style=flat-square)](https://github.com/foundryvtt/dnd5e)

<br>

**Generate complete, game-ready D&D 5e items with AI — weapons, armor, spells, feats, potions, and more.**

<br>

<a href="#-features"><img src="https://img.shields.io/badge/%20-Features-black?style=for-the-badge" alt="Features"></a> <a href="#-installation"><img src="https://img.shields.io/badge/%20-Installation-black?style=for-the-badge" alt="Installation"></a> <a href="#-how-to-use"><img src="https://img.shields.io/badge/%20-How_to_Use-black?style=for-the-badge" alt="How to Use"></a> <a href="Updates.md"><img src="https://img.shields.io/badge/%20-Update_Logs-black?style=for-the-badge" alt="Updates"></a>

</div>

<br>

> [!NOTE]
>
> ### 🆕 What's New in v2.0
>
> Version 2.0 is a **complete rewrite** — the monolithic codebase has been rebuilt from the ground up into 15 modular ES modules. Here's what's new:
>
> - **D&D 5e v4/v5 Activities** — Attack, Save, Damage, Heal, Utility, and Cast activities auto-generated on items
> - **Active Effects** — 80+ effect keys mapped from item descriptions (skills, saves, AC, resistances, immunities, senses, and more)
> - **PHB Defaults** — 40+ weapons and 18 armor types with official Player's Handbook stats as authoritative fallbacks
> - **Two-Pass Description Validation** — Regex scan + GPT-informed scan extracts every mechanical bonus into proper effects
> - **Three-Stage Type Safety Net** — Items are always classified correctly, even when the AI gets it wrong
> - **GPT-4.1 & GPT Image 1** — Latest OpenAI models supported out of the box
> - **Castable Spell Embedding** — Items with spells get Cast activities linked to real spell documents
> - **New Item Types** — Container and Background support added
> - **Themed Dialog UI** — Dark-themed generator dialog with polished styling
> - **Foundry v13 Native** — Full native DOM support, zero deprecation warnings
>
> See the [Update Logs](Updates.md) for the full changelog.

> [!IMPORTANT]
>
> ### Requirements
>
> - **System:** D&D 5e only (`dnd5e` v3.3.1 – v5.1.x)
> - **Foundry VTT:** v12.331 – v13.351
> - **API Key:** An [OpenAI API key](https://platform.openai.com/api-keys) is required for item generation and image creation.

<br>

---

<br>

## 🚀 Features

### AI-Powered Item Creation
- **One-Click Generation:** Describe what you want — the module creates a fully populated item sheet with name, description, stats, image, and all dnd5e data fields.
- **All Item Types:** Weapons, armor, shields, spells, feats, consumables (potions, scrolls, ammunition), tools, loot, containers, and backgrounds.
- 🆕 **Smart Type Detection:** A three-stage safety net ensures items are always classified correctly, even when the AI gets it wrong.

### 🆕 D&D 5e v4/v5 Native Support
- 🆕 **Activities System:** Automatically creates Attack, Save, Damage, Heal, Utility, and Cast activities with correct formulas, save DCs, and damage parts.
- 🆕 **Active Effects:** Parses item descriptions and maps bonuses to 80+ effect keys — skills, saves, AC, movement, resistances, immunities, senses, and more.
- 🆕 **PHB Defaults:** Built-in lookup tables for 40+ weapons and 18 armor types ensure stats match the Player's Handbook exactly (damage dice, properties, AC, weight, cost, mastery).
- 🆕 **Two-Pass Description Validation:** First a regex scan, then a GPT-informed scan extracts every mechanical bonus from descriptions and converts them into proper Active Effects — with de-duplication and armor AC double-count protection.
- 🆕 **Castable Spell Embedding:** Items with spell-casting abilities get Cast activities linked to real spell documents from your world or compendiums.

### Image Generation
- 🆕 **GPT Image 1:** Default image model — generates high-quality item artwork with automatic local storage (PNG, WebP, or JPEG).
- **DALL-E 3 / DALL-E 2:** Legacy support available but deprecated — will stop working after May 12, 2026.
- **Stable Diffusion:** Optional local image generation via Stable Diffusion API with polling and timeout handling.
- **Media Optimizer:** Compatible with the Media Optimizer module for image optimization.

### Roll Table Generation
- **Item Tables:** Creates a roll table where every entry is a fully generated item document with its own image, stats, and effects.
- **Generic Tables:** Produces thematic text-only tables (e.g., random encounters, loot descriptions, rumors).
- **Configurable Entry Count:** Choose how many entries to generate per table.

### 🆕 Robust Architecture
- 🆕 **15 Modular ES Modules:** Clean separation of concerns — API, generators, utilities, and UI.
- **Triple-Layer JSON Parsing:** Native parse → GPT auto-repair → regex extraction. Dramatically reduces generation failures.
- 🆕 **Foundry v12 + v13:** Full compatibility with both major Foundry versions — jQuery for v12, native DOM for v13, no deprecation warnings.
- **Customizable Prompts:** All GPT, DALL-E, and Stable Diffusion prompts are exposed in module settings.

<br>

---

<br>

## 📦 Installation

1. Open **Foundry VTT** and go to the **Add-on Modules** tab.
2. Click **Install Module**.
3. Paste the following **Manifest URL**:
   ```text
   https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/releases/latest/download/module.json
   ```
4. Click **Install**.
5. Enable the module in your world via **Game Settings > Manage Modules**.
6. Configure your **OpenAI API Key** in **Game Settings > Configure Settings > ChatGPT Item Generator**.

<br>

---

<br>

## 📖 How to Use

### 1. Open the Generator
Navigate to the **Items** tab in the sidebar. Click the **"Generate AI (Item or RollTable)"** button in the directory footer (GM only).

### 2. Choose What to Generate
- **Item** — Generate a single item with full stats, effects, and image.
- **Roll Table** — Generate a table of multiple items or generic entries.

### 3. Configure Options
- **Type Selection:** Auto-detect (let the AI decide) or explicitly choose: Weapon, Armor, Equipment, Consumable, Tool, Loot, Spell, Feat, Container, or Background.
- **Name Override:** Optionally provide a specific name, or leave blank for AI naming.
- **Entry Count:** For roll tables, set how many entries to generate.

### 4. Describe Your Item
Enter a prompt like:
- *"A cursed greatsword that drains the wielder's health on each hit"*
- *"+2 mithral half plate with fire resistance"*
- *"A 3rd-level necromancy spell that raises undead servants"*
- *"Random magical dungeon loot — mix of weapons, armor, and potions"*

### 5. Generate
Click **Generate** and wait for the progress bar to complete. The item appears in your Items directory ready to drag onto character sheets.

<br>

---

<br>

## 🛠 Supported Item Types

| Type | What Gets Generated |
|------|-------------------|
| **Weapon** | Damage dice, properties (versatile, finesse, etc.), attack + damage activities, magical bonus, PHB base stats, 2024 mastery |
| **Armor / Shield** | AC calculation, armor type, dex cap, strength requirement, stealth disadvantage, PHB defaults |
| **Equipment** | Clothing, trinkets, rings, amulets, cloaks — with passive effects, charges, and castable spells |
| **Spell** | Level, school, components, range, duration, casting time, save/attack activities, scaling |
| **Feat** | Feat type, prerequisites, passive effects, granted activities |
| **Consumable** | Potion/scroll/ammo/food subtypes, uses, charges, healing or buff effects |
| **Tool** | Tool type, proficiency, ability check bonuses |
| **Loot** | Gems, art objects, trade goods — with passive effects and charges |
| **Container** | Bags, chests, and other storage items |
| **Background** | Character backgrounds with features and proficiencies |

<br>

---

<br>

## ⚙️ Settings

All settings are found in **Game Settings > Configure Settings > ChatGPT Item Generator**.

| Setting | Description |
|---------|-------------|
| **OpenAI API Key** | Your OpenAI API key for text generation (required) |
| **DALL-E API Key** | Your OpenAI API key for image generation (can be the same key) |
| **Primary Model** | GPT model for item/table JSON generation (default: `gpt-4.1`) — also supports 4.1 Mini, 4.1 Nano, 4o, 4o Mini, GPT-4 |
| **Light Model** | Faster model for names, JSON fixes, and property extraction (default: `gpt-4.1-mini`) |
| **Image Model** | `gpt-image-1` (recommended), `dall-e-3`, or `dall-e-2` (DALL-E deprecated May 2026) |
| **Image Format** | PNG (lossless), WebP (smaller), or JPEG (smallest) |
| **Stable Diffusion** | Toggle, API key, endpoint, prompt, negative prompt, steps, CFG scale, sampler |
| **Custom Prompts** | Editable prompts for item JSON, item names, roll tables, image generation, and Stable Diffusion |

<br>

---

<br>

## 🔧 Troubleshooting

- **"API Key is not set"** — Add your OpenAI API key in module settings.
- **Image not saving** — Ensure `data/chatgpt-item-generator/` folder exists and has write permissions. The module creates it automatically, but server permissions may block this.
- **Wrong item type** — Try using explicit type selection instead of auto-detect for tricky items.
- **JSON parse errors** — The triple-layer parser handles most issues automatically. If it persists, try simplifying your prompt.
- **Stable Diffusion not connecting** — Add to your `webui-user.bat`: `set COMMANDLINE_ARGS=--cors-allow-origins="*" --api`

<br>

---

<br>

## 🗺 Roadmap

- Safety net coverage for roll table items
- Enhanced UI with live item preview
- Community contributions welcome — feedback and ideas are appreciated

<br>

---

<br>

<div align="center">

### Support

For issues or feature requests, please visit the [GitHub Issues](https://github.com/f3rr311/ChatGPT-Item-Gen-for-Foundry-VTT/issues) page.

**Author:** [Byte_Smarter](https://github.com/f3rr311) · **Discord:** Byte_smarter

This project is licensed under the [MIT License](https://opensource.org/licenses/MIT).

</div>

