class ChatGPTItemGenerator {
    constructor() {
        // Use the settings for ChatGPT & DALL·E keys
        this.apiKey = game.settings.get("chatgpt-item-gen", "openaiApiKey") || "";
        this.dalleApiKey = game.settings.get("chatgpt-item-gen", "dalleApiKey") || "";
    }

    static registerSettings() {
        // No category to avoid "Unmapped" in Foundry 12
        game.settings.register("chatgpt-item-gen", "openaiApiKey", {
            name: "OpenAI API Key",
            hint: "Enter your OpenAI API key to enable AI-generated item descriptions.",
            scope: "world",
            config: true,
            type: String,
            default: ""
        });

        game.settings.register("chatgpt-item-gen", "dalleApiKey", {
            name: "DALL·E API Key",
            hint: "Enter your OpenAI API key for DALL·E to enable AI-generated images.",
            scope: "world",
            config: true,
            type: String,
            default: ""
        });
    }

    // Generate a short, plain-text item name
    async generateItemName(prompt) {
        if (!this.apiKey) {
            ui.notifications.error("OpenAI API Key is not set in the settings.");
            return "Unnamed";
        }

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
                            "You are an expert in fantasy RPGs. Generate a short, thematic name for a D&D 5e item. " +
                            "Provide only plain text, do NOT include JSON."
                    },
                    {
                        role: "user",
                        content: `Generate a unique fantasy item name for: ${prompt}`
                    }
                ],
                max_tokens: 20
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "Unnamed";
    }

    // Generate ephemeral DALL·E image & open in new tab
    async generateItemImage(prompt, itemName) {
        if (!this.dalleApiKey) {
            ui.notifications.error("DALL·E API Key is not set in the settings.");
            return "";
        }

        // Request an image from DALL·E
        const response = await fetch("https://api.openai.com/v1/images/generations", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${this.dalleApiKey}`
            },
            body: JSON.stringify({
                model: "dall-e-3",
                prompt: `Fantasy D&D 5e item: ${prompt}`,
                n: 1,
                size: "1024x1024"
            })
        });

        const data = await response.json();
        const imageUrl = data.data[0]?.url || "";

        // If there's a generated image URL, open it in a new tab
        if (imageUrl) {
            window.open(imageUrl, "_blank");
        }

        // Return ephemeral URL for the item’s img
        return imageUrl;
    }

    // Request a LONG, detailed item JSON, possibly magical, with weaponProperties or armor fields
    async generateItemJSON(prompt) {
        if (!this.apiKey) {
            ui.notifications.error("OpenAI API Key is not set in the settings.");
            return "{}";
        }

        // Instruct GPT to produce structured JSON with potential weaponProperties, armor fields, etc.
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
                            "You are a Foundry VTT assistant creating structured JSON for a DnD 5e item. " +
                            "Do NOT include the item name. Decide if item is magical or not (boolean 'magical'). " +
                            "If the item is a weapon, include an array `weaponProperties` (e.g. \"finesse\", \"heavy\", \"light\" etc.). " +
                            "If it's armor, you may include 'armorType' (light, medium, heavy, shield) and 'ac' (number). " +
                            "Other fields: description (string), rarity (string), weight (number), requiresAttunement (boolean), " +
                            "uses (object), activation (object), damage (object), effects (array), price (number). " +
                            "No item name. Provide a LONG, detailed 'description'. Output valid JSON only."
                    },
                    {
                        role: "user",
                        content: `Generate a D&D 5e item for: ${prompt}`
                    }
                ],
                max_tokens: 900
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "{}";
    }

    parseItemJSON(jsonString) {
        try {
            return JSON.parse(jsonString);
        } catch (err) {
            console.warn("Could not parse item JSON; using fallback text:", err);
            return {};
        }
    }

    // Create the Foundry item, merging name + JSON
    async createFoundryItem() {
        let itemType = prompt("Enter the item type (e.g., weapon, armor, potion, etc.):");
        let itemDesc = prompt("Describe the item you want to generate:");
        let fullPrompt = `${itemType} - ${itemDesc}`;

        // 1) short name
        const itemName = await this.generateItemName(fullPrompt);
        // 2) structured JSON with possible weaponProperties/armor
        const itemJson = await this.generateItemJSON(fullPrompt);
        // 3) ephemeral image
        const itemImage = await this.generateItemImage(fullPrompt, itemName);

        const parsedData = this.parseItemJSON(itemJson);
        let finalDescription = parsedData.description || "No description provided.";

        // Expanded item type mapping for 5e
        const itemTypeMapping = {
            "weapon": "weapon",
            "armor": "equipment",
            "potion": "consumable",
            "wondrous item": "equipment",
            "ring": "equipment",
            "rod": "equipment",
            "staff": "equipment",
            "wand": "equipment",
            "scroll": "consumable",
            "ammunition": "consumable",
            "gear": "equipment",
            "loot": "loot",
            "tool": "tool",
            "container": "backpack",
            "backpack": "backpack",
            "spell": "spell",
            "feat": "feat",
            "class": "class",
            "subclass": "subclass",
            "race": "race",
            "background": "background"
        };
        let foundryItemType = itemTypeMapping[itemType.toLowerCase()] || "equipment";

        // Build Foundry item
        let newItem = {
            name: itemName,
            type: foundryItemType,
            img: itemImage,
            system: {
                description: { value: finalDescription },
                rarity: parsedData.rarity || "common",
                weight: parsedData.weight || 1,
                price: { value: parsedData.price || 100, denomination: "gp" },
                attunement: parsedData.requiresAttunement || false,
                armor: { value: 10 }, // default unless we overwrite below
                properties: [],
                activation: parsedData.activation || { type: "", cost: 0 },
                uses: parsedData.uses || {},
                damage: parsedData.damage || null
            }
        };

        // 1) Magical check
        if (parsedData.magical === true) {
            newItem.system.properties.push("magical");
        } else {
            let raritiesThatImplyMagic = ["rare", "very rare", "legendary", "artifact"];
            if (raritiesThatImplyMagic.includes((parsedData.rarity || "").toLowerCase())) {
                newItem.system.properties.push("magical");
            }
        }

        // 2) Weapon properties
        // If GPT included "weaponProperties" array, push them
        if (parsedData.weaponProperties && Array.isArray(parsedData.weaponProperties)) {
            for (let prop of parsedData.weaponProperties) {
                newItem.system.properties.push(prop.toLowerCase());
            }
        }

        // 3) Armor fields
        // If user typed "armor" or GPT indicated 'armorType', we set system.armor
        if (foundryItemType === "equipment" && itemType.toLowerCase() === "armor") {
            // default to medium armor if not stated
            let armorType = parsedData.armorType || "medium";
            let acValue = parsedData.ac || 14;

            newItem.system.armor = {
                value: acValue,   // e.g. 14
                type: armorType,  // "light", "medium", "heavy", or "shield"
                dex: (armorType === "medium") ? 2 : null
            };
        }

        // Create the item in Foundry
        await Item.create(newItem);
        ui.notifications.info(`New D&D 5e item created: ${itemName} (Ephemeral image)`);
    }
}

// Initialize
Hooks.once("init", () => {
    ChatGPTItemGenerator.registerSettings();
});

// For Foundry v12, we use renderSidebarTab to add button under Items tab
Hooks.once("ready", () => {
    game.chatGPTItemGenerator = new ChatGPTItemGenerator();
    console.log("ChatGPT Item Generator Loaded");

    Hooks.on("renderSidebarTab", (app, html) => {
        if (app.options.id !== "items") return;

        let button = $(`<button class='chatgpt-item-gen'><i class='fas fa-magic'></i> Generate AI D&D 5e Item</button>`);
        button.click(() => game.chatGPTItemGenerator.createFoundryItem());
        html.find(".directory-footer, .directory-header").first().append(button);
    });
});
