// Fork: plan mode, always on. Upstream removed it from the clients in 521ac7c218.
import {
  DEFAULT_PROVIDER_INTERACTION_MODE,
  type OrchestrationV2PlanArtifact,
  type PlanId,
  type ProviderInteractionMode,
  type ServerProvider,
} from "@t3tools/contracts";

type InteractionModeProvider = Pick<ServerProvider, "showInteractionModeToggle">;

export function providerOffersPlanMode(
  provider: InteractionModeProvider | null | undefined,
): boolean {
  return provider?.showInteractionModeToggle !== false;
}

export function resolveProviderInteractionMode(
  provider: InteractionModeProvider | null | undefined,
  interactionMode: ProviderInteractionMode | null | undefined,
): ProviderInteractionMode {
  return providerOffersPlanMode(provider)
    ? (interactionMode ?? DEFAULT_PROVIDER_INTERACTION_MODE)
    : DEFAULT_PROVIDER_INTERACTION_MODE;
}

export function planModeUnavailableReason(
  provider: (InteractionModeProvider & Pick<ServerProvider, "displayName">) | null | undefined,
): string | null {
  if (provider == null || providerOffersPlanMode(provider)) return null;
  return `Plan mode isn't available for ${provider.displayName ?? "this provider"}`;
}

export function buildPlanImplementationPrompt(planMarkdown: string): string {
  return `PLEASE IMPLEMENT THIS PLAN:\n${planMarkdown.trim()}`;
}

/** The proposed plan a one-tap Implement may start: the active one, while plan mode is idle. */
export function resolveImplementablePlanId(input: {
  readonly interactionMode: ProviderInteractionMode | null | undefined;
  readonly idle: boolean;
  readonly plans:
    | ReadonlyArray<Pick<OrchestrationV2PlanArtifact, "id" | "kind" | "status">>
    | undefined;
}): PlanId | null {
  if (input.interactionMode !== "plan" || !input.idle) return null;
  return (
    input.plans?.findLast((plan) => plan.kind === "proposed_plan" && plan.status === "active")
      ?.id ?? null
  );
}
