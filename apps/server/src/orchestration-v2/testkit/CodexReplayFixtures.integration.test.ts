import { assert, describe, it } from "@effect/vitest";
import * as Tracer from "effect/Tracer";
import * as Effect from "effect/Effect";
import * as Predicate from "effect/Predicate";
import * as Schema from "effect/Schema";
import * as CodexSchema from "effect-codex-app-server/schema";

import { materializeReplayTranscriptWorkspace } from "@t3tools/provider-testing/replayTranscript";
import { CodexOrchestratorReplayHarness } from "../Adapters/CodexAdapterV2.testkit.ts";
import {
  findReplayFixture,
  itRunsReplayFixtures,
  runReplayFixture,
} from "./ProviderReplayFixtures.ts";
import {
  assertBaseProjection,
  assertSemanticProjectionIntegrity,
  projectionFor,
} from "./fixtures/shared.ts";

const decodeTurnStarted = Schema.decodeUnknownSync(CodexSchema.V2TurnStartedNotification);

describe("Codex replay fixtures", () => {
  it.effect("delivers Full Access command and file approvals without a user response", () => {
    const fixture = findReplayFixture("simple")!;
    const driver = fixture.providers.find((provider) => provider.driver === "codex")!;
    return runReplayFixture({
      fixtureName: fixture.name,
      buildInput: fixture.buildInput,
      driver: {
        ...driver,
        assertOutput: (result, transcript) => {
          assertBaseProjection({ result, transcript, runCount: 1, runStatuses: ["completed"] });
          const projection = projectionFor(result, transcript.scenario);
          assertSemanticProjectionIntegrity(projection);
          assert.lengthOf(projection.runtimeRequests, 2);
          for (const request of projection.runtimeRequests) {
            assert.equal(request.status, "resolved");
            assert.equal(request.decision, "accept");
          }
          assert.isFalse(
            result.domainEvents.some(
              (event) =>
                event.type === "runtime-request.updated" && event.payload.status === "pending",
            ),
          );
          assert.deepEqual(
            projection.turnItems
              .filter((item) => item.type === "approval_request")
              .map((item) => item.status),
            ["completed", "completed"],
          );
        },
      },
      harness: CodexOrchestratorReplayHarness,
      transformTranscript: (transcript) => ({
        ...transcript,
        entries: transcript.entries.flatMap((entry) => {
          if (
            entry.type !== "emit_inbound" ||
            !Predicate.isObject(entry.frame) ||
            entry.frame.method !== "turn/started"
          )
            return [entry];
          const started = decodeTurnStarted(entry.frame.params);
          return [
            entry,
            ...["commandExecution", "fileChange"].flatMap((kind, index) => [
              {
                type: "emit_inbound" as const,
                label: `Full Access ${kind} approval`,
                frame: {
                  id: 9000 + index,
                  method: `item/${kind}/requestApproval`,
                  params: {
                    threadId: started.threadId,
                    turnId: started.turn.id,
                    itemId: `full-access-${kind}`,
                    ...(kind === "commandExecution" ? { command: "echo authorized" } : {}),
                  },
                },
              },
              {
                type: "expect_outbound" as const,
                label: `Full Access ${kind} accepted`,
                frame: { id: 9000 + index, result: { decision: "accept" } },
              },
            ]),
          ];
        }),
      }),
      materializeWorkspace: (transcript, workspace) =>
        Effect.succeed(materializeReplayTranscriptWorkspace(transcript, workspace)),
    });
  });

  itRunsReplayFixtures("codex", (input) =>
    runReplayFixture({
      ...input,
      harness: CodexOrchestratorReplayHarness,
      materializeWorkspace: (transcript, workspace) =>
        Effect.succeed(materializeReplayTranscriptWorkspace(transcript, workspace)),
    }),
  );
});

it.effect(
  "persists recorded Codex snapshots through provider transactions in the real run consumer",
  () =>
    Effect.gen(function* () {
      const fixture = findReplayFixture("multi_turn")!;
      const driver = fixture.providers.find((provider) => provider.driver === "codex")!;
      const writes: number[] = [];
      const tracer = Tracer.make({
        span(options) {
          const span = new Tracer.NativeSpan(options);
          const end = span.end.bind(span);
          span.end = (time, exit) => {
            end(time, exit);
            if (span.name === "orchestrationV2.EventSink.providerBatch") {
              writes.push(Number(span.attributes.get("orchestration_v2.batch_writes")));
            }
          };
          return span;
        },
      });
      yield* runReplayFixture({
        fixtureName: fixture.name,
        buildInput: fixture.buildInput,
        driver,
        harness: CodexOrchestratorReplayHarness,
        materializeWorkspace: (transcript, workspace) =>
          Effect.succeed(materializeReplayTranscriptWorkspace(transcript, workspace)),
      }).pipe(Effect.withTracer(tracer), Effect.withTracerEnabled(true));
      assert.equal(
        writes.reduce((total, count) => total + count, 0),
        6,
      );
      assert.isTrue(writes.every((count) => count <= 3));
    }),
);
