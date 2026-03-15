/**
 * Provider registry — routes chat completion requests to the active provider.
 */

import { openaiProvider } from './providers/openai-provider.js';
import { anthropicProvider } from './providers/anthropic-provider.js';
import { geminiProvider } from './providers/gemini-provider.js';
import { xaiProvider } from './providers/xai-provider.js';
import { ollamaProvider } from './providers/ollama-provider.js';
import { customProvider } from './providers/custom-provider.js';

// ─── Provider Map ───

const PROVIDERS = {
  openai: openaiProvider,
  anthropic: anthropicProvider,
  gemini: geminiProvider,
  xai: xaiProvider,
  ollama: ollamaProvider,
  custom: customProvider
};

/**
 * Get a provider by ID. Falls back to OpenAI if not found.
 * @param {string} id — provider key (e.g. "openai", "anthropic")
 * @returns {object} provider object
 */
export function getProvider(id) {
  return PROVIDERS[id] || PROVIDERS.openai;
}

/**
 * Get all registered providers.
 * @returns {Object<string, object>} map of provider ID → provider object
 */
export function getAllProviders() {
  return { ...PROVIDERS };
}

/**
 * Register a new provider. Called by provider modules to self-register.
 * @param {object} provider — provider object with `id` property
 */
export function registerProvider(provider) {
  if (provider?.id) {
    PROVIDERS[provider.id] = provider;
  }
}

// ─── Routing ───

/**
 * Resolve the API key for a given provider from the config object.
 * @param {GeneratorConfig} config
 * @param {string} providerId
 * @returns {string}
 */
function resolveApiKey(config, providerId) {
  switch (providerId) {
    case "openai":    return config.apiKey || "";
    case "anthropic": return config.anthropicApiKey || "";
    case "gemini":    return config.geminiApiKey || "";
    case "xai":       return config.xaiApiKey || "";
    case "ollama":    return "";
    case "custom":    return config.customApiKey || "";
    default:          return config.apiKey || "";
  }
}

/**
 * Resolve the endpoint for a given provider from the config object.
 * @param {GeneratorConfig} config
 * @param {object} provider
 * @returns {string}
 */
function resolveEndpoint(config, provider) {
  if (provider.id === "custom") return config.customEndpoint || "";
  if (provider.id === "ollama") return (config.ollamaEndpoint || "http://localhost:11434") + "/v1/chat/completions";

  return provider.defaultEndpoint;
}

/**
 * Send a chat completion through the active provider.
 * This is the main routing function — openai.js delegates here.
 *
 * @param {GeneratorConfig} config — full module config (includes textProvider, API keys, etc.)
 * @param {string} model — model name
 * @param {string} systemPrompt — system-level instructions
 * @param {string} userPrompt — user-level prompt text
 * @param {number} maxTokens — max tokens to generate
 * @param {boolean} [useJsonMode=false] — request JSON response format
 * @returns {Promise<{text: string|null, usage: object|null}>}
 */
export async function routeChatCompletion(config, model, systemPrompt, userPrompt, maxTokens, useJsonMode = false) {
  const providerId = config.textProvider || "openai";
  const provider = getProvider(providerId);
  const apiKey = resolveApiKey(config, provider.id);

  if (provider.requiresApiKey && !apiKey) {
    return { text: null, usage: null };
  }

  const endpoint = resolveEndpoint(config, provider);

  return provider.chatCompletion({
    apiKey,
    model,
    systemPrompt,
    userPrompt,
    maxTokens,
    useJsonMode,
    endpoint
  });
}
