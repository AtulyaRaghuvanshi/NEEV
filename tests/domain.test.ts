import assert from "node:assert/strict";
import test from "node:test";
import { resolveEvidence, similarity, unlockNext } from "../lib/domain.ts";
import { retrieveRules } from "../lib/rules.ts";

test("fuzzy evidence matching tolerates a small spelling variation", () => {
  assert.ok(similarity("Shiva Kumar", "Siva Kumar") > 0.88);
  assert.ok(similarity("Shiva Kumar", "Ramesh Singh") < 0.5);
});

test("evidence resolution selects the best-supported value and flags a conflict", () => {
  const graph = resolveEvidence([
    { id: "school", confidence: 0.93, fields: { name: "Shiva Kumar" } },
    { id: "ration", confidence: 0.85, fields: { name: "Siva Kumar" } },
    { id: "employer", confidence: 0.7, fields: { name: "Ramesh Kumar" } },
  ]);
  assert.equal(graph.name.selected.value, "Shiva Kumar"); assert.equal(graph.name.conflict, true);
});

test("planner unlocks exactly the immediate next dependency", () => {
  const steps = unlockNext([{ state: "ready" as const }, { state: "locked" as const }, { state: "locked" as const }], 0);
  assert.deepEqual(steps.map((step) => step.state), ["complete", "ready", "locked"]);
});

test("retrieval prefers Bihar's official residence rule", () => {
  assert.equal(retrieveRules("Residence certificate", "Bihar")[0]?.id, "bihar-residence");
});
