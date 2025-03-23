class ChatGPTItemGenerator {
    constructor() {
        this.apiKey = game.settings.get("chatgpt-item-gen", "openaiApiKey") || "";
        this.dalleApiKey = game.settings.get("chatgpt-item-gen", "dalleApiKey") || "";
    }

    static registerSettings() {
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

    async generateItem(prompt) {
        if (!this.apiKey) {
            ui.notifications.error("OpenAI API Key is not set in the settings.");
            return;
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
                    { role: "system", content: "You are a Foundry VTT assistant creating structured D&D 5e items. Provide a thematic item name, type, rarity, weight, attunement status, effects, damage (if a weapon), armor class (if armor), consumable effects (if a potion), activation details, special effects, spells (if applicable), and price. Ensure proper JSON formatting for Foundry VTT compatibility. Do NOT repeat the item name inside the description." },
                    { role: "user", content: `Generate a D&D 5e item based on: ${prompt}` }
                ],
                max_tokens: 700
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "Item generation failed.";
    }

    async generateItemName(prompt) {
        if (!this.apiKey) {
            ui.notifications.error("OpenAI API Key is not set in the settings.");
            return;
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
                    { role: "system", content: "You are an expert in fantasy RPGs. Generate a short, thematic name for a D&D 5e item." },
                    { role: "user", content: `Generate a unique fantasy item name for: ${prompt}` }
                ],
                max_tokens: 20
            })
        });

        const data = await response.json();
        return data.choices?.[0]?.message?.content?.trim() || "Mystic Relic";
    }

    async generateItemImage(prompt, itemName) {
        if (!this.dalleApiKey) {
            ui.notifications.error("DALL·E API Key is not set in the settings.");
            return;
        }
        
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
        return data.data[0]?.url || "";
    }

    async createFoundryItem() {
        let itemType = prompt("Enter the item type (e.g., weapon, armor, potion, etc.):");
        let itemDescription = prompt("Describe the item you want to generate:");
        let fullPrompt = `${itemType} - ${itemDescription}`;

        const itemName = await this.generateItemName(fullPrompt);
        const itemData = await this.generateItem(fullPrompt);
        const itemImage = await this.generateItemImage(fullPrompt, itemName);

        // Map item types to Foundry's D&D 5e system
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
            "gear": "equipment"
        };
        let foundryItemType = itemTypeMapping[itemType.toLowerCase()] || "equipment";

        let newItem = {
            name: itemName,
            type: foundryItemType,
            img: itemImage,
            system: {
                description: { value: itemData },
                rarity: "legendary",
                weight: 10,
                price: { value: 5000, denomination: "gp" },
                attunement: true,
                armor: { value: 18 },
                properties: ["magical", "resistance"],
                activation: { type: "action", cost: 1 },
                duration: { value: null, units: "inst" },
                target: { value: null, units: "self" },
                range: { value: null, long: null, units: "" }
            }
        };

        await Item.create(newItem);
        ui.notifications.info(`New D&D 5e item created: ${itemName} with AI-generated image!`);
    }
}

Hooks.once('init', () => {
    ChatGPTItemGenerator.registerSettings();
});

Hooks.once('ready', () => {
    game.chatGPTItemGenerator = new ChatGPTItemGenerator();
    console.log("ChatGPT Item Generator Loaded");

    Hooks.on("renderItemDirectory", (app, html, data) => {
        let button = $("<button class='chatgpt-generate-item'><i class='fas fa-magic'></i> Generate AI D&D 5e Item</button>");
        button.click(() => game.chatGPTItemGenerator.createFoundryItem());
        html.find(".directory-footer, .directory-header").first().append(button);
    });
});
