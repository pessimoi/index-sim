import type { HiscoresResponse, HiscoresSkill } from "@/domain/shared";
import { CombatSetupFormSchema, type CombatSetupFormState } from "./ui-state";

const HISCORES_SKILL_ORDER: HiscoresSkill[] = [
  "attack",
  "strength",
  "defence",
  "hitpoints",
  "prayer",
  "ranged",
  "magic"
];

const FORM_LEVEL_SKILLS = [
  "attack",
  "strength",
  "defence",
  "hitpoints",
  "prayer",
  "ranged",
  "magic"
] as const;
export type FormLevelSkill = (typeof FORM_LEVEL_SKILLS)[number];
const FORM_LEVEL_SKILL_SET = new Set<HiscoresSkill>(FORM_LEVEL_SKILLS);

export interface HiscoresPreviewRow {
  skill: HiscoresSkill;
  currentLevel: number | null;
  fetchedLevel: number;
  canApply: boolean;
}

export interface HiscoresLevelApplyTransaction {
  previousForm: CombatSetupFormState;
  nextForm: CombatSetupFormState;
  changedSkills: readonly FormLevelSkill[];
}

function isFormLevelSkill(skill: HiscoresSkill): skill is FormLevelSkill {
  return FORM_LEVEL_SKILL_SET.has(skill);
}

export function normalizeHiscoresPlayerInput(player: string): string {
  return player.trim().replace(/\s+/g, " ").toLocaleLowerCase();
}

export function isHiscoresPreviewCurrent(
  playerInput: string,
  response: HiscoresResponse | null | undefined
): response is HiscoresResponse {
  if (!response) return false;
  const currentPlayer = normalizeHiscoresPlayerInput(playerInput);
  if (!currentPlayer) return false;
  const responsePlayer = normalizeHiscoresPlayerInput(response.normalizedPlayer || response.player);
  return currentPlayer === responsePlayer;
}

export function createHiscoresPreviewRows(
  form: CombatSetupFormState,
  response: HiscoresResponse
): HiscoresPreviewRow[] {
  return HISCORES_SKILL_ORDER.flatMap((skill) => {
    const value = response.skills[skill];
    if (!value) return [];
    const canApply = isFormLevelSkill(skill);
    return [
      {
        skill,
        currentLevel: canApply ? form.levels[skill] : null,
        fetchedLevel: value.level,
        canApply
      }
    ];
  });
}

export function countApplicableHiscoresSkills(response: HiscoresResponse): number {
  return FORM_LEVEL_SKILLS.filter((skill) => response.skills[skill]?.level !== undefined).length;
}

export function canApplyHiscoresPreview(
  playerInput: string,
  response: HiscoresResponse | null | undefined
): boolean {
  return (
    isHiscoresPreviewCurrent(playerInput, response) && countApplicableHiscoresSkills(response) > 0
  );
}

export function applyHiscoresLevels(
  form: CombatSetupFormState,
  response: HiscoresResponse
): CombatSetupFormState {
  const levels = { ...form.levels };

  for (const skill of FORM_LEVEL_SKILLS) {
    const fetchedLevel = response.skills[skill]?.level;
    if (fetchedLevel !== undefined) levels[skill] = fetchedLevel;
  }

  return CombatSetupFormSchema.parse({ ...form, levels });
}

export function createHiscoresLevelApplyTransaction(
  form: CombatSetupFormState,
  response: HiscoresResponse
): HiscoresLevelApplyTransaction {
  const previousForm = CombatSetupFormSchema.parse(form);
  const nextForm = applyHiscoresLevels(previousForm, response);
  return {
    previousForm,
    nextForm,
    changedSkills: FORM_LEVEL_SKILLS.filter(
      (skill) => previousForm.levels[skill] !== nextForm.levels[skill]
    )
  };
}
