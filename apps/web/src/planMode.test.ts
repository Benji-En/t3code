import { describe, expect, it } from "vite-plus/test";

import {
  parseStandaloneInteractionModeCommand,
  resolveComposerInteractionMode,
  resolvePlanFollowUpSubmission,
  restorePlanFollowUpComposer,
} from "./planMode";

describe("resolveComposerInteractionMode", () => {
  it.each([
    {
      name: "keeps plan for a provider with the toggle",
      toggle: true,
      enabled: true,
      mode: "plan",
    },
    {
      name: "keeps plan when the provider is silent",
      toggle: undefined,
      enabled: true,
      mode: "plan",
    },
    {
      name: "falls back to build without the toggle",
      toggle: false,
      enabled: false,
      mode: "default",
    },
  ] as const)("$name", ({ toggle, enabled, mode }) => {
    expect(
      resolveComposerInteractionMode({
        provider: toggle === undefined ? {} : { showInteractionModeToggle: toggle },
        interactionMode: "plan",
      }),
    ).toEqual({ enabled, interactionMode: mode });
  });

  it("is off until a provider is known", () => {
    expect(resolveComposerInteractionMode({ provider: null, interactionMode: "plan" })).toEqual({
      enabled: false,
      interactionMode: "default",
    });
  });
});

describe("parseStandaloneInteractionModeCommand", () => {
  it.each([
    ["/plan", "plan"],
    [" /PLAN  ", "plan"],
    ["/default", "default"],
    ["/plan the refactor", null],
    ["please /plan", null],
  ] as const)("%j -> %j", (text, expected) => {
    expect(parseStandaloneInteractionModeCommand(text)).toBe(expected);
  });
});

describe("resolvePlanFollowUpSubmission", () => {
  it.each(["", "Consider this "])(
    "keeps context-bearing feedback in plan mode with prose %j",
    (prose) => {
      const draftText = `${prose}[PR #42](t3-context://v1/review-comment/pr-42)`;
      expect(resolvePlanFollowUpSubmission({ draftText, planMarkdown: "# Plan" })).toEqual({
        text: draftText,
        interactionMode: "plan",
      });
    },
  );
  it("switches to default mode when implementing the ready plan without extra text", () => {
    expect(
      resolvePlanFollowUpSubmission({
        draftText: "   ",
        planMarkdown: "## Ship it\n\n- step 1\n",
      }),
    ).toEqual({
      text: "PLEASE IMPLEMENT THIS PLAN:\n## Ship it\n\n- step 1",
      interactionMode: "default",
    });
  });
});

describe("restorePlanFollowUpComposer", () => {
  // The draft is the failed follow-up's thread; the refs and cursor are whatever thread is on
  // screen.
  it.each([
    {
      name: "puts the follow-up back while its thread is open",
      before: { draft: "", refs: "", cursor: null },
      routeIsCurrent: true,
      after: { draft: "Tighten step 2", refs: "Tighten step 2", cursor: "Tighten step 2" },
    },
    {
      name: "keeps a draft typed while the follow-up was in flight",
      before: { draft: "Next idea", refs: "Next idea", cursor: null },
      routeIsCurrent: true,
      after: { draft: "Next idea", refs: "Next idea", cursor: null },
    },
    {
      name: "leaves another thread's composer alone after navigating away",
      before: { draft: "", refs: "Other thread", cursor: null },
      routeIsCurrent: false,
      after: { draft: "Tighten step 2", refs: "Other thread", cursor: null },
    },
  ])("$name", ({ before, routeIsCurrent, after }) => {
    const composer: { draft: string; refs: string; cursor: string | null } = { ...before };
    restorePlanFollowUpComposer({
      snapshot: {
        prompt: "Tighten step 2",
        environmentContexts: [],
        terminalContexts: [],
        reviewComments: [],
        previewAnnotations: [],
        threadContexts: [],
      },
      draftHasUserContent: composer.draft.trim().length > 0,
      routeIsCurrent,
      writeComposerRefs: (snapshot) => {
        composer.refs = snapshot.prompt;
      },
      writePrompt: (prompt) => {
        composer.draft = prompt;
      },
      writeTerminalContexts: () => undefined,
      writeReviewComments: () => undefined,
      writePreviewAnnotations: () => undefined,
      writeThreadContexts: () => undefined,
      writeEnvironmentContexts: () => undefined,
      resetCursor: ({ prompt }) => {
        composer.cursor = prompt;
      },
    });

    expect(composer).toEqual(after);
  });
});
