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

export declare function isGptModel(model: unknown): model is string;
export declare function patchPwshSchema<T>(tool: T): T;
export declare function patchAssembly<T>(assembly: T): T;
export declare function apply(ctx: Context): void;
