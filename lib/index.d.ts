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

export interface RetryFailureLike {
  status?: unknown;
  [key: string]: unknown;
}

export interface RetryInternals {
  wait?: (delayMs: number, signal: AbortSignal) => Promise<boolean>;
}

export declare function isGptModel(model: unknown): model is string;
export declare function isDeepSeekModel(model: unknown): model is string;
export declare function deepSeekRetryDelay(
  model: unknown,
  failure: unknown,
): number | undefined;
export declare function cancellableDelay(
  delayMs: number,
  signal: AbortSignal,
): Promise<boolean>;
export declare function patchGptToolSchema<T>(tool: T): T;
export declare function patchPwshSchema<T>(tool: T): T;
export declare function patchAssembly<T>(assembly: T): T;
export declare function apply(
  ctx: Context,
  config?: Record<string, never>,
  internals?: RetryInternals,
): void;
