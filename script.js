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
    // OpenAI & DALL‑E API Keys
    game.settings.register("chatgpt-item-generator", "openaiApiKey", {
      name: "OpenAI API Key",
      hint: "Enter your OpenAI API key to enable AI-generated item descriptions. (Changing this will reload the module.)",
      scope: "world",
      config: true,
      type: String,
      default: "",
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "dalleApiKey", {
      name: "DALL·E API Key",
      hint: "Enter your OpenAI API key for DALL·E to enable AI-generated images. (Changing this will reload the module.)",
      scope: "world",
      config: true,
      type: String,
      default: "",
      onChange: value => window.location.reload()
    });
    // Stable Diffusion settings
    game.settings.register("chatgpt-item-generator", "stableDiffusionEnabled", {
      name: "Use Stable Diffusion for Image Generation",
      hint: "Toggle to use Stable Diffusion instead of DALL‑E for generating item images.",
      scope: "world",
      config: true,
      type: Boolean,
      default: false,
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "stableDiffusionAPIKey", {
      name: "Stable Diffusion API Key",
      hint: "Enter your Stable Diffusion API key (if required) for generating images.",
      scope: "world",
      config: true,
      type: String,
      default: "",
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "stableDiffusionEndpoint", {
      name: "Stable Diffusion API Endpoint",
      hint: "Enter the endpoint URL for your Stable Diffusion image generation service.",
      scope: "world",
      config: true,
      type: String,
      default: "http://127.0.0.1:7860/sd-queue/txt2img",
      onChange: value => window.location.reload()
    });
    // New Stable Diffusion prompt settings
    game.settings.register("chatgpt-item-generator", "sdMainPrompt", {
      name: "Stable Diffusion Main Prompt",
      hint: "Base prompt for image generation. Use {prompt} as a placeholder for dynamic item details. (Disclaimer: Editing this may affect image quality.)",
      scope: "world",
      config: true,
      type: String,
      default: "Refined, highly detailed, fantasy concept art for a DnD 5e item with these details: {prompt}. Do not include any text in the image.",
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "sdNegativePrompt", {
      name: "Stable Diffusion Negative Prompt",
      hint: "Terms to exclude from the generated image. (Disclaimer: Editing this may affect image quality.)",
      scope: "world",
      config: true,
      type: String,
      default: "rough sketch, blurry, cartoonish, text, watermark, signature, low detail",
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "sdSteps", {
      name: "Stable Diffusion Steps",
      hint: "Number of steps to generate the image. (Disclaimer: Higher values may increase generation time.)",
      scope: "world",
      config: true,
      type: Number,
      default: 70,
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "sdCfgScale", {
      name: "Stable Diffusion CFG Scale",
      hint: "Controls how strongly the model follows the prompt. (Disclaimer: Higher values enforce the prompt more strictly.)",
      scope: "world",
      config: true,
      type: Number,
      default: 9.0,
      onChange: value => window.location.reload()
    });
    game.settings.register("chatgpt-item-generator", "sdSamplerName", {
      name: "Stable Diffusion Sampler Name",
      hint: "Name of the sampler to use. (Disclaimer: Ensure this matches one available on your Stable Diffusion instance.)",
      scope: "world",
      config: true,
      type: String,
      default: "Euler",
      onChange: value => window.location.reload()
    });
    // ChatGPT prompt settings for item JSON extra instructions
    game.settings.register("chatgpt-item-generator", "chatgptJSONPrompt", {
      name: "ChatGPT Item JSON Prompt (Editable Portion)",
      hint: "Enter any additional instructions for generating the item JSON. The essential JSON formatting is fixed and cannot be changed.",
      scope: "world",
      config: true,
      type: String,
      default: "",
      onChange: value => window.location.reload()
    });
    // ChatGPT prompt settings for roll table JSON extra instructions
    game.settings.register("chatgpt-item-generator", "chatgptRollTablePrompt", {
      name: "ChatGPT Item Roll Table JSON Prompt (Editable Portion)",
      hint: "Enter any additional instructions for generating the roll table JSON. The essential JSON formatting is fixed and cannot be changed.",
      scope: "world",
      config: true,
      type: String,
      default: "You are an expert in fantasy RPGs. Generate distinctive, evocative item names for the roll table",
      onChange: value => window.location.reload()
    });
    // ChatGPT prompt settings for JSON mismatch fix extra instructions
    game.settings.register("chatgpt-item-generator", "chatgptFixMismatchPrompt", {
      name: "ChatGPT Fix Mismatch Prompt (Editable Portion)",
      hint: "Enter any additional instructions for fixing the JSON mismatch. The essential JSON formatting is fixed and cannot be changed.",
      scope: "world",
      config: true,
      type: String,
      default: "",
      onChange: value => window.location.reload()
    });
    // ChatGPT prompt settings for item name extra instructions
    game.settings.register("chatgpt-item-generator", "chatgptNamePrompt", {
      name: "ChatGPT Item Name Prompt (Editable Portion)",
      hint: "Enter any additional instructions for generating the item name. The fixed instruction 'Do not output JSON.' is enforced and cannot be changed.",
      scope: "world",
      config: true,
      type: String,
      default: "You are an expert in fantasy RPGs. Do not include the word 'dragon' unless explicitly requested.",
      onChange: value => window.location.reload()
    });
    // DALL‑E prompt setting
    game.settings.register("chatgpt-item-generator", "dallePrompt", {
      name: "DALL‑E Prompt",
      hint: "Prompt for DALL‑E image generation. Use {prompt} as a placeholder for what you entered in the promt dialog. (Disclaimer: Editing this may affect image output.)",
      scope: "world",
      config: true,
      type: String,
      default: "Generate an image for a DnD 5e item with these details: {prompt}. Do not include any text in the image.",
      onChange: value => window.location.reload()
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
   * New Helper: Extract Valid JSON
   * ------------------------------- */
  extractValidJSON(raw) {
    // Match everything from the first { to the last } across multiple lines.
    const match = raw.match(/{[\s\S]*}/);
    if (match) {
      let jsonText = match[0];
      // Remove any trailing commas that may cause parsing issues.
      jsonText = jsonText.replace(/,(?=\s*[}\]])/g, "");
      return jsonText;
    }
    return raw;
  }

  /* --------------------------------
   * 2) Image Generation with Base64 & Local Saving
   * ------------------------------- */
  async generateItemImageSilent(prompt) {
    // Check if Stable Diffusion is enabled
    const useSD = game.settings.get("chatgpt-item-generator", "stableDiffusionEnabled");
    if (useSD) {
      try {
        const sdAPIKey = game.settings.get("chatgpt-item-generator", "stableDiffusionAPIKey");
        const sdEndpoint = game.settings.get("chatgpt-item-generator", "stableDiffusionEndpoint");
        // Build payload using the settings (replace {prompt} placeholder)
        const payload = {
          prompt: `Generate an image for a DnD 5e item with these details: ${prompt}. Do not include any text in the image.`,
          negative_prompt: "",
          styles: [],
          seed: -1,
          subseed: -1,
          subseed_strength: 0,
          seed_resize_from_w: -1,
          seed_resize_from_h: -1,
          sampler_name: "Euler",
          batch_size: 1,
          n_iter: 1,
          steps: 50,
          cfg_scale: 7.0,
          width: 1024,
          height: 1024,
          restore_faces: false,
          tiling: false,
          do_not_save_samples: false,
          do_not_save_grid: false,
          send_images: true,
          save_images: false
        };
        let response = await fetch(sdEndpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(sdAPIKey && { "Authorization": `Bearer ${sdAPIKey}` })
          },
          body: JSON.stringify(payload)
        });
        let data = await response.json();
        // If the API returns an image immediately, use it.
        if (data && data.image) {
          const dataUrl = `data:image/png;base64,${data.image}`;
          const fileName = `${prompt.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.png`;
          const targetFolder = this.imageFolder;
          await this.createFolder(targetFolder);
          await this.checkFolder(targetFolder);
          const localPath = await this.saveImageLocally(dataUrl, fileName, targetFolder);
          return localPath;
        }
        // If no image is returned but a task id is provided, poll until done.
        else if (data && data.task_id) {
          console.log("Stable Diffusion image is being generated. Polling for result...");
          const imageBase64 = await this.pollStableDiffusionStatus(data.task_id);
          if (imageBase64) {
            const dataUrl = `data:image/png;base64,${imageBase64}`;
            const fileName = `${prompt.replace(/\s+/g, "_").toLowerCase()}_${Date.now()}.png`;
            const targetFolder = this.imageFolder;
            await this.createFolder(targetFolder);
            await this.checkFolder(targetFolder);
            const localPath = await this.saveImageLocally(dataUrl, fileName, targetFolder);
            return localPath;
          }
        }
        console.warn("Stable Diffusion did not return an image, falling back to DALL‑E.");
      } catch (err) {
        console.error("Error generating image with Stable Diffusion:", err);
        console.warn("Falling back to DALL‑E.");
      }
    }
    // Fallback to DALL‑E
    if (!this.dalleApiKey) return "";
    const dallePrompt = game.settings.get("chatgpt-item-generator", "dallePrompt");
    // Try DALL‑E 3 first.
    let response = await fetch("https://api.openai.com/v1/images/generations", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.dalleApiKey}`
      },
      body: JSON.stringify({
        model: "dall-e-3",
        prompt: dallePrompt.replace("{prompt}", prompt),
        n: 1,
        size: "1024x1024",
        response_format: "b64_json"
      })
    });
    let data = await response.json();
    // Fallback to DALL‑E 2 if necessary.
    if (data.error || !data.data || !data.data[0]?.b64_json) {
      console.warn("DALL‑E 3 call failed, falling back to DALL‑E 2", data.error);
      response = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${this.dalleApiKey}`
        },
        body: JSON.stringify({
          model: "dall-e-2",
          prompt: dallePrompt.replace("{prompt}", prompt),
          n: 1,
          size: "1024x1024",
          response_format: "b64_json"
        })
      });
      data = await response.json();
    }
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

  // Helper function to poll for the Stable Diffusion result until status is "completed"
  async pollStableDiffusionStatus(taskId) {
    const sdStatusEndpoint = `http://127.0.0.1:7860/sd-queue/${taskId}/status`;
    const maxAttempts = 60;
    let attempt = 0;
    while (attempt < maxAttempts) {
      try {
        let response = await fetch(sdStatusEndpoint);
        let data = await response.json();
        // Wait until the status field indicates the task is completed.
        if (data && data.status && data.status.toLowerCase() === "completed") {
          if (data.image) {
            return data.image;
          } else if (data.images && data.images.length > 0) {
            return data.images[0];
          } else if (data.result && data.result.images && data.result.images.length > 0) {
            return data.result.images[0];
          }
        }
      } catch (err) {
        console.error("Error polling stable diffusion status:", err);
      }
      await new Promise(resolve => setTimeout(resolve, 3000));
      attempt++;
    }
    return null;
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
      return upload.path;
    } catch (err) {
      console.error("Error saving image locally:", err);
      return "";
    }
  }

  /* --------------------------------
   * Helper Methods for Weapon Damage & Properties
   * ------------------------------- */
  transformWeaponDamage(damage) {
    if (!damage) return { parts: [] };

    // If damage is already an array, wrap it in the expected object format.
    if (Array.isArray(damage)) {
      return { parts: damage };
    }

    // If damage.parts exists, ensure it's an array.
    if (damage.parts !== undefined) {
      if (!Array.isArray(damage.parts)) {
        // Wrap non-array parts in an array if necessary.
        damage.parts = [damage.parts];
      }
      return damage;
    }

    // If damage has a dice property, build the parts array from it.
    if (damage.dice) {
      let formula = damage.dice;
      if (damage.modifier) {
        let mod = damage.modifier.toString();
        if (!mod.startsWith('+') && !mod.startsWith('-')) {
          mod = '+' + mod;
        }
        formula += mod;
      }
      let damageType = damage.type || "";
      return { parts: [[formula, damageType]] };
    }

    // Fallback in case none of the expected fields are present.
    return { parts: [] };
  }

  transformWeaponProperties(wp) {
    let properties = [];
    if (!wp) return properties;
    if (Array.isArray(wp)) {
      properties = wp.map(prop => prop.toString().toLowerCase());
    } else if (typeof wp === 'object') {
      for (let key in wp) {
        if (wp.hasOwnProperty(key)) {
          properties.push(`${key}: ${wp[key]}`.toLowerCase());
        }
      }
    } else {
      properties.push(wp.toString().toLowerCase());
    }
    return properties;
  }

  /* --------------------------------
   * 3) Item Generation Functions
   * ------------------------------- */
