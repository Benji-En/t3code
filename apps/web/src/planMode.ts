// Fork: plan mode, always on. Upstream removed it from the clients in 521ac7c218.
import type { ThreadStructure } from "@t3tools/client-runtime/state/shell";
import type {
  EnvironmentContextRecord,
  OrchestrationV2PlanArtifact,
  PlanId,
  PreviewAnnotationPayload,
  ProviderInteractionMode,
  RunId,
  ScopedThreadRef,
  ServerProvider,
  ThreadContextRecord,
} from "@t3tools/contracts";
import { proposedPlanTitle } from "@t3tools/shared/proposedPlanText";
import * as DateTime from "effect/DateTime";

import { collapseExpandedComposerCursor } from "./composer-logic";
import type { TerminalContextDraft } from "./lib/terminalContext";
import { PLAN_IMPLEMENTATION_PROMPT_PREFIX } from "./proposedPlan";
import type { ReviewCommentContext } from "./reviewCommentContext";
import { appAtomRegistry } from "./rpc/atomRegistry";
import { environmentThreadShells } from "./state/threads";
import { waitForAtomValue } from "./state/waitForAtomValue";
import type { Thread } from "./types";

type PlanModeProvider = Pick<ServerProvider, "showInteractionModeToggle">;

export function resolveComposerInteractionMode(input: {
  provider: PlanModeProvider | null | undefined;
  interactionMode: ProviderInteractionMode;
}): { enabled: boolean; interactionMode: ProviderInteractionMode } {
  const enabled = input.provider != null && input.provider.showInteractionModeToggle !== false;
  return {
    enabled,
    interactionMode: enabled ? input.interactionMode : "default",
  };
}

export function planModeUnavailableReason(
  provider: (PlanModeProvider & Pick<ServerProvider, "displayName">) | null | undefined,
): string | null {
  if (provider == null || provider.showInteractionModeToggle !== false) return null;
  return `Plan mode isn't available for ${provider.displayName ?? "this provider"}`;
}

/** While plan mode is available, T3's `/plan` replaces the provider's own, like `/clear`. */
export function hidesProviderPlanCommand(commandName: string, planModeEnabled: boolean): boolean {
  return planModeEnabled && commandName === "plan";
}

/** `/plan` or `/default` sent on its own switches the mode instead of reaching the provider. */
export function parseStandaloneInteractionModeCommand(
  text: string,
): ProviderInteractionMode | null {
  const match = /^\/(plan|default)\s*$/i.exec(text.trim());
  if (!match) return null;
  return match[1]?.toLowerCase() === "plan" ? "plan" : "default";
}

export function shouldShowPlanFollowUpPrompt(input: {
  pendingUserInputCount: number;
  interactionMode: ProviderInteractionMode;
  latestTurnSettled: boolean;
  hasActionableProposedPlan: boolean;
  hasComposerAttachments: boolean;
}): boolean {
  return (
    input.pendingUserInputCount === 0 &&
    input.interactionMode === "plan" &&
    input.latestTurnSettled &&
    input.hasActionableProposedPlan &&
    !input.hasComposerAttachments
  );
}

export interface LatestProposedPlanState {
  readonly id: PlanId;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly runId: RunId | null;
  readonly planMarkdown: string;
  readonly status: OrchestrationV2PlanArtifact["status"];
}

function planItemTime(
  projection: ThreadStructure,
  plan: Pick<OrchestrationV2PlanArtifact, "id" | "runId">,
): string {
  const item = projection.turnItems.findLast(
    (candidate) =>
      (candidate.type === "proposed_plan" || candidate.type === "todo_list") &&
      candidate.planId === plan.id,
  );
  if (item?.type === "proposed_plan" || item?.type === "todo_list") {
    return DateTime.formatIso(item.updatedAt);
  }
  // Without a plan item, the plan's run dates it; the thread's own timestamps move while a reply streams.
  const run = projection.runs.find((candidate) => candidate.id === plan.runId);
  return DateTime.formatIso(
    run?.completedAt ?? run?.startedAt ?? run?.requestedAt ?? projection.thread.createdAt,
  );
}

