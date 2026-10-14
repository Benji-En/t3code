import { useMemo } from "react";
import { useParams, useRouter } from "@tanstack/react-router";
import { FileIcon, SquarePenIcon, XIcon } from "lucide-react";
import { replaceComposerContextReferences } from "@t3tools/shared/composerContextReferences";
import {
  DraftId,
  composerDraftHasUserContent,
  useComposerDraftStore,
} from "../../composerDraftStore";
import { resolveThreadRouteTarget } from "../../threadRoutes";
import { useProjects } from "../../state/entities";
import { cn } from "../../lib/utils";
import { discardComposerDraft } from "../../lib/discardComposerDraft";
import { Button } from "../ui/button";

/** Unsent sessions remain reachable even after a new-task request remaps their project. */
export function LegacySidebarDrafts() {
  const sessions = useComposerDraftStore((store) => store.draftThreadsByThreadKey);
  const composers = useComposerDraftStore((store) => store.draftsByThreadKey);
  const projects = useProjects();
  const projectsByKey = useMemo(
    () => new Map(projects.map((project) => [`${project.environmentId}:${project.id}`, project])),
    [projects],
  );
  const router = useRouter();
  const target = useParams({ strict: false, select: resolveThreadRouteTarget });
  const rows = useMemo(
    () =>
      Object.entries(sessions)
        .filter(
          ([key, session]) =>
            session.promotedTo == null && composerDraftHasUserContent(composers[key]),
        )
        .sort((left, right) => right[1].createdAt.localeCompare(left[1].createdAt)),
    [sessions, composers],
  );
  if (rows.length === 0) return null;
  return (
    <div className="mx-1 mb-2 border-b border-sidebar-border pb-2" aria-label="Unsent drafts">
      {rows.map(([draftId, session]) => {
        const composer = composers[draftId]!;
        const project = projectsByKey.get(`${session.environmentId}:${session.projectId}`);
        const attachmentCount =
          Math.max(composer.images.length, composer.persistedAttachments.length) +
          composer.files.length;
        const preview = replaceComposerContextReferences(
          composer.prompt,
          (reference) => reference.label,
        ).trim();
        return (
          <div key={draftId} data-testid="sidebar-draft-row" className="flex items-center">
            <button
              type="button"
              className={cn(
                "flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-xs hover:bg-sidebar-row-active",
                target?.kind === "draft" && target.draftId === draftId && "bg-sidebar-row-active",
              )}
              onClick={() => void router.navigate({ to: "/draft/$draftId", params: { draftId } })}
            >
              <SquarePenIcon className="size-3 shrink-0 text-warning-foreground" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sidebar-muted-foreground">
                  {project?.title ?? "New task"} · Draft
                </span>
                <span className="block truncate">{preview || "Attached files"}</span>
              </span>
              {attachmentCount > 0 && (
                <span className="flex items-center gap-1 text-sidebar-muted-foreground">
                  <FileIcon className="size-3" />
                  {attachmentCount}
                </span>
              )}
            </button>
            <Button
              variant="ghost-muted"
              size="icon-xs"
              aria-label="Discard draft"
              onClick={() => discardComposerDraft(DraftId.make(draftId))}
            >
              <XIcon className="size-3" />
            </Button>
          </div>
        );
      })}
    </div>
  );
}
