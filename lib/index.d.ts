import type { Context } from "@deepseek-ai/cordis";

export declare const name = "wanglele";
export declare const inject: string[];

export declare const WANGLELE_SETTINGS_NS = "wanglele";
export declare const CUSTOM_PROMPT_SECTION_NAME = "wanglele:custom-system-prompt";
export declare const AUTO_RETRY_CONTINUE_TEXT = "继续";
export declare const AUTO_RETRY_MIN_DELAY_SECONDS = 1;
export declare const AUTO_RETRY_MAX_DELAY_SECONDS = 600;
export declare const AUTO_RETRY_MIN_FAILURES = 1;
export declare const AUTO_RETRY_MAX_FAILURES = 100;

export interface WangleleSettings {
  customPromptEnabled: boolean;
  customPrompt: string;
  promptPosition: "append" | "prepend" | "replace";
  textareaHeight: number;
  gptCompatEnabled: boolean;
  geminiRecoverEnabled: boolean;
  autoRetryEnabled: boolean;
  autoRetryDelaySeconds: number;
  autoRetryMaxFailures: number;
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

export type AutoRetryAction = "idle" | "cancel" | "reset" | "retry" | "stop";

export interface AutoRetryDecision {
  action: AutoRetryAction;
  consecutiveCompleteFailures: number;
}

export interface AutoRetryEvaluationInput {
  enabled: boolean;
  reasonKind: unknown;
  hasAssistantText: boolean;
  consecutiveCompleteFailures: number;
  maxFailures: number;
}

export interface AutoRetryEngine {
  onSessionEvent(
    session: unknown,
    event: unknown,
    ctx?: unknown,
  ): Promise<void>;
  cancel(session: object): void;
  dispose(): void;
  stateOf(session: object): {
    consecutiveCompleteFailures: number;
    abort: AbortController | null;
    issuedIds: Set<string>;
  };
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
export declare function snapshotSessionEvents(session: unknown): unknown[];
export declare function turnHasAssistantText(
  events: unknown,
  turn: unknown,
): boolean;
export declare function evaluateAutoRetry(
  input: AutoRetryEvaluationInput,
): AutoRetryDecision;
export declare function createContinueUserMessage(pluginName?: string): {
  id: string;
  role: "user";
  content: Array<{ type: "text"; text: string }>;
  source: { kind: "user"; plugin: string; form: "auto-retry" };
};
export declare function cancellableDelay(
  delayMs: number,
  signal?: AbortSignal,
): Promise<boolean>;
export declare function createAutoRetryEngine(options?: {
  getSettings?: () => unknown;
  delay?: (delayMs: number, signal: AbortSignal) => Promise<boolean>;
}): AutoRetryEngine;
export declare function recoverGeminiToolCallStream(
  model: unknown,
  source: AsyncIterable<LlmStreamChunkLike>,
): AsyncGenerator<LlmStreamChunkLike>;
export declare function apply(
  ctx: Context,
  config?: Partial<WangleleSettings>,
): void;
