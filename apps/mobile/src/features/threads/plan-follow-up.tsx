// Fork: a one-tap Implement on the active proposed plan, like the web composer's Implement.
import type {
  SetThreadInteractionModeInput,
  StartThreadTurnInput,
} from "@t3tools/client-runtime/operations";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import {
  MessageId,
  type EnvironmentId,
  type ModelSelection,
  type PlanId,
  type ProviderInteractionMode,
  type RuntimeMode,
  type ThreadId,
} from "@t3tools/contracts";
import { createContext, useContext, useRef, useState } from "react";

import * as Dialog from "../../components/ui/Dialog";
import { uuidv4 } from "../../lib/uuid";
import { buildPlanImplementationPrompt, resolveImplementablePlanId } from "../../state/plan-mode";
import { useSelectedThreadProjection } from "../../state/use-thread-detail";

type Command<Input, E> = (request: {
  readonly environmentId: EnvironmentId;
  readonly input: Input;
}) => Promise<AtomCommandResult<unknown, E>>;

export interface PlanFollowUp {
  readonly implementablePlanId: PlanId | null;
  readonly implementing: boolean;
  readonly implement: (planId: PlanId, planMarkdown: string) => void;
}

export const PlanFollowUpContext = createContext<PlanFollowUp | null>(null);

export function usePlanFollowUp(): PlanFollowUp | null {
  return useContext(PlanFollowUpContext);
}

export function useImplementProposedPlan<E>(input: {
  readonly thread:
    | {
        readonly environmentId: EnvironmentId;
        readonly id: ThreadId;
        readonly interactionMode: ProviderInteractionMode;
        readonly runtimeMode: RuntimeMode;
      }
    | null
    | undefined;
  readonly interactionMode: ProviderInteractionMode | null;
  readonly idle: boolean;
  readonly modelSelection: ModelSelection | null;
  readonly setInteractionMode: Command<SetThreadInteractionModeInput, E>;
  readonly startTurn: Command<StartThreadTurnInput, E>;
  /** Puts the composer back in build mode once the implementation turn started. */
  readonly onImplemented: () => void;
}): PlanFollowUp {
  const inFlight = useRef(false);
  const [implementing, setImplementing] = useState(false);
  const plans = useSelectedThreadProjection()?.projection.plans;
  const implementablePlanId = input.thread
    ? resolveImplementablePlanId({
        interactionMode: input.interactionMode,
        idle: input.idle,
        plans,
      })
    : null;

  const run = async (planId: PlanId, planMarkdown: string) => {
    const thread = input.thread;
    if (!thread) return;
    const createdAt = new Date().toISOString();
    // A turn on an existing thread runs with the thread's saved modes, not the turn's.
    if (thread.interactionMode !== "default") {
      const saved = await input.setInteractionMode({
        environmentId: thread.environmentId,
        input: { threadId: thread.id, interactionMode: "default", createdAt },
      });
      if (saved._tag === "Failure") return saved;
    }
    const started = await input.startTurn({
      environmentId: thread.environmentId,
      input: {
        creationSource: "mobile",
        threadId: thread.id,
        ...(input.modelSelection ? { modelSelection: input.modelSelection } : {}),
        message: {
          messageId: MessageId.make(uuidv4()),
          role: "user",
          text: buildPlanImplementationPrompt(planMarkdown),
          attachments: [],
        },
        runtimeMode: thread.runtimeMode,
        interactionMode: "default",
        sourceProposedPlan: { threadId: thread.id, planId },
        createdAt,
      },
    });
    if (started._tag === "Success") input.onImplemented();
    return started;
  };

  const implement = (planId: PlanId, planMarkdown: string) => {
    if (inFlight.current || planId !== implementablePlanId) return;
    inFlight.current = true;
    setImplementing(true);
    void run(planId, planMarkdown)
      .then((result) => {
        if (result?._tag !== "Failure" || isAtomCommandInterrupted(result)) return;
        const error = squashAtomCommandFailure(result);
        Dialog.alert(
          "Could not implement the plan",
          error instanceof Error ? error.message : "Try again.",
        );
      })
      .finally(() => {
        inFlight.current = false;
        setImplementing(false);
      });
  };

  return { implementablePlanId, implementing, implement };
}
