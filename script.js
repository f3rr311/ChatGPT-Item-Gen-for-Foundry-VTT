class ChatGPTItemGenerator {
  constructor() {
    this.apiKey = game.settings.get("chatgpt-item-generator", "openaiApiKey") || "";
    this.dalleApiKey = game.settings.get("chatgpt-item-generator", "dalleApiKey") || "";
    // List of keywords for forced name inclusion (used in auto-generation only)
    this.keywords = ["ring", "amulet", "dagger", "sword", "shield", "gloves", "cloak", "potion"];
    // Save images under data/chatgpt-item-generator
    this.imageFolder = "chatgpt-item-generator";
  }

  static registerSettings() {
    game.settings.register("chatgpt-item-generator", "openaiApiKey", {
      name: "OpenAI API Key",
      hint: "Enter your OpenAI API key to enable AI-generated item descriptions.",
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
    game.settings.register("chatgpt-item-generator", "dalleApiKey", {
      name: "DALL·E API Key",
      hint: "Enter your OpenAI API key for DALL·E to enable AI-generated images.",
      scope: "world",
      config: true,
      type: String,
      default: ""
    });
  }

  /* --------------------------------
   * Progress Bar Helpers (Optional)
   * ------------------------------- */
  showProgressBar() {
    if ($('#ai-progress-container').length === 0) {
      $('body').append(`
        <div id="ai-progress-container" style="position: fixed; top: 20%; left: 50%; transform: translateX(-50%); width: 300px; padding: 10px; background: #222; color: #fff; border: 1px solid #000; border-radius: 5px; z-index: 10000;">
          <h3 style="margin:0 0 10px;">Generating AI Object...</h3>
          <div style="background:#ccc; border-radius:5px; width:100%; height:20px;">
            <div id="ai-progress-bar" style="background:#09f; width:0%; height:100%; border-radius:5px;"></div>
          </div>
          <p id="ai-progress-text" style="text-align:center; margin:5px 0 0;">0%</p>
        </div>
      `);
    }
  }

  updateProgressBar(value) {
    $('#ai-progress-bar').css('width', `${value}%`);
    $('#ai-progress-text').text(`${value}%`);
  }

  hideProgressBar() {
    $('#ai-progress-container').remove();
  }

  /* --------------------------------
   * 1) JSON & Fix Tools
   * ------------------------------- */
  sanitizeJSON(jsonStr) {
    return jsonStr
      .replace(/\\(?!["\\/bfnrtu])/g, "\\\\")
      .replace(/(?<!\\)"/g, '\\"');
  }

  async fixInvalidJSON(badJSON) {
    if (!this.apiKey) return badJSON;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a helpful assistant. The user provided invalid JSON. Remove any disclaimers, partial lines, or text outside of the JSON object. If there is text before or after the JSON braces, remove it. Fix it so it's strictly valid JSON with double-quoted property names. No extra commentary."
          },
          { role: "user", content: badJSON }
        ],
        max_tokens: 900
      })
    });
    let data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || badJSON;
  }

  /* --------------------------------
   * 2) Image Generation with Base64 & Local Saving
   * ------------------------------- */
  async generateItemImageSilent(prompt) {
    if (!this.dalleApiKey) return "";
    const response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.dalleApiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: `Generate an image for a DnD 5e item with these details: ${prompt}. Do not include any text in the image.`,
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      })
    });
    let data = await response.json();
    if (data.data && data.data[0]?.b64_json) {
      const dataUrl = `data:image/png;base64,${data.data[0].b64_json}`;
      const fileName = `${prompt.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.png`;
      const targetFolder = this.imageFolder;
      await this.createFolder(targetFolder);
      await this.checkFolder(targetFolder);
      const localPath = await this.saveImageLocally(dataUrl, fileName, targetFolder);
      return localPath;
    }
    return "";
  }

  async createFolder(folderPath) {
    try {
      await FilePicker.createDirectory("data", folderPath);
      console.log("Attempted folder creation:", folderPath);
    } catch (err) {
      console.warn("Folder creation error (likely already exists):", err);
    }
  }

  async checkFolder(folderPath) {
    try {
      const folderData = await FilePicker.browse("data", folderPath);
      if (!folderData || !folderData.dirs.includes(folderPath)) {
        console.error("Folder does not exist after creation attempt:", folderPath);
      } else {
        console.log("Folder confirmed:", folderPath);
      }
    } catch (err) {
      console.error("Error checking folder existence:", err);
    }
  }

  async saveImageLocally(dataUrl, fileName, targetFolder) {
    const res = await fetch(dataUrl);
    const blob = await res.blob();
    const file = new File([blob], fileName, { type: blob.type });
    try {
      const upload = await FilePicker.upload("data", targetFolder, file, { notify: false });
      console.log("Saved image locally:", upload);
      return `${targetFolder}/${fileName}`;
    } catch (err) {
      console.error("Error saving image locally:", err);
      return "";
    }
  }

  /* --------------------------------
   * 3) Item Generation Functions
   * ------------------------------- */
  async generateItemJSON(prompt, explicitType = "") {
    if (!this.apiKey) return "{}";
    const typeNote = explicitType ? ` The item type is ${explicitType}.` : "";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a Foundry VTT assistant creating structured JSON for a single, consistent DnD 5e item." +
              typeNote +
              " Do not include an explicit item name field; instead, output the item description beginning with '<b>Item Name:</b> ' followed by the item name and a '<br>' tag, then the detailed lore. " +
              "The JSON must include a non-empty 'description' field (which starts with this marker) along with the fields 'rarity', 'weight', 'price', and 'requiresAttunement'. " +
              "If it's a weapon, include 'weaponProperties' and a 'damage' field with the damage dice (e.g., '1d8', '2d6') and any bonus modifiers; " +
              "if it's armor, include 'armorType' and 'ac'. " +
              "Decide if 'magical' is true or false. " +
              "Output valid JSON with double-quoted property names and no extra text."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 700
      })
    });
    let data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "{}";
  }

  async parseItemJSON(raw) {
    console.log("Raw JSON from GPT:", raw);
    try {
      return JSON.parse(raw);
    } catch (err1) {
      console.warn("Could not parse item JSON; second GPT fix:", err1);
      let fixed = await this.fixInvalidJSON(raw);
      try {
        return JSON.parse(fixed);
      } catch (err2) {
        console.warn("Second GPT fix also invalid, sanitizer:", err2);
        let sanitized = this.sanitizeJSON(raw);
        try {
          return JSON.parse(sanitized);
        } catch (err3) {
          console.error("All attempts failed => returning empty item:", err3);
          return {};
        }
      }
    }
  }

  async generateItemName(prompt) {
    if (!this.apiKey) return "Unnamed";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are an expert in fantasy RPGs. Generate a short item name in plain text. Do not include the word 'dragon' unless explicitly requested. No JSON."
          },
          { role: "user", content: prompt }
        ],
        max_tokens: 20
      })
    });
    let data = await response.json();
    let name = data.choices?.[0]?.message?.content?.trim() || "Unnamed";
    return this.forceKeywordInName(name, prompt);
  }

  // Helper: Force keyword from prompt into the generated name if missing.
  forceKeywordInName(name, prompt) {
    const promptLC = prompt.toLowerCase();
    let forcedName = name;
    if (promptLC.includes("class change") && !name.toLowerCase().includes("class change")) {
      console.log("Forcing 'Class Change' into item name.");
      forcedName = forcedName + " Class Change";
    }
    for (let keyword of this.keywords) {
      if (promptLC.includes(keyword) && !name.toLowerCase().includes(keyword)) {
        console.log(`Forcing keyword "${keyword}" into name.`);
        forcedName = `${forcedName} ${keyword.charAt(0).toUpperCase() + keyword.slice(1)}`;
      }
    }
    if (!promptLC.includes("dragon") && forcedName.toLowerCase().includes("dragon")) {
      console.log("Removing 'dragon' from item name as it's not in the prompt.");
      forcedName = forcedName.replace(/dragon/gi, "").replace(/\s+/g, " ").trim();
    }
    return forcedName;
  }

  /* --------------------------------
   * 4) Consistency Fix: Name vs. JSON
   * Now accepts the original prompt for context and extracts the item name from the description if available.
   * ------------------------------- */
  async fixNameDescriptionMismatch(itemName, rawJSON, originalPrompt) {
    let nameLC = itemName.toLowerCase();
    let promptLC = originalPrompt.toLowerCase();
    let parsed;
    try {
      parsed = JSON.parse(rawJSON);
    } catch (e) {
      return rawJSON;
    }
    let desc = parsed.description || "";
    let descLC = desc.toLowerCase();
    const nameRegex = /^<b>\s*Item Name:\s*<\/b>\s*([^<]+)<br\s*\/?>/i;
    const match = desc.match(nameRegex);
    if (match && match[1]) {
      let extractedName = match[1].trim();
      console.log("Extracted name from description:", extractedName);
      parsed.description = desc.replace(nameRegex, "").trim();
      itemName = extractedName;
      nameLC = itemName.toLowerCase();
    }
    if (promptLC.includes("sword")) {
      const unwanted = ["dagger", "helm", "amulet", "staff", "crossbow"];
      for (let term of unwanted) {
        if (nameLC.includes(term)) {
          console.log(`Replacing '${term}' in item name with 'sword'.`);
          itemName = itemName.replace(new RegExp(term, "gi"), "sword");
          nameLC = itemName.toLowerCase();
        }
        if (descLC.includes(term)) {
          console.log(`Replacing '${term}' in item description with 'sword'.`);
          parsed.description = parsed.description.replace(new RegExp(term, "gi"), "sword");
          descLC = parsed.description.toLowerCase();
        }
      }
    }
    return JSON.stringify(parsed);
  }

  async gptFixMismatch(expectedName, foundType, itemName, rawJSON) {
    if (!this.apiKey) return rawJSON;
    let systemMessage =
      "You are a Foundry VTT assistant. The item name or prompt indicates it is a " +
      expectedName +
      ", but the JSON indicates it is a " +
      foundType +
      ". Fix the JSON so that the item is consistent as a " +
      expectedName +
      ". Output only valid JSON.";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: systemMessage },
          { role: "user", content: rawJSON }
        ],
        max_tokens: 900
      })
    });
    let data = await response.json();
    let newJSON = data.choices?.[0]?.message?.content?.trim() || rawJSON;
    return newJSON;
  }

  /* --------------------------------
   * 5) Create Unique Item Document (for Roll Table Entries)
   * Accepts an optional forcedName to override the generated name.
   * Also accepts an explicitType parameter from the drop-down.
   * ------------------------------- */
  async createUniqueItemDoc(itemPrompt, forcedName = null, explicitType = "") {
    let combined = itemPrompt + (explicitType ? " - " + explicitType : "");
    let generatedName = forcedName ? forcedName : await this.generateItemName(combined);
    let imagePath = await this.generateItemImageSilent(combined);
    let rawJson = await this.generateItemJSON(combined, explicitType);
    let fixedJSON = await this.fixNameDescriptionMismatch(generatedName, rawJson, combined);
    let parsed = await this.parseItemJSON(fixedJSON);
    let finalDesc = parsed.description || "No description provided.";
    // Use explicit type mapping.
    let explicitMapping = {
      "Weapon": "weapon",
      "Armor": "equipment",
      "Equipment": "equipment",
      "Consumable": "consumable",
      "Tool": "tool",
      "Loot": "loot",
      "Spell": "spell"
    };
    let foundryItemType = explicitType ? explicitMapping[explicitType] || "equipment" : "equipment";
    if (!explicitType) {
      if (parsed.itemType) {
        let typeStr = parsed.itemType.toLowerCase();
        const weaponKeywords = [
          "sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club",
          "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul", "staff"
        ];
        if (weaponKeywords.some(term => typeStr.includes(term) || typeStr.includes("weapon"))) {
          foundryItemType = "weapon";
        } else {
          const map = {
            "armor": "equipment",
            "potion": "consumable",
            "scroll": "consumable",
            "rod": "equipment",
            "staff": "equipment",
            "wand": "equipment",
            "ammunition": "consumable",
            "gear": "equipment",
            "loot": "loot",
            "tool": "tool"
          };
          foundryItemType = map[typeStr] || "equipment";
        }
      } else {
        const weaponKeywords = [
          "sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club",
          "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul"
        ];
        if (weaponKeywords.some(term => generatedName.toLowerCase().includes(term))) {
          foundryItemType = "weapon";
        }
        if (generatedName.toLowerCase().includes("potion")) {
          foundryItemType = "consumable";
        }
        if (foundryItemType === "equipment" && !generatedName.toLowerCase().includes("potion")) {
          const descWeaponKeywords = [
            "sword", "cutlass", "sabre", "longsword", "rapier", "dagger", "axe", "bow", "mace", "halberd", "flail", "club", "spear", "pike", "scimitar", "quarterstaff", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul"
          ];
          if (descWeaponKeywords.some(term => finalDesc.toLowerCase().includes(term))) {
            foundryItemType = "weapon";
          }
        }
      }
    }
    let newItemData = {
      name: generatedName,
      type: foundryItemType,
      img: imagePath || "icons/svg/d20-highlight.svg",
      system: {
        description: { value: finalDesc },
        rarity: parsed.rarity || "common",
        weight: parsed.weight || 1,
        price: { value: parsed.price || 100, denomination: "gp" },
        attunement: parsed.requiresAttunement || false,
        armor: { value: 10 },
        properties: [],
        activation: parsed.activation || { type: "", cost: 0 },
        uses: parsed.uses || {},
        // Updated damage property for weapons
        damage: foundryItemType === "weapon" ? (parsed.damage ? parsed.damage : { parts: [] }) : (parsed.damage || null)
      }
    };
    if (parsed.magical === true) {
      newItemData.system.properties.push("magical");
    } else {
      let magList = ["rare", "very rare", "legendary", "artifact"];
      if (magList.includes((parsed.rarity || "").toLowerCase())) {
        newItemData.system.properties.push("magical");
      }
    }
    if (foundryItemType === "weapon" && parsed.weaponProperties && Array.isArray(parsed.weaponProperties)) {
      for (let wp of parsed.weaponProperties) {
        newItemData.system.properties.push(wp.toLowerCase());
      }
    }
    if (foundryItemType === "equipment" && parsed.itemType && (parsed.itemType.toLowerCase() === "armor" || parsed.itemType.toLowerCase() === "shield")) {
      let armorType = parsed.armorType || "medium";
      let acValue = parsed.ac || 14;
      newItemData.system.armor = {
        value: acValue,
        type: armorType,
        dex: (armorType === "medium") ? 2 : null
      };
    }
    let created = await Item.create(newItemData);
    return created;
  }

  /* --------------------------------
   * 6) Roll Table Generation Functions
   * ------------------------------- */
  async generateRollTableJSON(userPrompt) {
    if (!this.apiKey) return "{}";
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a Foundry VTT assistant creating strictly valid JSON for a DnD 5e roll table. " +
              "Output valid JSON with double-quoted property names and no extra commentary or text outside the JSON. " +
              "No disclaimers, no line breaks before or after the JSON object. " +
              "The JSON must include the following fields: 'name', 'formula', 'description', 'tableType', and 'entries'. " +
              "For tables of type 'items', each entry must be an object with 'text', 'minRange', 'maxRange', 'weight', and 'documentCollection' set to 'Item'. " +
              "For generic roll tables, include additional details from the prompt (e.g., city, biome, or theme details) to create tailored, descriptive entries. " +
              "Ensure that the output contains exactly 20 entries. " +
              "Output only the JSON object with no extra commentary."
          },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 900
      })
    });
    let data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "{}";
  }

  async parseTableJSON(rawJSON) {
    console.log("Raw Roll Table JSON from GPT:", rawJSON);
    try {
      return JSON.parse(rawJSON);
    } catch (err1) {
      console.warn("Could not parse roll table JSON, second GPT fix:", err1);
      let fixed = await this.fixInvalidJSON(rawJSON);
      try {
        return JSON.parse(fixed);
      } catch (err2) {
        console.warn("Second GPT fix also invalid, sanitizer:", err2);
        let sanitized = this.sanitizeJSON(rawJSON);
        try {
          return JSON.parse(sanitized);
        } catch (err3) {
          console.error("All attempts failed => empty table:", err3);
          return { name: "", formula: "1d20", description: "", tableType: "generic", entries: [] };
        }
      }
    }
  }

  /* --------------------------------
   * 7) Normal Item Flow (Dialog Version)
   * ------------------------------- */
  async createFoundryItemFromDialog(itemType, itemDesc, explicitType) {
    this.showProgressBar();
    this.updateProgressBar(10);
    let combined = `${itemType} - ${itemDesc}` + (explicitType ? " - " + explicitType : "");
    let generatedName = await this.generateItemName(combined);
    this.updateProgressBar(20);
    let imagePath = await this.generateItemImageSilent(combined);
    this.updateProgressBar(40);
    let rawItemJSON = await this.generateItemJSON(combined, explicitType);
    this.updateProgressBar(60);
    let fixedJSON = await this.fixNameDescriptionMismatch(generatedName, rawItemJSON, combined);
    let parsed = await this.parseItemJSON(fixedJSON);
    this.updateProgressBar(80);
    let finalDesc = parsed.description || "No description provided.";
    let foundryItemType = "equipment";
    if (explicitType) {
      const explicitMapping = {
        "Weapon": "weapon",
        "Armor": "equipment",
        "Equipment": "equipment",
        "Consumable": "consumable",
        "Tool": "tool",
        "Loot": "loot",
        "Spell": "spell"
      };
      foundryItemType = explicitMapping[explicitType] || "equipment";
    } else {
      if (parsed.itemType) {
        let typeStr = parsed.itemType.toLowerCase();
        const weaponKeywords = [
          "sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club",
          "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul", "staff"
        ];
        if (weaponKeywords.some(term => typeStr.includes(term) || typeStr.includes("weapon"))) {
          foundryItemType = "weapon";
        } else {
          const map = {
            "armor": "equipment",
            "potion": "consumable",
            "scroll": "consumable",
            "rod": "equipment",
            "staff": "equipment",
            "wand": "equipment",
            "ammunition": "consumable",
            "gear": "equipment",
            "loot": "loot",
            "tool": "tool"
          };
          foundryItemType = map[typeStr] || "equipment";
        }
      } else {
        const weaponKeywords = [
          "sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club",
          "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul"
        ];
        if (weaponKeywords.some(term => generatedName.toLowerCase().includes(term))) {
          foundryItemType = "weapon";
        }
        if (generatedName.toLowerCase().includes("potion")) {
          foundryItemType = "consumable";
        }
        if (foundryItemType === "equipment" && !generatedName.toLowerCase().includes("potion")) {
          const descWeaponKeywords = [
            "sword", "cutlass", "sabre", "longsword", "rapier", "dagger", "axe", "bow", "mace", "halberd", "flail", "club", "spear", "pike", "scimitar", "quarterstaff", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul"
          ];
          if (descWeaponKeywords.some(term => finalDesc.toLowerCase().includes(term))) {
            foundryItemType = "weapon";
          }
        }
      }
    }
    let newItemData = {
      name: generatedName,
      type: foundryItemType,
      img: imagePath || "icons/svg/d20-highlight.svg",
      system: {
        description: { value: finalDesc },
        rarity: parsed.rarity || "common",
        weight: parsed.weight || 1,
        price: { value: parsed.price || 100, denomination: "gp" },
        attunement: parsed.requiresAttunement || false,
        armor: { value: 10 },
        properties: [],
        activation: parsed.activation || { type: "", cost: 0 },
        uses: parsed.uses || {},
        // Updated damage property for weapons
        damage: foundryItemType === "weapon" ? (parsed.damage ? parsed.damage : { parts: [] }) : (parsed.damage || null)
      }
    };
    if (parsed.magical === true) {
      newItemData.system.properties.push("magical");
    } else {
      let magList = ["rare", "very rare", "legendary", "artifact"];
      if (magList.includes((parsed.rarity || "").toLowerCase())) {
        newItemData.system.properties.push("magical");
      }
    }
    if (foundryItemType === "weapon" && parsed.weaponProperties && Array.isArray(parsed.weaponProperties)) {
      for (let wp of parsed.weaponProperties) {
        newItemData.system.properties.push(wp.toLowerCase());
      }
    }
    if (foundryItemType === "equipment" && parsed.itemType && (parsed.itemType.toLowerCase() === "armor" || parsed.itemType.toLowerCase() === "shield")) {
      let armorType = parsed.armorType || "medium";
      let acValue = parsed.ac || 14;
      newItemData.system.armor = {
        value: acValue,
        type: armorType,
        dex: (armorType === "medium") ? 2 : null
      };
    }
    await Item.create(newItemData);
    this.updateProgressBar(100);
    this.hideProgressBar();
    ui.notifications.info(`New D&D 5e item created: ${generatedName} (Image: ${imagePath})`);
  }

  /* --------------------------------
   * 8) Roll Table Flow (Dialog Version)
   * ------------------------------- */
  async createFoundryRollTableFromDialog(tableDesc, explicitType) {
    this.showProgressBar();
    this.updateProgressBar(10);
    let rawTableJSON = await this.generateRollTableJSON(tableDesc);
    this.updateProgressBar(30);
    let parsedTable = await this.parseTableJSON(rawTableJSON);
    this.updateProgressBar(50);
    let newTable = await RollTable.create({
      name: parsedTable.name || tableDesc || "GPT Roll Table",
      formula: parsedTable.formula || "1d20",
      description: parsedTable.description || "",
      replacement: true
    });
    let results = [];
    let tableType = (parsedTable.tableType || "generic").toLowerCase();
    ui.notifications.info(`Building table with ${parsedTable.entries?.length || 0} entries, tableType = ${tableType}.`);
    if (tableType === "items") {
      for (let entry of (parsedTable.entries || [])) {
        let textVal = entry.text || "Mysterious Item";
        // For roll tables, force the entry text as the item name and pass the explicit type.
        let createdItem = await this.createUniqueItemDoc(textVal, textVal, explicitType);
        if (createdItem && createdItem.name) {
          results.push({
            type: 1,
            text: createdItem.name,
            range: [entry.minRange ?? 1, entry.maxRange ?? 1],
            weight: entry.weight ?? 1,
            img: "icons/svg/d20-highlight.svg",
            documentCollection: "Item",
            documentId: createdItem.id,
            drawn: false
          });
        } else {
          results.push({
            type: 0,
            text: `Failed item: ${textVal}`,
            range: [entry.minRange ?? 1, entry.maxRange ?? 1],
            weight: entry.weight ?? 1,
            img: "icons/svg/d20-highlight.svg",
            documentCollection: "Item",
            drawn: false
          });
        }
      }
    } else {
      for (let entry of (parsedTable.entries || [])) {
        results.push({
          type: 0,
          text: entry.text || "No text",
          range: [entry.minRange ?? 1, entry.maxRange ?? 1],
          weight: entry.weight ?? 1,
          img: "icons/svg/d20-highlight.svg",
          documentCollection: "Item",
          drawn: false
        });
      }
    }
    if (!results.length) {
      ui.notifications.warn("GPT returned no entries. Table is empty.");
    }
    await newTable.createEmbeddedDocuments("TableResult", results);
    this.updateProgressBar(100);
    this.hideProgressBar();
    ui.notifications.info(`New Roll Table created: ${newTable.name}`);
  }

  /* --------------------------------
   * 9) Unified Dialog Entry Point
   * ------------------------------- */
  async openGenerateDialog() {
    new Dialog({
      title: "Generate AI Object",
      content: `
        <form>
          <div class="form-group">
            <label>Generate:</label>
            <select id="ai-object-type" style="width: 100%;">
              <option value="item">Item</option>
              <option value="rolltable">Roll Table</option>
            </select>
          </div>
          <div class="form-group" id="explicit-type-group">
            <label>Explicit Item Type:</label>
            <select id="ai-explicit-type" style="width: 100%;">
              <option value="Weapon">Weapon</option>
              <option value="Armor">Armor</option>
              <option value="Equipment">Equipment</option>
              <option value="Consumable">Consumable</option>
              <option value="Tool">Tool</option>
              <option value="Loot">Loot</option>
              <option value="Spell">Spell</option>
            </select>
          </div>
          <div class="form-group" id="table-type-group" style="display: none;">
            <label>Roll Table Mode:</label>
            <select id="ai-table-type" style="width: 100%;">
              <option value="items">Items</option>
              <option value="generic">Generic</option>
            </select>
          </div>
          <div class="form-group">
            <label>Description (or Prompt):</label>
            <input id="ai-description" type="text" style="width: 100%;" />
          </div>
        </form>
      `,
      buttons: {
        generate: {
          label: "Generate",
          callback: async (html) => {
            const objectType = html.find("#ai-object-type").val();
            const desc = html.find("#ai-description").val();
            const explicitType = html.find("#ai-explicit-type").val();
            if (!desc) return ui.notifications.error("Description is required");

            if (objectType === "rolltable") {
              const tableMode = html.find("#ai-table-type").val();
              await this.createFoundryRollTableFromDialog(`${desc} -- tableType=${tableMode}`, explicitType);
            } else {
              await this.createFoundryItemFromDialog(desc, "", explicitType);
            }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "generate",
      render: html => {
        // Auto resize the dialog container so no scrolling is required.
        html.closest('.dialog').css({'height': 'auto', 'max-height': 'none'});

        // Helper function to manage visibility
        const updateVisibility = () => {
          const objectType = html.find("#ai-object-type").val();
          const tableMode = html.find("#ai-table-type").val();

          // Show the Roll Table Mode dropdown if generating a roll table; otherwise hide it.
          if (objectType === "rolltable") {
            html.find("#table-type-group").show();
          } else {
            html.find("#table-type-group").hide();
          }

          // Show the Explicit Item Type if:
          // 1) objectType === "item", OR
          // 2) objectType === "rolltable" AND tableMode === "items"
          if (objectType === "item" || (objectType === "rolltable" && tableMode === "items")) {
            html.find("#explicit-type-group").show();
          } else {
            html.find("#explicit-type-group").hide();
          }
        };

        // Initial check
        updateVisibility();

        // On change of the "Generate" dropdown
        html.find("#ai-object-type").on("change", () => {
          updateVisibility();
        });

        // On change of the "Roll Table Mode" dropdown
        html.find("#ai-table-type").on("change", () => {
          updateVisibility();
        });
      }
    }).render(true);
  }

  /* --------------------------------
   * 10) Unified Entry Point (Legacy)
   * ------------------------------- */
  async createFoundryAIObject() {
    await this.openGenerateDialog();
  }
}

// Initialize settings and module
Hooks.once("init", () => {
  ChatGPTItemGenerator.registerSettings();
});

Hooks.once("ready", () => {
  game.chatGPTItemGenerator = new ChatGPTItemGenerator();
  console.log("ChatGPT Item Generator Loaded");
});

// Add the Generate button to the footer of the Items directory (only show to GMs)
Hooks.on("renderItemDirectory", (app, html, data) => {
  if (game.user.isGM) {
    let button = $(`<button><i class='fas fa-magic'></i> Generate AI (Item or RollTable)</button>`);
    button.click(() => game.chatGPTItemGenerator.createFoundryAIObject());
    html.find(".directory-footer").first().append(button);
  }
});
