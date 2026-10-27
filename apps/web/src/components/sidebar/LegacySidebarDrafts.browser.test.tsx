import { expect, it, vi } from "vite-plus/test";
import { render } from "../../../test/render";
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
vi.mock("./TaskFolderControls", () => ({ useTaskFolderActions: () => ({ moveMenu: () => [] }) }));

function setup() {
  const empty = {
    draftsByThreadKey: {},
    draftThreadsByThreadKey: {},
    logicalProjectDraftThreadKeyByLogicalProjectKey: {},
  };
  route.params = {};
  route.navigate.mockReset();
  useComposerDraftStore.setState(empty);
  return { [Symbol.dispose]: () => useComposerDraftStore.setState(empty) };
}

it("reopens an unsent draft with its prompt, image, and file after switching tasks", async () => {
  using _state = setup();
  const environmentId = EnvironmentId.make("draft-env");
  const projectRef = scopeProjectRef(environmentId, ProjectId.make("draft-project"));
  const projects = [
    {
      id: projectRef.projectId,
      environmentId,
      title: "Project",
      workspaceRoot: "/project",
      defaultModelSelection: null,
      scripts: [],
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    },
  ];
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
  // Routing is mocked to inspect draft navigation without performing it.
  await using screen = await render(
    <LegacySidebarDrafts projects={projects} taskFolderId={null} />,
    { router: false },
  );
  const row = screen.getByTestId("sidebar-draft-row");
  await expect.element(row).toHaveTextContent("Keep this exact prompt");
  await expect.element(row).toHaveTextContent("2");
  await row.getByRole("button").click();
  expect(route.navigate).toHaveBeenCalledWith({ to: "/draft/$draftId", params: { draftId } });
  route.params = { draftId };
  await screen.rerender(<LegacySidebarDrafts projects={projects} taskFolderId={null} />);
  const restored = store.getComposerDraft(draftId);
  expect(restored).toBe(saved);
  expect(restored?.images[0]?.file).toBe(image);
  expect(restored?.files[0]?.file).toBe(file);
  const persisted = partializeComposerDraftStoreState(useComposerDraftStore.getState());
  expect(persisted.draftThreadsByThreadKey[draftId]?.threadId).toBe("unsent-task");
  expect(persisted.draftsByThreadKey[draftId]?.files?.[0]?.attachmentId).toBe("uploaded-file");
});
