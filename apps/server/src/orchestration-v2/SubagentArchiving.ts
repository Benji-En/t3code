import type {
  OrchestrationV2ThreadProjection,
  OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import { backgroundWorkBlocksAutomaticSessionEnd } from "@t3tools/shared/orchestrationV2PendingBackgroundWork";
import * as DateTime from "effect/DateTime";

/** A successful result is disposable only once its owner has consumed it. */
export function canAutoArchiveSubagent(
  child: OrchestrationV2ThreadShell,
  parent: Pick<OrchestrationV2ThreadProjection, "runs" | "subagents">,
  childWork?: {
    readonly runs: ReadonlyArray<Pick<OrchestrationV2ThreadProjection["runs"][number], "status">>;
    readonly providerTurns: ReadonlyArray<
      Pick<OrchestrationV2ThreadProjection["providerTurns"][number], "status">
    >;
    readonly subagents: ReadonlyArray<
      Pick<OrchestrationV2ThreadProjection["subagents"][number], "status">
    >;
  },
): boolean {
  if (
    child.lineage.relationshipToParent !== "subagent" ||
    child.archivedAt !== null ||
    child.deletedAt !== null
  )
    return false;
  if (child.pinnedAt != null || child.autoSettleDisabledAt != null) return false;
  if (child.activityRunStatus != null || child.pendingRuntimeRequest !== null) return false;
  if (backgroundWorkBlocksAutomaticSessionEnd(child.pendingBackgroundTasks ?? [])) return false;
  if (
    childWork?.runs.some((run) =>
      ["queued", "preparing", "starting", "running", "waiting"].includes(run.status),
    )
  )
    return false;
  if (
    childWork?.providerTurns.some((turn) => ["pending", "running", "waiting"].includes(turn.status))
  )
    return false;
  if (childWork?.subagents.some((task) => ["pending", "running", "waiting"].includes(task.status)))
    return false;
  const tasks = parent.subagents.filter((task) => task.childThreadId === child.id);
  if (tasks.length === 0) return false;
  // Native children can have provider turns without an app run of their own.
  if (
    child.status !== "completed" &&
    !(
      child.status === "idle" &&
      child.latestRunId === null &&
      tasks.every((task) => task.origin === "provider_native")
    )
  )
    return false;
  return tasks.every((task) => {
    if (task.status !== "completed" || task.completedAt === null) return false;
    // A follow-up belongs to the child conversation, not to the old completed task.
    if (
      child.latestUserMessageAt != null &&
      DateTime.toEpochMillis(child.latestUserMessageAt) > DateTime.toEpochMillis(task.completedAt)
    )
      return false;
    const ownerRun = parent.runs.find((run) => run.id === task.runId);
    const ownerFinished = ownerRun?.status === "completed";
    if (task.origin === "provider_native") return ownerFinished;
    const delivery = task.completionDelivery?.state;
    return (
      delivery === "acknowledged" ||
      delivery === "disposed" ||
      (delivery === "delivered" && ownerFinished)
    );
  });
}
