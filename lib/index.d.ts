import type { Context } from "@deepseek-ai/cordis";

export declare const name = "wanglele";
export declare const inject: string[];

export declare const WANGLELE_SETTINGS_NS = "wanglele";
export declare const CUSTOM_PROMPT_SECTION_NAME = "wanglele:custom-system-prompt";

export interface WangleleSettings {
  customPromptEnabled: boolean;
  customPrompt: string;
  promptPosition: "append" | "prepend" | "replace";
  textareaHeight: number;
  gptCompatEnabled: boolean;
  geminiRecoverEnabled: boolean;
}

export declare const DEFAULT_SETTINGS: Readonly<WangleleSettings>;

export interface ToolSchemaLike {
  name?: unknown;
  parameters?: unknown;
  [key: string]: unknown;
}

export interface PromptSectionLike {
  name: string;
  text: string;
  [key: string]: unknown;
}

export interface PromptAssemblyLike {
  sections?: PromptSectionLike[];
  tools?: unknown;
  variables?: Record<string, string | undefined>;
  [key: string]: unknown;
}

export interface LlmStreamChunkLike {
  type?: unknown;
  [key: string]: unknown;
}

export declare function isGptModel(model: unknown): model is string;
export declare function isGeminiFlashModel(model: unknown): model is string;
export declare function isGeminiToolStreamFailure(reason: unknown): boolean;
export declare function patchGptToolSchema<T>(tool: T): T;
export declare function patchPwshSchema<T>(tool: T): T;
export declare function patchAssembly<T>(assembly: T): T;
export declare function applyCustomPrompt<T extends PromptAssemblyLike>(
  assembly: T,
  settings: Partial<WangleleSettings>,
): T;
export declare function resolveSettings(raw: unknown): WangleleSettings;
export declare function recoverGeminiToolCallStream(
  model: unknown,
  source: AsyncIterable<LlmStreamChunkLike>,
): AsyncGenerator<LlmStreamChunkLike>;
export declare function apply(
  ctx: Context,
  config?: Partial<WangleleSettings>,
): void;
