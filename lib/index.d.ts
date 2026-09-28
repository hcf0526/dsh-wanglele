import type { Context } from "@deepseek-ai/cordis";

export declare const name: "wanglele";
export declare const inject: string[];
export declare const WANGLELE_SETTINGS_NS: "wanglele";
export declare const CUSTOM_PROMPT_SECTION_NAME: "wanglele:custom-system-prompt";
export declare const AUTO_RETRY_CONTINUE_TEXT: "继续";
export declare const AUTO_RETRY_MIN_DELAY_SECONDS: 1;
export declare const AUTO_RETRY_MAX_DELAY_SECONDS: 600;
export declare const AUTO_RETRY_MIN_FAILURES: 1;
export declare const AUTO_RETRY_MAX_FAILURES: 100;

export interface WangleleSettings {
  autoRetryEnabled: boolean;
  autoRetryDelaySeconds: number;
  autoRetryMaxFailures: number;
  customPromptEnabled: boolean;
  customPrompt: string;
  promptPosition: "append" | "prepend" | "replace";
}

export type AutoRetrySettings = WangleleSettings;

export declare const DEFAULT_SETTINGS: Readonly<AutoRetrySettings>;
export declare const Config: unknown;

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
  onSessionEvent(session: unknown, event: unknown, ctx?: unknown): Promise<void>;
  cancel(session: object): void;
  dispose(): void;
  stateOf(session: object): {
    consecutiveCompleteFailures: number;
    abort: AbortController | null;
    issuedIds: Set<string>;
  };
}

export declare function resolveSettings(raw: unknown): AutoRetrySettings;
export declare function customPromptSectionText(raw: unknown): string;
export declare function applyCustomPrompt<T extends { sections: unknown[] }>(assembly: T, settings: unknown): T;
export declare function snapshotSessionEvents(session: unknown): unknown[];
export declare function turnHasAssistantText(events: unknown, turn: unknown): boolean;
export declare function evaluateAutoRetry(input: AutoRetryEvaluationInput): AutoRetryDecision;
export declare function createContinueUserMessage(pluginName?: string): {
  id: string;
  role: "user";
  content: Array<{ type: "text"; text: typeof AUTO_RETRY_CONTINUE_TEXT }>;
  source: { kind: "user"; plugin: string; form: "auto-retry" };
};
export declare function cancellableDelay(delayMs: number, signal?: AbortSignal): Promise<boolean>;
export declare function createAutoRetryEngine(options?: {
  getSettings?: () => unknown;
  delay?: (delayMs: number, signal: AbortSignal) => Promise<boolean>;
}): AutoRetryEngine;
export declare function apply(ctx: Context, config?: Partial<AutoRetrySettings>): void;
