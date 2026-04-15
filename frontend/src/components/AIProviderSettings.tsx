"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Settings, Check, Eye, EyeOff, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { AIProvider, PROVIDER_CONFIGS, validateApiKey, saveAIConfig, loadAIConfig, clearApiKey } from "@/lib/ai-providers";
import { toast } from "sonner";

interface AIProviderSettingsProps {
  currentProvider: AIProvider;
  currentModel?: string;
  onProviderChange: (provider: AIProvider, model?: string, apiKey?: string) => void;
}

export function AIProviderSettings({ currentProvider, currentModel, onProviderChange }: AIProviderSettingsProps) {
  const [open, setOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>(currentProvider);
  const [selectedModel, setSelectedModel] = useState<string | undefined>(currentModel);
  const [apiKey, setApiKey] = useState("");
  const [showApiKey, setShowApiKey] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [availableModels, setAvailableModels] = useState<any[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);

  useEffect(() => {
    if (open) {
      const config = loadAIConfig();
      setSelectedProvider(config.provider);
      setSelectedModel(config.model);
      setApiKey(config.apiKey || "");
      setIsValid(null);
      loadModelsForProvider(config.provider, config.apiKey);
    }
  }, [open]);

  const loadModelsForProvider = async (provider: AIProvider, key?: string) => {
    setIsLoadingModels(true);
    try {
      const { fetchLatestModels } = await import("@/lib/ai-providers");
      const models = await fetchLatestModels(provider, key);
      setAvailableModels(models);
      
      // Set first model as default if no model selected
      if (!selectedModel && models.length > 0) {
        setSelectedModel(models[0].id);
      }
    } catch (error) {
      console.error("Error loading models:", error);
      setAvailableModels(PROVIDER_CONFIGS[provider].defaultModels);
    } finally {
      setIsLoadingModels(false);
    }
  };

  const handleProviderSelect = (provider: AIProvider) => {
    setSelectedProvider(provider);
    setIsValid(null);
    
    // Load saved API key for this provider
    const config = loadAIConfig();
    const savedApiKey = config.provider === provider && config.apiKey ? config.apiKey : "";
    setApiKey(savedApiKey);
    
    // Load models for the new provider
    loadModelsForProvider(provider, savedApiKey);
  };

  const handleValidateAndSave = async () => {
    const providerConfig = PROVIDER_CONFIGS[selectedProvider];

    // WebLLM doesn't need validation
    if (selectedProvider === "webllm") {
      const config = { provider: selectedProvider, model: selectedModel };
      saveAIConfig(config);
      onProviderChange(selectedProvider, selectedModel);
      toast.success("AI provider updated to WebLLM");
      setOpen(false);
      return;
    }

    // Validate API key for other providers
    if (!apiKey.trim()) {
      toast.error("Please enter an API key");
      return;
    }

    setIsValidating(true);
    setIsValid(null);

    try {
      const valid = await validateApiKey(selectedProvider, apiKey);
      setIsValid(valid);

      if (valid) {
        const config = { provider: selectedProvider, model: selectedModel, apiKey };
        saveAIConfig(config);
        onProviderChange(selectedProvider, selectedModel, apiKey);
        toast.success(`Successfully connected to ${providerConfig.name}!`);
        setOpen(false);
      } else {
        toast.error("Invalid API key. Please check and try again.");
      }
    } catch (error) {
      setIsValid(false);
      toast.error("Failed to validate API key");
    } finally {
      setIsValidating(false);
    }
  };

  const handleClearApiKey = () => {
    clearApiKey(selectedProvider);
    setApiKey("");
    setIsValid(null);
    toast.success("API key cleared");
  };

  const providerConfig = PROVIDER_CONFIGS[selectedProvider];
  const modelsToDisplay = availableModels.length > 0 ? availableModels : providerConfig.defaultModels;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="glass border-slate-700/50 hover:border-slate-600/50 hover:bg-slate-700/30 transition-all duration-300"
        >
          <Settings className="w-4 h-4 mr-2 text-slate-400" />
          <span className="text-slate-300">AI Settings</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="glass-strong border-slate-700/50 bg-slate-900/95 max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl text-slate-100 flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-slate-300" />
            AI Provider Settings
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Choose your AI provider and model. WebLLM is free and runs locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Provider Selection */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-300">Select Provider</Label>
            <div className="grid grid-cols-2 gap-3">
              {(Object.keys(PROVIDER_CONFIGS) as AIProvider[]).map((provider) => {
                const config = PROVIDER_CONFIGS[provider];
                const isSelected = selectedProvider === provider;

                return (
                  <button
                    key={provider}
                    onClick={() => handleProviderSelect(provider)}
                    className={`
                      relative p-4 rounded-lg text-left transition-all duration-300 border
                      ${isSelected
                        ? "border-slate-600 bg-slate-800/50"
                        : "border-slate-700/50 glass hover:border-slate-600/50"
                      }
                    `}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{config.icon}</span>
                      {isSelected && (
                        <Check className="w-5 h-5 text-violet-400" />
                      )}
                    </div>
                    <h4 className="font-bold text-white mb-1">{config.name}</h4>
                    <p className="text-xs text-zinc-400 leading-relaxed">{config.description}</p>
                    {!config.requiresApiKey && (
                      <Badge className="mt-2 bg-green-500/20 text-green-400 border-green-500/30">
                        Free & Unlimited
                      </Badge>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Model Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-semibold text-zinc-300">Select Model</Label>
              {isLoadingModels && (
                <div className="flex items-center gap-2 text-xs text-violet-400">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Loading latest models...</span>
                </div>
              )}
              {!isLoadingModels && availableModels.length > 0 && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  {availableModels.length} models available
                </Badge>
              )}
            </div>
            <div className="grid gap-2 max-h-64 overflow-y-auto pr-2">
              {modelsToDisplay.map((model) => {
                const isSelected = selectedModel === model.id;

                return (
                  <button
                    key={model.id}
                    onClick={() => setSelectedModel(model.id)}
                    className={`
                      p-3 rounded-lg text-left transition-all duration-200 border
                      ${isSelected
                        ? "border-violet-500 bg-violet-500/10"
                        : "border-white/10 glass hover:border-white/20"
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-white">{model.name}</p>
                        <p className="text-xs text-zinc-500 mt-0.5">
                          {"size" in model ? `Size: ${model.size}` : ""}
                          {"price" in model ? `Cost: ${model.price}` : ""}
                        </p>
                      </div>
                      {isSelected && (
                        <Check className="w-4 h-4 text-violet-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* API Key Input (for non-WebLLM providers) */}
          {providerConfig.requiresApiKey && (
            <div className="space-y-3">
              <Label className="text-sm font-semibold text-zinc-300">API Key</Label>
              <div className="space-y-2">
                <div className="relative">
                  <Input
                    type={showApiKey ? "text" : "password"}
                    value={apiKey}
                    onChange={(e) => {
                      setApiKey(e.target.value);
                      setIsValid(null);
                    }}
                    placeholder={`Enter your ${providerConfig.name} API key`}
                    className="glass border-white/10 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowApiKey(!showApiKey)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white"
                  >
                    {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>

                {isValid === false && (
                  <div className="flex items-center gap-2 text-red-400 text-sm">
                    <AlertCircle className="w-4 h-4" />
                    <span>Invalid API key</span>
                  </div>
                )}

                {isValid === true && (
                  <div className="flex items-center gap-2 text-green-400 text-sm">
                    <Check className="w-4 h-4" />
                    <span>API key validated successfully</span>
                  </div>
                )}

                <p className="text-xs text-zinc-500">
                  Your API key is stored locally and never sent to our servers.
                  {selectedProvider === "openai" && " Get your key at platform.openai.com"}
                  {selectedProvider === "anthropic" && " Get your key at console.anthropic.com"}
                  {selectedProvider === "openrouter" && " Get your key at openrouter.ai/keys"}
                </p>

                {apiKey && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearApiKey}
                    className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                  >
                    Clear API Key
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleValidateAndSave}
              disabled={isValidating || (providerConfig.requiresApiKey && !apiKey.trim())}
              className="flex-1 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 text-white"
            >
              {isValidating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Validating...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Save & Apply
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              className="glass border-white/10"
            >
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

