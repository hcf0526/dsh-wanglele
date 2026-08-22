window.__ModuleLoader__.load({
  id: "@wanglele/dsh-wanglele",
  factory: (require) => {
    const React = require("react");
    const h = React.createElement;

    const NS = "wanglele";

    const zh = {
      nav: "Wanglele",
      title: "Wanglele 自定义配置",
      desc: "属于 Wanglele 的自定义配置",
      customPromptSection: "自定义系统提示词",
      enableCustomPrompt: "启用自定义系统提示词",
      positionLabel: "提示词注入位置",
      positionAppend: "追加",
      positionReplace: "替换",
      promptInputLabel: "系统提示词内容",
      promptInputPlaceholder: "自定义系统提示词",
      charCount: "字符数",
      lineCount: "行数",
      clearBtn: "清空",
      saveBtn: "保存",
      compatSection: "兼容补丁",
      enableGptCompat: "GPT 兼容补丁",
      enableGeminiRecover: "Gemini 3.7 Flash 兼容补丁",
      savedSuccess: "已保存",
    };

    const en = {
      nav: "Wanglele",
      title: "Wanglele Settings",
      desc: "Custom configurations for Wanglele",
      customPromptSection: "Custom System Prompt",
      enableCustomPrompt: "Enable Custom System Prompt",
      positionLabel: "Prompt Injection Position",
      positionAppend: "Append",
      positionReplace: "Replace",
      promptInputLabel: "System Prompt Text",
      promptInputPlaceholder: "Custom system prompt",
      charCount: "Characters",
      lineCount: "Lines",
      clearBtn: "Clear",
      saveBtn: "Save",
      compatSection: "Compatibility Patches",
      enableGptCompat: "GPT Compatibility Patch",
      enableGeminiRecover: "Gemini 3.7 Flash Compatibility Patch",
      savedSuccess: "Saved",
    };

    const css = `
      .wll-root {
        display: flex;
        flex-direction: column;
        gap: 20px;
        width: 100%;
        color: var(--dsw-alias-label-primary, #e2e8f0);
        padding: 4px 0 24px 0;
        box-sizing: border-box;
      }
      .wll-header {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .wll-title-row {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .wll-title {
        font-size: 18px;
        font-weight: 600;
        line-height: 26px;
        color: var(--dsw-alias-label-primary, #f1f5f9);
      }
      .wll-desc {
        font-size: 13px;
        line-height: 20px;
        color: var(--dsw-alias-label-secondary, #94a3b8);
      }
      .wll-card {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 18px;
        border-radius: 14px;
        background: var(--dsw-alias-bg-layer-1, rgba(255, 255, 255, 0.03));
        border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
      }
      .wll-card-header {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .wll-card-title {
        font-size: 15px;
        font-weight: 600;
        color: var(--dsw-alias-label-primary, #f8fafc);
      }
      .wll-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }
      .wll-row-info {
        display: flex;
        flex-direction: column;
        gap: 2px;
        flex: 1;
        min-width: 0;
      }
      .wll-row-label {
        font-size: 14px;
        font-weight: 500;
        color: var(--dsw-alias-label-primary, #f1f5f9);
      }
      .wll-switch {
        position: relative;
        width: 44px;
        height: 24px;
        flex-shrink: 0;
        cursor: pointer;
        outline: none;
      }
      .wll-switch input {
        opacity: 0;
        width: 0;
        height: 0;
        position: absolute;
      }
      .wll-slider {
        position: absolute;
        inset: 0;
        background-color: var(--dsw-alias-bg-control, rgba(255, 255, 255, 0.12));
        transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 24px;
        border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.15));
      }
      .wll-slider:before {
        position: absolute;
        content: "";
        height: 18px;
        width: 18px;
        left: 2px;
        bottom: 2px;
        background-color: #fff;
        transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        border-radius: 50%;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
      }
      .wll-switch input:checked + .wll-slider {
        background-color: var(--dsw-alias-state-business-primary, #3b82f6);
        border-color: var(--dsw-alias-state-business-primary, #3b82f6);
      }
      .wll-switch input:checked + .wll-slider:before {
        transform: translateX(20px);
      }
      .wll-seg-group {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 4px;
      }
      .wll-seg-btn {
        display: inline-flex;
        align-items: center;
        gap: 6px;
        padding: 6px 14px;
        border-radius: 8px;
        font-size: 13px;
        font-family: inherit;
        background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.05));
        border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.1));
        color: var(--dsw-alias-label-secondary, #94a3b8);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .wll-seg-btn:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.08));
        color: var(--dsw-alias-label-primary, #f1f5f9);
      }
      .wll-seg-btn.wll-active {
        background: var(--dsw-alias-state-business-bg, rgba(59, 130, 246, 0.2));
        border-color: var(--dsw-alias-state-business-primary, #3b82f6);
        color: var(--dsw-alias-state-business-primary, #60a5fa);
        font-weight: 500;
      }
      .wll-textarea-wrapper {
        display: flex;
        flex-direction: column;
        gap: 8px;
        width: 100%;
        margin-top: 6px;
      }
      .wll-textarea-toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 8px;
        flex-wrap: wrap;
      }
      .wll-textarea-toolbar-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .wll-btn {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        height: 28px;
        padding: 0 12px;
        border-radius: 7px;
        font-size: 12px;
        font-family: inherit;
        background: var(--dsw-alias-bg-layer-2, rgba(255, 255, 255, 0.06));
        border: 1px solid var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.12));
        color: var(--dsw-alias-label-secondary, #94a3b8);
        cursor: pointer;
        transition: all 0.15s ease;
      }
      .wll-btn:hover {
        background: var(--dsw-alias-interactive-bg-hover, rgba(255, 255, 255, 0.1));
        color: var(--dsw-alias-label-primary, #f1f5f9);
      }
      .wll-btn-primary {
        background: var(--dsw-alias-state-business-primary, #3b82f6);
        border-color: var(--dsw-alias-state-business-primary, #3b82f6);
        color: #fff;
        font-weight: 500;
      }
      .wll-btn-primary:hover {
        background: #2563eb;
        color: #fff;
      }
      .wll-textarea {
        width: 100%;
        box-sizing: border-box;
        border-radius: 10px;
        background: var(--dsw-alias-bg-base, #0f172a);
        border: 1px solid var(--dsw-alias-border-l2, rgba(255, 255, 255, 0.12));
        color: var(--dsw-alias-label-primary, #f8fafc);
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace;
        font-size: 13px;
        line-height: 20px;
        padding: 12px 14px;
        resize: vertical;
        min-height: 180px;
        outline: none;
        transition: border-color 0.15s ease, box-shadow 0.15s ease;
      }
      .wll-textarea:focus {
        border-color: var(--dsw-alias-state-business-primary, #3b82f6);
        box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
      }
      .wll-textarea::placeholder {
        color: var(--dsw-alias-label-tertiary, #475569);
      }
      .wll-textarea-footer {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        gap: 12px;
        font-size: 12px;
        color: var(--dsw-alias-label-tertiary, #64748b);
      }
      .wll-stats {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .wll-divider {
        height: 1px;
        background: var(--dsw-alias-border-l1, rgba(255, 255, 255, 0.08));
        margin: 4px 0;
      }
      .wll-saved-indicator {
        display: inline-flex;
        align-items: center;
        gap: 5px;
        color: var(--dsw-alias-state-success-primary, #10b981);
        font-size: 12px;
      }
    `;

    const STYLE_TAG_ID = "@wanglele/dsh-wanglele/client-css";
    if (typeof document !== "undefined" && !document.querySelector(`style[data-plugin-css="${STYLE_TAG_ID}"]`)) {
      const style = document.createElement("style");
      style.dataset.plugin = "@wanglele/dsh-wanglele";
      style.dataset.pluginCss = STYLE_TAG_ID;
      style.textContent = css;
      document.head.appendChild(style);
    }

    const STORAGE_KEY_HEIGHT = "dsh_wanglele_prompt_height";
    const DEFAULT_TEXTAREA_HEIGHT = 280;

    function getSavedHeight() {
      try {
        const val = localStorage.getItem(STORAGE_KEY_HEIGHT);
        if (val) {
          const num = parseInt(val, 10);
          if (num >= 160 && num <= 1200) return num;
        }
      } catch {}
      return DEFAULT_TEXTAREA_HEIGHT;
    }

    function WangleleSettingsSection({ t, scope }) {
      const snapshot = React.useSyncExternalStore(
        (cb) => (scope?.subscribe ? scope.subscribe(cb) : () => {}),
        () => (scope?.getSnapshot ? scope.getSnapshot() : { value: {} }),
        () => ({ value: {} }),
      );

      const value = snapshot?.value || {};

      const customPromptEnabled = value.customPromptEnabled ?? false;
      const customPrompt = value.customPrompt ?? "";
      const promptPosition = value.promptPosition === "replace" ? "replace" : "append";
      const gptCompatEnabled = value.gptCompatEnabled ?? true;
      const geminiRecoverEnabled = value.geminiRecoverEnabled ?? true;
      const storedHeight = typeof value.textareaHeight === "number" && value.textareaHeight >= 160
        ? value.textareaHeight
        : getSavedHeight();

      const [localPrompt, setLocalPrompt] = React.useState(customPrompt);
      const [height, setHeight] = React.useState(storedHeight);
      const [savedTime, setSavedTime] = React.useState(null);

      const textareaRef = React.useRef(null);

      // Keep local state in sync when remote snapshot updates
      React.useEffect(() => {
        setLocalPrompt(customPrompt);
      }, [customPrompt]);

      const updateSetting = React.useCallback((field, val) => {
        if (!scope?.set) return;
        scope.set(field, val);
        setSavedTime(Date.now());
      }, [scope]);

      const handleSavePrompt = () => {
        updateSetting("customPrompt", localPrompt);
      };

      const handlePromptChange = (e) => {
        setLocalPrompt(e.target.value);
      };

      const handleHeightCommit = (newHeight) => {
        if (newHeight >= 160 && newHeight <= 1200) {
          setHeight(newHeight);
          try {
            localStorage.setItem(STORAGE_KEY_HEIGHT, String(newHeight));
          } catch {}
          updateSetting("textareaHeight", newHeight);
        }
      };

      const handleMouseUp = () => {
        if (textareaRef.current) {
          const currentH = textareaRef.current.offsetHeight;
          if (currentH && currentH !== height) {
            handleHeightCommit(currentH);
          }
        }
      };

      const stats = React.useMemo(() => {
        const text = localPrompt || "";
        const chars = text.length;
        const lines = text.length === 0 ? 0 : text.split("\n").length;
        return { chars, lines };
      }, [localPrompt]);

      return h(
        "div",
        { className: "wll-root" },

        // Header Section
        h(
          "div",
          { className: "wll-header" },
          h(
            "div",
            { className: "wll-title-row" },
            h("div", { className: "wll-title" }, t("title")),
            savedTime ? h("span", { className: "wll-saved-indicator" }, `✓ ${t("savedSuccess")}`) : null,
          ),
          h("div", { className: "wll-desc" }, t("desc")),
        ),

        // Card 1: Custom System Prompt
        h(
          "div",
          { className: "wll-card" },
          h(
            "div",
            { className: "wll-card-header" },
            h("div", { className: "wll-card-title" }, t("customPromptSection")),
          ),

          // Enable Toggle
          h(
            "div",
            { className: "wll-row" },
            h(
              "div",
              { className: "wll-row-info" },
              h("div", { className: "wll-row-label" }, t("enableCustomPrompt")),
            ),
            h(
              "label",
              { className: "wll-switch" },
              h("input", {
                type: "checkbox",
                checked: customPromptEnabled,
                onChange: (e) => updateSetting("customPromptEnabled", e.target.checked),
              }),
              h("span", { className: "wll-slider" }),
            ),
          ),

          // Position Selector (visible if enabled)
          customPromptEnabled
            ? h(
                "div",
                { style: { display: "flex", flexDirection: "column", gap: "6px" } },
                h(
                  "div",
                  { className: "wll-row-info" },
                  h("div", { className: "wll-row-label" }, t("positionLabel")),
                ),
                h(
                  "div",
                  { className: "wll-seg-group" },
                  [
                    { id: "append", label: t("positionAppend") },
                    { id: "replace", label: t("positionReplace") },
                  ].map((item) =>
                    h(
                      "button",
                      {
                        key: item.id,
                        type: "button",
                        className: `wll-seg-btn ${promptPosition === item.id ? "wll-active" : ""}`,
                        onClick: () => updateSetting("promptPosition", item.id),
                      },
                      item.label,
                    ),
                  ),
                ),
              )
            : null,

          // Textarea Editor (visible if enabled)
          customPromptEnabled
            ? h(
                "div",
                { className: "wll-textarea-wrapper" },
                h(
                  "div",
                  { className: "wll-textarea-toolbar" },
                  h("div", { className: "wll-row-label", style: { fontSize: "13px" } }, t("promptInputLabel")),
                  h(
                    "div",
                    { className: "wll-textarea-toolbar-actions" },
                    h(
                      "button",
                      {
                        type: "button",
                        className: "wll-btn wll-btn-primary",
                        onClick: handleSavePrompt,
                      },
                      t("saveBtn"),
                    ),
                    h(
                      "button",
                      {
                        type: "button",
                        className: "wll-btn",
                        onClick: () => {
                          setLocalPrompt("");
                          updateSetting("customPrompt", "");
                        },
                      },
                      t("clearBtn"),
                    ),
                  ),
                ),
                h("textarea", {
                  ref: textareaRef,
                  className: "wll-textarea",
                  style: { height: `${height}px` },
                  placeholder: t("promptInputPlaceholder"),
                  value: localPrompt,
                  onChange: handlePromptChange,
                  onMouseUp: handleMouseUp,
                }),
                h(
                  "div",
                  { className: "wll-textarea-footer" },
                  h(
                    "div",
                    { className: "wll-stats" },
                    h("span", null, `${t("charCount")}: ${stats.chars}`),
                    h("span", null, `${t("lineCount")}: ${stats.lines}`),
                  ),
                ),
              )
            : null,
        ),

        // Card 2: Compatibility Patches
        h(
          "div",
          { className: "wll-card" },
          h(
            "div",
            { className: "wll-card-header" },
            h("div", { className: "wll-card-title" }, t("compatSection")),
          ),

          // GPT Tool Schema Patch
          h(
            "div",
            { className: "wll-row" },
            h(
              "div",
              { className: "wll-row-info" },
              h("div", { className: "wll-row-label" }, t("enableGptCompat")),
            ),
            h(
              "label",
              { className: "wll-switch" },
              h("input", {
                type: "checkbox",
                checked: gptCompatEnabled,
                onChange: (e) => updateSetting("gptCompatEnabled", e.target.checked),
              }),
              h("span", { className: "wll-slider" }),
            ),
          ),

          h("div", { className: "wll-divider" }),

          // Gemini Stream Recovery Patch
          h(
            "div",
            { className: "wll-row" },
            h(
              "div",
              { className: "wll-row-info" },
              h("div", { className: "wll-row-label" }, t("enableGeminiRecover")),
            ),
            h(
              "label",
              { className: "wll-switch" },
              h("input", {
                type: "checkbox",
                checked: geminiRecoverEnabled,
                onChange: (e) => updateSetting("geminiRecoverEnabled", e.target.checked),
              }),
              h("span", { className: "wll-slider" }),
            ),
          ),
        ),
      );
    }

    const name = "wanglele";
    const inject = ["slots", "locale", "settingsScope"];

    function apply(ctx) {
      ctx.effect(() => {
        ctx.locale.register(NS, { zh, en });
      }, "wanglele: locale dictionaries");

      const t = ctx.locale.bind(NS);

      // Inject settings.section into DSH official settings dialog
      ctx.slots.inject("settings.section", () => {
        let boundScope = null;
        if (ctx.settingsScope?.bind) {
          boundScope = ctx.settingsScope.bind({ namespace: NS });
        }

        return ctx.slots.register(
          {
            name: "settings.section",
            id: "wanglele",
            order: 35, // Positioned nicely between Models and Plugins
            label: () => t("nav"),
            locale: NS,
            inject: () => ({ t, scope: boundScope }),
          },
          WangleleSettingsSection,
        );
      });
    }

    return {
      name,
      inject,
      apply,
      WangleleSettingsSection,
    };
  },
});
