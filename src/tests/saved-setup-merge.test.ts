import { describe, expect, it } from "vitest";

import {
  MAX_DUEL_SNAPSHOTS,
  createDuelSnapshot,
  duelSnapshotNameOccurrences,
  normalizeDuelSnapshotNameKey,
  renameDuelSnapshotSafely,
  uniqueDuelSnapshotName,
  validateDuelSnapshotName,
  type DuelSnapshotsState
} from "../app/state/duel-snapshots";
import {
  buildSavedSetupMergeCandidate,
  createSavedSetupMergePlan,
  savedSetupMergePlanIsFresh,
  setSavedSetupMergeDecision,
  setSavedSetupMergeRecipientName
} from "../app/state/saved-setup-merge";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";

function snapshot(id: string, name = id, monsterId = DEFAULT_FORM_STATE.monsterId) {
  return createDuelSnapshot(id, name, { ...DEFAULT_FORM_STATE, monsterId });
}

function state(...entries: ReturnType<typeof snapshot>[]): DuelSnapshotsState {
  return { snapshots: entries };
}

describe("saved setup names", () => {
  it("uses whitespace, NFKC, and case-insensitive comparison keys", () => {
    expect(normalizeDuelSnapshotNameKey("  Ｍy   SETUP ")).toBe("my setup");
    const current = state(snapshot("one", "My Setup"));
    expect(validateDuelSnapshotName(" my   setup ", current)).toMatchObject({
      status: "duplicate"
    });
  });

  it("suggests a unique bounded Save name deterministically", () => {
    const current = state(snapshot("one", "Setup"), snapshot("two", "setup (2)"));
    expect(uniqueDuelSnapshotName("Setup", current)).toBe("Setup (3)");
    const long = "A".repeat(80);
    const suggested = uniqueDuelSnapshotName(long, state(snapshot("long", long)));
    expect(suggested).toHaveLength(80);
    expect(suggested.endsWith(" (2)")).toBe(true);
  });

  it("keeps historical duplicate names readable and disambiguates their occurrences", () => {
    const current = state(snapshot("one", "Duplicate"), snapshot("two", " duplicate "));
    const occurrences = duelSnapshotNameOccurrences(current);
    expect(occurrences.get("one")).toEqual({ snapshotId: "one", count: 2, ordinal: 1 });
    expect(occurrences.get("two")).toEqual({ snapshotId: "two", count: 2, ordinal: 2 });
  });

  it("renames only by stable ID and rejects unsafe names without mutating form data", () => {
    const current = state(snapshot("one", "One"), snapshot("two", "Two"));
    expect(renameDuelSnapshotSafely(current, "missing", "New").status).toBe("missing");
    expect(renameDuelSnapshotSafely(current, "one", " ").status).toBe("invalid");
    expect(renameDuelSnapshotSafely(current, "one", "ＴＷＯ").status).toBe("duplicate");
    expect(renameDuelSnapshotSafely(current, "one", "One").status).toBe("unchanged");

    const result = renameDuelSnapshotSafely(current, "one", "  ONE  ");
    expect(result.status).toBe("renamed");
    if (result.status !== "renamed") return;
    expect(result.state.snapshots[0]).toEqual({ ...current.snapshots[0], name: "ONE" });
    expect(result.state.snapshots[1]).toEqual(current.snapshots[1]);
  });
});

