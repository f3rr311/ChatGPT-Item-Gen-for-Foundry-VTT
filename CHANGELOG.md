# Changelog

## v1.0.8 — Foundry V13 Ready · JSON Hardening · UX Polish
- ✅ **Full Foundry VTT v13 Compatibility**
  - Updated for **Core v13+** (`game.release.generation >= 13`)
  - Correct usage of:
    - `document` instead of `1` for `TableResult.type`
    - `collectionName` instead of `documentCollection`
  - Eliminated all v13 deprecation warnings

- ✅ **Improved JSON Parsing Resilience**
  - Triple-layer fallback in `parseItemJSON()` & `parseTableJSON()`:
    1. Native `JSON.parse`
    2. GPT auto-repair via `fixInvalidJSON()`
    3. Regex extraction via `extractValidJSON()`
  - Dramatically reduces failures in item/table creation

- ✅ **Fixed Name-in-Description Extraction**
  - Robust regex handling:
    - `<b>Item Name:</b>`
    - Extra spacing
    - Missing `<br>`
    - Other HTML variants

- ✅ **Accurate Progress Bar Feedback**
  - Smooth, reliable progress at:
    - 20% — Image
    - 40% — JSON
    - 60% — Parse/Fix
    - 80% — Name Refine
    - 100% — Create

- ✅ **Smarter Weapon Detection**
  - Expanded keyword list:
    `katana, scimitar, rapier, pike, quarterstaff, cutlass, sabre`
  - Detects weapons via name **or** description

- ✅ **Armor & Consumable Fixes**
  - Correct `system.type.value` for consumables (v4+)
  - Proper handling of:
    - `dexCap`
    - `strength`
    - `ac`

- ✅ **Stable Diffusion Polling Fix**
  - Prevents hangs on malformed `task_id`
  - Hard cap of 60 attempts (3 minutes)
  - Clear timeout warnings

- ✅ **UI Improvements: Responsive Dialog**
  - Auto-height resize
  - No clipping on smaller screens or mobile

- ✅ **Roll Table “Generic Mode” Fix**
  - `-- tableType=generic` now fully ignores extra item-name prompts

- ✅ **Refined Default Prompts**
  - **Item Name Prompt:**
    > “You are an expert in fantasy RPGs. Do not include the word 'dragon' unless explicitly requested.”
  - **Roll Table Prompt:**
    > “You are an expert in fantasy RPGs. Generate distinctive, evocative item names for the roll table.”

- ✅ **Code Quality Improvements**
  - Clean section headers
  - Improved comments
  - Removed dead code & debug spam

---

## v1.0.7 — Prompt Customization & Progress Feedback Improvements
- ✅ **Secured prompt settings**
  - Essential JSON formatting & DnD details remain fixed
  - Extra instructions remain user-editable
- ✅ **Separated fixed vs editable prompts for Item JSON**
  - Custom instructions append *before* fixed JSON requirements
- ✅ **Improved Item Name prompt**
  - Default: “You are an expert in fantasy RPGs. Do not include the word 'dragon' unless explicitly requested.”
- ✅ **Roll Table JSON generation updates**
  - Generic roll tables ignore user-added JSON instructions
- ✅ **Enhanced progress bar feedback**
  - More granular updates for major pipeline steps
- ✅ **Bugfix for Item JSON**
  - Ensures script follows JSON prompt settings

---

## v1.0.6 — Enhanced Features & New Integrations
- ✅ **Stable Diffusion Integration**
  - Optional alternative to DALL-E
  - New SD configuration settings for prompts, steps, sampler, etc.
  - Polling for SD completion before fallback to DALL-E
- ✅ **ChatGPT Prompt Customization**
  - Customizable item-name & JSON-generation prompts
- ✅ **Media Optimizer Support**
  - Ensures file-saving compatibility for images

---

## v1.0.5 — Improvements & Fixes
- ✅ **API Key Refresh**
  - Changing the API key now refreshes the session immediately

---

## v1.0.4 — Improvements & Fixes
- ✅ **Nested Type Handling**
- ✅ **Magic Flag Fix**
- ✅ **DALL·E 2 Fallback**

---

## v1.0.3 — Improvements & Fixes
- ✅ Forced name override for roll tables  
- ✅ Better name/description synchronization  
- ✅ Hard JSON enforcement for roll tables  
- ✅ Improved image generation prompts  
- ✅ Expanded weapon keyword mapping  
- ✅ Unified dialog UI w/ dropdowns  
- ✅ Footer button integration  
- ✅ Better local image handling  
- ✅ Improved damage & weapon mapping  

---

## v1.0.2 — Previous Enhancements
- ✅ Advanced item type mapping  
- ✅ Damage & activation support  
- ✅ API key settings  
- ✅ JSON sanitization  

---

## v1.0.1 — Initial Improvements & Fixes
- ✅ Local image saving  
- ✅ Description formatting fix  
- ✅ Sidebar button  

---

## v1.0.0 — Initial Release
- 🎉 First release of the ChatGPT Item Generator  
- ✅ AI-generated D&D 5e items  
- ✅ API integration  