async generateItemJSON(prompt, explicitType = "") {
  if (!this.apiKey) return "{}";
  const typeNote = explicitType ? ` The item type is ${explicitType}.` : "";

  // Fixed base prompt (unchanged)
  const fixedBasePrompt = "You are a Foundry VTT assistant creating structured JSON for a single, consistent DnD 5e item. Do not include an explicit item name field; instead, output the item description beginning with '<b>Item Name:</b> ' followed by the item name and a '<br>' tag, then the detailed lore. The JSON must include a non-empty 'description' field along with the fields 'rarity', 'weight', 'price', and 'requiresAttunement'. If it's a weapon, include 'weaponProperties', a 'damage' field with the damage dice (e.g., '1d8', '2d6') and any bonus modifiers, and also include a nested 'type' object with keys 'value' (e.g., 'simpleM', 'martialM') and 'baseItem' (e.g., 'longsword'). ";
  
  // Retrieve extra (editable) instructions from settings
  const extraPrompt = game.settings.get("chatgpt-item-generator", "chatgptJSONPrompt");
  // Fixed JSON formatting instruction that must always be appended
  const fixedJSONInstructions = "Output valid JSON with double-quoted property names and no extra text.";
  
  // Combine fixed base prompt, editable extra instructions, and the fixed JSON formatting instructions
  const jsonPrompt = extraPrompt + " " + fixedBasePrompt + " " + fixedJSONInstructions + typeNote;
  
  // Log the combined prompt for testing purposes
  console.log("Generated JSON prompt:", jsonPrompt);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${this.apiKey}`
    },
    body: JSON.stringify({
      model: "gpt-4",
      messages: [
        { role: "system", content: jsonPrompt },
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
    // Fixed part: disallow JSON.
    const fixedNamePrompt = "Do not output JSON and Generate a short item name in plain text";
    // Retrieve the extra instructions from settings.
    const extraNamePrompt = game.settings.get("chatgpt-item-generator", "chatgptNamePrompt");
    // Combine the extra instructions with the fixed instruction.
    const namePrompt = extraNamePrompt + " " + fixedNamePrompt;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: namePrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 20
      })
    });
    let data = await response.json();
    let name = data.choices?.[0]?.message?.content?.trim() || "Unnamed";
    return this.forceKeywordInName(name, prompt, "");
  }

  // Helper: Force keyword from prompt into the generated name if missing.
  forceKeywordInName(name, prompt, desc = "") {
    const promptLC = prompt.toLowerCase();
    const descLC = desc.toLowerCase();
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
   * New Helper: Refine Item Name Based on Description
   * ------------------------------- */
  async refineItemName(currentName, description) {
    // If a name override was provided, skip refinement.
    if (currentName && currentName.trim().length > 0) return currentName;
    const prompt = `The current item name is: "${currentName}".
The item description is: "${description}".
Please provide a refined, improved item name that better reflects the details and flavor of the description. Output only the name in plain text.`;
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are an expert in fantasy item naming." },
          { role: "user", content: prompt }
        ],
        max_tokens: 20
      })
    });
    let data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || currentName;
  }

  /* --------------------------------
   * 4) Consistency Fix: Name vs. JSON
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
    // Fixed non-editable part for mismatch fixing
    const fixedMismatchPrompt = "You are a Foundry VTT assistant. The item name or prompt indicates it is a " + expectedName + ", but the JSON indicates it is a " + foundType + ". Fix the JSON so that the item is consistent as a " + expectedName + ". ";
    // Retrieve extra instructions from settings
    const extraMismatchPrompt = game.settings.get("chatgpt-item-generator", "chatgptFixMismatchPrompt");
    // Combine fixed base, extra instructions, and a fixed ending
    const systemMessage = fixedMismatchPrompt + extraMismatchPrompt + "Output only valid JSON.";
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
   * New Helper: Generate Multiple Magical Property Descriptions
   * ------------------------------- */
  async generateMagicalProperties(itemData, count) {
    const prompt = `Generate ${count} creative, unique, and flavorful magical property descriptions for the following DnD 5e item. Each description should be a concise sentence describing a special ability or effect that fits the item details. Provide each property on its own line.
    
Item Details:
Name: ${itemData.name}
Type: ${itemData.type}
Rarity: ${itemData.system.rarity}
Weight: ${itemData.system.weight}
Price: ${itemData.system.price.value} ${itemData.system.price.denomination}
Description: ${itemData.system.description.value}

Output only the descriptions, one per line, with no numbering or extra commentary.`;
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are an expert DnD magical property generator." },
          { role: "user", content: prompt }
        ],
        max_tokens: 300
      })
    });
    let data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || "";
  }

  /* --------------------------------
   * 5) Create Unique Item Document (for Roll Table Entries)
   * ------------------------------- */
async createUniqueItemDoc(itemPrompt, forcedName = null, explicitType = "") {
  // Show the progress bar at the very beginning
  this.showProgressBar();
  
  // Combine the prompt with any explicit type information
  let combined = itemPrompt + (explicitType ? " - " + explicitType : "");
  
  // Generate the item name (or use the override if provided)
  let generatedName = (forcedName && forcedName.trim().length > 0)
    ? forcedName
    : await this.generateItemName(combined);
  
  const weaponKeywords = ["sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club", "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul", "staff", "katana"];
  
  // Generate the image and update progress to 20%
  let imagePath = await this.generateItemImageSilent(combined);
  this.updateProgressBar(20);
  
  // Generate the item JSON and update progress to 40%
  let rawItemJSON = await this.generateItemJSON(combined, explicitType);
  this.updateProgressBar(40);
  
  // Fix and parse the JSON (and update damage formatting if needed)
  let fixedJSON = await this.fixNameDescriptionMismatch(generatedName, rawItemJSON, combined);
  let parsed = await this.parseItemJSON(fixedJSON);
  if (parsed.damage && (explicitType === "Weapon" || weaponKeywords.some(term => generatedName.toLowerCase().includes(term)))) {
    parsed.damage = this.transformWeaponDamage(parsed.damage);
  }
  this.updateProgressBar(60);
  
  let finalDesc = parsed.description || "No description provided.";
  
  // Refine the item name based on the description if no override was provided
  let refinedName = (forcedName && forcedName.trim().length > 0)
    ? forcedName
    : await this.refineItemName(generatedName, finalDesc);
  // Update progress after name refinement
  this.updateProgressBar(80);
  
  // Determine the Foundry item type using explicit mapping or heuristics
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
      const weaponKeywordsAlt = ["sword", "dagger", "axe", "bow", "mace", "halberd", "flail", "club", "sabre", "blade", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul", "staff", "katana"];
      if (weaponKeywordsAlt.some(term => typeStr.includes(term) || typeStr.includes("weapon"))) {
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
      if (weaponKeywords.some(term => generatedName.toLowerCase().includes(term))) {
        foundryItemType = "weapon";
      }
      if (generatedName.toLowerCase().includes("potion")) {
        foundryItemType = "consumable";
      }
      if (foundryItemType === "equipment" && !generatedName.toLowerCase().includes("potion")) {
        const descWeaponKeywords = ["sword", "cutlass", "sabre", "longsword", "rapier", "dagger", "axe", "bow", "mace", "halberd", "flail", "club", "spear", "pike", "scimitar", "quarterstaff", "lance", "longbow", "shortbow", "sling", "javelin", "handaxe", "warhammer", "maul", "katana"];
        if (descWeaponKeywords.some(term => finalDesc.toLowerCase().includes(term))) {
          foundryItemType = "weapon";
        }
      }
    }
  }
  
  // Handle nested type object if provided in the JSON
  let newItemType;
  if (parsed.type && typeof parsed.type === "object") {
    newItemType = parsed.type;
  } else {
    if (foundryItemType === "weapon") {
      newItemType = { value: "simpleM", baseItem: "" };
    } else {
      newItemType = foundryItemType;
    }
  }
  
  // Build the new item data
  let newItemData = {
    name: refinedName,
    type: foundryItemType,
    img: imagePath || "icons/svg/d20-highlight.svg",
    system: {
      description: { value: finalDesc },
      rarity: parsed.rarity || "common",
      weight: parsed.weight || 1,
      price: { value: parsed.price || 100, denomination: "gp" },
      attunement: parsed.requiresAttunement ? "required" : false,
      armor: { value: 10 },
      properties: [],
      activation: parsed.activation || { type: "", cost: 0 },
      uses: parsed.uses || {},
      damage: foundryItemType === "weapon" ? (parsed.damage ? parsed.damage : { parts: [] }) : (parsed.damage || null),
      type: newItemType  // Nested type inserted here.
    }
  };
  
  if (foundryItemType === "weapon" && parsed.weaponProperties) {
    let wpProps = this.transformWeaponProperties(parsed.weaponProperties);
    for (let wp of wpProps) {
      newItemData.system.properties.push(wp);
    }
  }
  
  // Handle magical properties if applicable
  const isMagic = (
    (parsed.magical !== undefined && String(parsed.magical).toLowerCase() === "true") ||
    (parsed.magic !== undefined && String(parsed.magic).toLowerCase() === "true")
  );
  const magList = ["rare", "very rare", "legendary", "artifact"];
  const rarityLower = (parsed.rarity || "").toLowerCase();
  if (isMagic || (magList.includes(rarityLower) && Math.random() < 0.5)) {
    const count = Math.floor(Math.random() * 3) + 1;
    const magProps = await this.generateMagicalProperties(newItemData, count);
    if (magProps) {
      newItemData.system.description.value += `<br><br><strong>Magical Properties:</strong><br>${magProps.replace(/\n/g, "<br>")}`;
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
  
  // Create the item and update the progress bar to 100%
  let createdItem = await Item.create(newItemData);
  this.updateProgressBar(100);
  this.hideProgressBar();
  ui.notifications.info(`New D&D 5e item created: ${refinedName} (Image: ${imagePath})`);
  return createdItem;
}

  /* --------------------------------
   * 6) Roll Table Generation Functions
   * ------------------------------- */
async generateRollTableJSON(userPrompt) {
  if (!this.apiKey) return "{}";

  // Fixed non-editable part for roll table JSON formatting
  const fixedRollTablePrompt = "You are a Foundry VTT assistant creating strictly valid JSON for a DnD 5e roll table. Do not alter the JSON formatting: output only a valid JSON object with double-quoted property names and no extra commentary or text before or after the JSON object. The JSON must include the following fields: 'name', 'formula', 'description', 'tableType', and 'entries'. For tables of type 'items', each entry must be an object with 'text', 'minRange', 'maxRange', 'weight', and 'documentCollection' set to 'Item'. Ensure that the output contains exactly 20 entries. ";
  
  // By default, start with the fixed prompt.
  let rollTableJSONPrompt = fixedRollTablePrompt;
  
  // If the user prompt does NOT indicate a generic table, append the extra instructions.
  if (!userPrompt.includes("-- tableType=generic")) {
    const extraRollTablePrompt = game.settings.get("chatgpt-item-generator", "chatgptRollTablePrompt");
    rollTableJSONPrompt += extraRollTablePrompt;
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
        { role: "system", content: rollTableJSONPrompt },
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
        console.warn("Second GPT fix also invalid, attempting extraction:", err2);
        let extracted = this.extractValidJSON(rawJSON);
        try {
          return JSON.parse(extracted);
        } catch (err3) {
          console.error("All attempts failed => empty table:", err3);
          return { name: "", formula: "1d20", description: "", tableType: "generic", entries: [] };
        }
      }
    }
  }

  /* --------------------------------
   * 7) Unified Dialog Entry Point
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
          <div class="form-group" id="name-override-group">
            <label>Name Override (Optional):</label>
            <input id="ai-name-override" type="text" style="width: 100%;" placeholder="Leave blank to auto-generate" />
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
            const nameOverride = html.find("#ai-name-override").val();
            if (!desc) return ui.notifications.error("Description is required");

            if (objectType === "rolltable") {
              const tableMode = html.find("#ai-table-type").val();
              await game.chatGPTItemGenerator.createFoundryRollTableFromDialog(`${desc} -- tableType=${tableMode}`, explicitType);
            } else {
              await game.chatGPTItemGenerator.createFoundryItemFromDialog(desc, "", explicitType, nameOverride);
            }
          }
        },
        cancel: { label: "Cancel" }
      },
      default: "generate",
      render: html => {
        html.closest('.dialog').css({'height': 'auto', 'max-height': 'none'});
        const updateVisibility = () => {
          const objectType = html.find("#ai-object-type").val();
          const tableMode = html.find("#ai-table-type").val();
          if (objectType === "rolltable") {
            html.find("#table-type-group").show();
            // Hide name override when roll table is selected.
            html.find("#name-override-group").hide();
          } else {
            html.find("#table-type-group").hide();
            html.find("#name-override-group").show();
          }
          if (objectType === "item" || (objectType === "rolltable" && tableMode === "items")) {
            html.find("#explicit-type-group").show();
          } else {
            html.find("#explicit-type-group").hide();
          }
        };
        updateVisibility();
        html.find("#ai-object-type").on("change", () => updateVisibility());
        html.find("#ai-table-type").on("change", () => updateVisibility());
      }
    }).render(true);
  }

  /* --------------------------------
   * 8) Unified Entry Point (Legacy)
   * ------------------------------- */
  async createFoundryAIObject() {
    await this.openGenerateDialog();
  }

  // Missing method added as a simple wrapper for backward compatibility.
  async createFoundryItemFromDialog(itemType, itemDesc, explicitType, nameOverride = "") {
    // Here we simply call createUniqueItemDoc with itemType as the prompt.
    return this.createUniqueItemDoc(itemType, nameOverride, explicitType);
  }

  // Added missing roll table generation method.
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
