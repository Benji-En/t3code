import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { EnvironmentId, ProjectId, ThreadId } from "@t3tools/contracts";
import { scopeProjectRef } from "@t3tools/client-runtime/environment";
import {
  DraftId,
  partializeComposerDraftStoreState,
  useComposerDraftStore,
} from "../../composerDraftStore";
import { LegacySidebarDrafts } from "./LegacySidebarDrafts";

const route = vi.hoisted(() => ({ params: {} as Record<string, string>, navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  useRouter: () => ({ navigate: route.navigate }),
  useParams: ({ select }: { select: (params: Record<string, string>) => unknown }) =>
    select(route.params),
}));
vi.mock("../../state/entities", () => ({ useProjects: () => [] }));
vi.mock("../../lib/discardComposerDraft", () => ({ discardComposerDraft: vi.fn() }));

afterEach(() => {
  useComposerDraftStore.setState({
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  });
  vi.unstubAllGlobals();
});

it("reopens an unsent draft with its prompt, image, and file after switching tasks", async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  const environmentId = EnvironmentId.make("draft-env");
  const projectRef = scopeProjectRef(environmentId, ProjectId.make("draft-project"));
  const draftId = DraftId.make("saved-draft");
  const store = useComposerDraftStore.getState();
  store.setProjectDraftThreadId(projectRef, draftId, { threadId: ThreadId.make("unsent-task") });
  store.setPrompt(draftId, "Keep this exact prompt");
  const image = new File(["image"], "reference.png", { type: "image/png" });
  const file = new File(["document"], "notes.pdf", { type: "application/pdf" });
  store.addImages(draftId, [
    {
      type: "image",
      id: "image",
      name: image.name,
      mimeType: image.type,
      sizeBytes: image.size,
      file: image,
      previewUrl: "data:image/png;base64,AA==",
    },
  ]);
  store.addFiles(draftId, [
    {
      type: "file",
      id: "file",
      name: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      file,
      uploadedAttachmentId: "uploaded-file",
      uploadEnvironmentId: environmentId,
    },
  ]);
  const saved = store.getComposerDraft(draftId);
  // Leaving the composer and creating another task must leave the old session reachable.
  route.params = { environmentId, threadId: "existing-task" };
  store.setProjectDraftThreadId(projectRef, DraftId.make("fresh-draft"), {
    threadId: ThreadId.make("fresh-task"),
  });
  const container = document.createElement("div");
  document.body.append(container);
  const root = createRoot(container);
  try {
    await act(() => root.render(<LegacySidebarDrafts />));
    const row = container.querySelector('[data-testid="sidebar-draft-row"]');
    expect(row?.textContent).toContain("Keep this exact prompt");
    expect(row?.textContent).toContain("2");
    const button = row?.querySelector("button");
    expect(button).not.toBeNull();
    await act(() => button!.click());
    expect(route.navigate).toHaveBeenCalledWith({ to: "/draft/$draftId", params: { draftId } });
    route.params = { draftId };
    await act(() => root.render(<LegacySidebarDrafts />));
    const restored = store.getComposerDraft(draftId);
    expect(restored).toBe(saved);
    expect(restored?.images[0]?.file).toBe(image);
    expect(restored?.files[0]?.file).toBe(file);
    const persisted = partializeComposerDraftStoreState(useComposerDraftStore.getState());
    expect(persisted.draftThreadsByThreadKey[draftId]?.threadId).toBe("unsent-task");
    expect(persisted.draftsByThreadKey[draftId]?.files?.[0]?.attachmentId).toBe("uploaded-file");
  } finally {
    await act(() => root.unmount());
    container.remove();
  }
});