export function findLatestProposedPlan(
  projection: ThreadStructure | null,
  latestRunId: RunId | string | null | undefined,
): LatestProposedPlanState | null {
  if (projection === null) return null;
  const plans = projection.plans.filter((plan) => plan.kind === "proposed_plan");
  const candidates = latestRunId ? plans.filter((plan) => plan.runId === latestRunId) : plans;
  const plan = [...(candidates.length > 0 ? candidates : plans)]
    .toSorted(
      (left, right) =>
        planItemTime(projection, left).localeCompare(planItemTime(projection, right)) ||
        left.id.localeCompare(right.id),
    )
    .at(-1);
  if (plan === undefined) return null;
  const updatedAt = planItemTime(projection, plan);
  return {
    id: plan.id,
    createdAt: updatedAt,
    updatedAt,
    runId: plan.runId,
    planMarkdown: plan.markdown,
    status: plan.status,
  };
}

export function hasActionableProposedPlan(plan: LatestProposedPlanState | null): boolean {
  return plan?.status === "active";
}

export function buildPlanImplementationPrompt(planMarkdown: string): string {
  return `${PLAN_IMPLEMENTATION_PROMPT_PREFIX}${planMarkdown.trim()}`;
}

export function resolvePlanFollowUpSubmission(input: { draftText: string; planMarkdown: string }): {
  text: string;
  interactionMode: "default" | "plan";
} {
  const trimmedDraftText = input.draftText.trim();
  if (trimmedDraftText.length > 0) {
    return { text: trimmedDraftText, interactionMode: "plan" };
  }
  return { text: buildPlanImplementationPrompt(input.planMarkdown), interactionMode: "default" };
}

export function buildPlanImplementationThreadTitle(planMarkdown: string): string {
  const title = proposedPlanTitle(planMarkdown);
  return title ? `Implement ${title}` : "Implement plan";
}

function threadHasStarted(
  thread: Pick<Thread, "latestRun" | "itemCount" | "runtime"> | null | undefined,
): boolean {
  return Boolean(thread && (thread.latestRun !== null || thread.itemCount > 0 || thread.runtime));
}

export async function waitForStartedServerThread(
  threadRef: ScopedThreadRef,
  timeoutMs = 1_000,
): Promise<boolean> {
  return waitForAtomValue({
    registry: appAtomRegistry,
    atom: environmentThreadShells.threadShellAtom(threadRef),
    predicate: threadHasStarted,
    timeoutMs,
  });
}

export interface PlanFollowUpComposerSnapshot {
  readonly prompt: string;
  readonly terminalContexts: ReadonlyArray<TerminalContextDraft>;
  readonly reviewComments: ReadonlyArray<ReviewCommentContext>;
  readonly previewAnnotations: ReadonlyArray<PreviewAnnotationPayload>;
  readonly threadContexts: ReadonlyArray<ThreadContextRecord>;
  readonly environmentContexts: ReadonlyArray<EnvironmentContextRecord>;
}

// A draft typed while the send was in flight is newer and stays. Composer refs and the cursor
// belong to the thread on screen, so they follow only while the follow-up's route is current.
export function restorePlanFollowUpComposer(input: {
  readonly snapshot: PlanFollowUpComposerSnapshot;
  readonly draftHasUserContent: boolean;
  readonly routeIsCurrent: boolean;
  readonly writeComposerRefs: (snapshot: PlanFollowUpComposerSnapshot) => void;
  readonly writePrompt: (prompt: string) => void;
  readonly writeTerminalContexts: (contexts: ReadonlyArray<TerminalContextDraft>) => void;
  readonly writeReviewComments: (comments: ReadonlyArray<ReviewCommentContext>) => void;
  readonly writePreviewAnnotations: (annotations: ReadonlyArray<PreviewAnnotationPayload>) => void;
  readonly writeThreadContexts: (records: ReadonlyArray<ThreadContextRecord>) => void;
  readonly writeEnvironmentContexts: (records: ReadonlyArray<EnvironmentContextRecord>) => void;
  readonly resetCursor: (options: {
    cursor: number;
    prompt: string;
    detectTrigger: boolean;
  }) => void;
}): void {
  if (input.draftHasUserContent) return;
  if (input.routeIsCurrent) input.writeComposerRefs(input.snapshot);
  input.writePrompt(input.snapshot.prompt);
  input.writeTerminalContexts(input.snapshot.terminalContexts);
  input.writeReviewComments(input.snapshot.reviewComments);
  input.writePreviewAnnotations(input.snapshot.previewAnnotations);
  input.writeThreadContexts(input.snapshot.threadContexts);
  input.writeEnvironmentContexts(input.snapshot.environmentContexts);
  if (!input.routeIsCurrent) return;
  input.resetCursor({
    cursor: collapseExpandedComposerCursor(input.snapshot.prompt, input.snapshot.prompt.length),
    prompt: input.snapshot.prompt,
    detectTrigger: true,
  });
}
