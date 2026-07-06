import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DEFAULT_FORM_STATE } from "../app/state/ui-state";
import {
  applyHiscoresLevels,
  countApplicableHiscoresSkills,
  createHiscoresPreviewRows
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
});