describe("saved setup merge plan", () => {
  it("classifies identical, replacement, selected addition, and capacity-excluded rows", () => {
    const currentEntries = Array.from({ length: MAX_DUEL_SNAPSHOTS - 1 }, (_, index) =>
      snapshot(`current-${index}`, `Current ${index}`)
    );
    const current = state(snapshot("same", "Same"), ...currentEntries.slice(0, -1));
    const source = state(
      snapshot("same", "Same"),
      snapshot("current-0", "Changed", "firegiant"),
      snapshot("new-one", "New one"),
      snapshot("new-two", "New two")
    );
    const plan = createSavedSetupMergePlan({ reviewId: 1, source, current });

    expect(plan.rows.map((row) => [row.classification, row.decision])).toEqual([
      ["unchanged", "no-change"],
      ["replacement-candidate", "keep"],
      ["addition-candidate", "add"],
      ["capacity-excluded", "exclude"]
    ]);
    expect(plan.counts).toMatchObject({
      availableSlots: 1,
      selectedAddCount: 1,
      selectedReplaceCount: 0,
      identicalCount: 1,
      keepCount: 1,
      notSelectedCount: 1
    });
  });

  it.each([0, 1, 11, 12])(
    "never selects more additions than %i available slots",
    (currentCount) => {
      const current = state(
        ...Array.from({ length: currentCount }, (_, index) =>
          snapshot(`current-${index}`, `Current ${index}`)
        )
      );
      const source = state(snapshot("new-one", "New one"), snapshot("new-two", "New two"));
      const plan = createSavedSetupMergePlan({ reviewId: 1, source, current });
      expect(plan.counts.selectedAddCount).toBe(Math.min(2, MAX_DUEL_SNAPSHOTS - currentCount));
    }
  );

  it("allows a deliberate capacity trade without changing the imported source", () => {
    const current = state(
      ...Array.from({ length: MAX_DUEL_SNAPSHOTS - 1 }, (_, index) =>
        snapshot(`current-${index}`, `Current ${index}`)
      )
    );
    const source = state(snapshot("new-one", "New one"), snapshot("new-two", "New two"));
    const initial = createSavedSetupMergePlan({ reviewId: 1, source, current });
    const excludedFirst = setSavedSetupMergeDecision({
      plan: initial,
      current,
      snapshotId: "new-one",
      decision: "exclude"
    });
    const selectedSecond = setSavedSetupMergeDecision({
      plan: excludedFirst,
      current,
      snapshotId: "new-two",
      decision: "add"
    });
    expect(selectedSecond.rows.map((row) => row.decision)).toEqual(["exclude", "add"]);
    expect(selectedSecond.source).toEqual(source);
  });

  it("blocks conflicting recipient names until edited", () => {
    const current = state(snapshot("current", "Existing"));
    const source = state(snapshot("new", "existing"));
    const initial = createSavedSetupMergePlan({ reviewId: 1, source, current });
    expect(initial.rows[0].nameStatus).toBe("conflict");
    expect(initial.canMerge).toBe(false);
    expect(buildSavedSetupMergeCandidate(initial, current).status).toBe("invalid");

    const edited = setSavedSetupMergeRecipientName({
      plan: initial,
      current,
      snapshotId: "new",
      name: "Imported existing"
    });
    expect(edited.rows[0].nameStatus).toBe("available");
    expect(edited.canMerge).toBe(true);
  });

  it("preserves unrelated current rows and current order in the candidate", () => {
    const current = state(
      snapshot("unrelated", "Unrelated"),
      snapshot("shared", "Current shared"),
      snapshot("tail", "Tail")
    );
    const source = state(
      snapshot("shared", "Imported shared", "firegiant"),
      snapshot("added", "Added")
    );
    let plan = createSavedSetupMergePlan({ reviewId: 1, source, current });
    plan = setSavedSetupMergeDecision({
      plan,
      current,
      snapshotId: "shared",
      decision: "replace"
    });
    const candidate = buildSavedSetupMergeCandidate(plan, current);
    expect(candidate.status).toBe("ready");
    if (candidate.status !== "ready") return;
    expect(candidate.state.snapshots.map((entry) => entry.id)).toEqual([
      "unrelated",
      "shared",
      "tail",
      "added"
    ]);
    expect(candidate.state.snapshots[1].name).toBe("Imported shared");
  });

  it("detects stale reviews and refuses to build from newer live state", () => {
    const current = state(snapshot("current", "Current"));
    const source = state(snapshot("new", "New"));
    const plan = createSavedSetupMergePlan({ reviewId: 1, source, current });
    const newer = state(...current.snapshots, snapshot("later", "Later"));
    expect(savedSetupMergePlanIsFresh(plan, newer)).toBe(false);
    expect(buildSavedSetupMergeCandidate(plan, newer).status).toBe("stale");
    expect(
      setSavedSetupMergeDecision({
        plan,
        current: newer,
        snapshotId: "new",
        decision: "exclude"
      })
    ).toBe(plan);
  });
});
