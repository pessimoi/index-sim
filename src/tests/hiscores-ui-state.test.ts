import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  applyHiscoresLevels,
  canApplyHiscoresPreview,
  countApplicableHiscoresSkills,
  createHiscoresPreviewRows,
  isHiscoresPreviewCurrent,
  normalizeHiscoresPlayerInput
} from "../app/state/hiscores";
import type { HiscoresResponse } from "../domain/shared";

function readHiscoresFixture(): HiscoresResponse {
  return JSON.parse(
    readFileSync(
      join(process.cwd(), "src/tests/fixtures/live-integrations/hiscores-api-success.json"),
      "utf8"
    )
  ) as HiscoresResponse;
}

describe("hiscores UI state helpers", () => {
  it("normalizes player names for freshness checks without changing request validation", () => {
    expect(normalizeHiscoresPlayerInput("  Fixture   Player  ")).toBe("fixture player");
    expect(normalizeHiscoresPlayerInput("fixture player")).toBe("fixture player");
    expect(normalizeHiscoresPlayerInput("FIXTURE PLAYER")).toBe("fixture player");
  });

  it("detects current, stale and missing previews by normalized player input", () => {
    const response = readHiscoresFixture();

    expect(isHiscoresPreviewCurrent(" fixture   player ", response)).toBe(true);
    expect(isHiscoresPreviewCurrent("Fixture Player", response)).toBe(true);
    expect(isHiscoresPreviewCurrent("Other Player", response)).toBe(false);
    expect(isHiscoresPreviewCurrent("Fixture Player", null)).toBe(false);
  });

  it("previews supported skills including hitpoints in the current form model", () => {
    const rows = createHiscoresPreviewRows(DEFAULT_FORM_STATE, readHiscoresFixture());

    expect(rows.find((row) => row.skill === "attack")).toMatchObject({
      currentLevel: 60,
      fetchedLevel: 61,
      canApply: true
    });
    expect(rows.find((row) => row.skill === "hitpoints")).toMatchObject({
      currentLevel: 50,
      fetchedLevel: 63,
      canApply: true
    });
  });

  it("applies only returned setup-level skills and leaves missing skills unchanged", () => {
    const response: HiscoresResponse = {
      ...readHiscoresFixture(),
      skills: {
        attack: { level: 61 },
        hitpoints: { level: 63 }
      }
    };
    const form = {
      ...DEFAULT_FORM_STATE,
      levels: {
        ...DEFAULT_FORM_STATE.levels,
        attack: 10,
        strength: 20,
        prayer: 30
      }
    };
    const applied = applyHiscoresLevels(form, response);

    expect(applied.levels.attack).toBe(61);
    expect(applied.levels.hitpoints).toBe(63);
    expect(applied.levels.strength).toBe(20);
    expect(applied.levels.prayer).toBe(30);
    expect(countApplicableHiscoresSkills(response)).toBe(2);
  });

  it("allows Apply only for current previews with at least one supported skill", () => {
    const response = readHiscoresFixture();
    const noSupportedSkills: HiscoresResponse = {
      ...response,
      skills: {}
    };

    expect(canApplyHiscoresPreview("fixture player", response)).toBe(true);
    expect(canApplyHiscoresPreview("other player", response)).toBe(false);
    expect(canApplyHiscoresPreview("fixture player", null)).toBe(false);
    expect(canApplyHiscoresPreview("fixture player", noSupportedSkills)).toBe(false);
  });
});
