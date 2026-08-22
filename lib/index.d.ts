import type { Context } from "@deepseek-ai/cordis";

export declare const name = "gpt-pwsh-compat";
export declare const inject: string[];

export interface ToolSchemaLike {
  name?: unknown;
  parameters?: unknown;
  [key: string]: unknown;
}

export interface PromptAssemblyLike {
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
export declare function recoverGeminiToolCallStream(
  model: unknown,
  source: AsyncIterable<LlmStreamChunkLike>,
): AsyncGenerator<LlmStreamChunkLike>;
export declare function apply(
  ctx: Context,
  config?: Record<string, never>,
): void;
