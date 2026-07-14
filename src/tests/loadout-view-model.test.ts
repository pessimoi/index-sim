import {
  DEFAULT_FORM_STATE,
  EQUIPMENT_SLOTS,
  activeAssumptionRow,
  ammoOptions,
  applyWeaponSelection,
  createSimulationViewModel,
  equipmentSlotOptions,
  gearQuickActionForSlot,
  loadBundledLegacyContext,
  normalizeFormState,
  optimizeVisibleLoadout,
  spellOptions,
  switchCombatStyleLoadout,
  weaponOptions,
  withGeneratedRequirement
} from "./ui-view-model-fixture";

describe("rewrite UI view models", () => {
  it("builds searchable loadout option view models from the validated game snapshot", async () => {
    const { context } = await loadBundledLegacyContext();

    expect(weaponOptions(context.gameData, "melee")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "dragon_dagger_p", label: "Dragon dagger(p)" })
      ])
    );
    expect(
      weaponOptions(context.gameData, "ranged").find((option) => option.id === "magic_shortbow")
        ?.hint
    ).toContain("2h");
    expect(equipmentSlotOptions(context.gameData, "shield")).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "unholy_book",
          label: "Unholy book (Zamorak)",
          hint: expect.stringContaining("stabAtt +8")
        })
      ])
    );
    expect(ammoOptions(context.gameData, "arrow")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "rune_arrow" })])
    );
    expect(ammoOptions(context.gameData, "arrow")).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "steel_knife" })])
    );
    expect(ammoOptions(context.gameData, "thrown")).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: "steel_knife" })])
    );
    expect(spellOptions(context.gameData)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: "fire_wave", hint: expect.stringContaining("base") })
      ])
    );
  });

  it("selects deterministic visible gear quick actions for the active combat style", async () => {
    const { context } = await loadBundledLegacyContext();
    const helmOptions = equipmentSlotOptions(context.gameData, "helm");
    const bodyOptions = equipmentSlotOptions(context.gameData, "body");

    const meleeHelm = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      options: helmOptions
    });
    const rangedHelm = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "ranged",
      weaponId: "magic_shortbow",
      styleId: "rapid",
      currentItemId: "rune_full_helm",
      options: helmOptions
    });
    const magicHelm = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "magic",
      weaponId: "staff_of_fire",
      styleId: "accurate",
      currentItemId: "rune_full_helm",
      options: helmOptions
    });
    const currentTie = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "body",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_platebody",
      options: bodyOptions
    });

    expect(meleeHelm).toMatchObject({ itemId: "berserker_helm", disabled: false });
    expect(rangedHelm).toMatchObject({ itemId: "robin_hood_hat", disabled: false });
    expect(magicHelm).toMatchObject({ itemId: "farseer_helm", disabled: false });
    expect(currentTie).toMatchObject({ itemId: "rune_platebody", disabled: true });
  });

  it("limits gear quick actions to the supplied visible candidates and shield lock", async () => {
    const { context } = await loadBundledLegacyContext();
    const hiddenBestOptions = equipmentSlotOptions(context.gameData, "helm").filter(
      (option) => option.id !== "berserker_helm"
    );
    const hiddenBest = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      options: hiddenBestOptions
    });
    const lockedShield = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "shield",
      combatStyle: "melee",
      weaponId: "dragon_halberd",
      styleId: "aggressive",
      currentItemId: "rune_kite",
      options: equipmentSlotOptions(context.gameData, "shield"),
      shieldLocked: true
    });

    expect(hiddenBest.itemId).not.toBe("berserker_helm");
    expect(hiddenBest).toMatchObject({ itemId: "warrior_helm", disabled: false });
    expect(lockedShield).toMatchObject({
      itemId: "none",
      disabled: true,
      reason: "Shield locked by two-handed weapon"
    });
  });

  it("includes unmet requirements in gear quick action reasons", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      levels: { ...DEFAULT_FORM_STATE.levels, defence: 1 },
      options: equipmentSlotOptions(context.gameData, "helm")
    });

    expect(action).toMatchObject({
      itemId: "berserker_helm",
      disabled: false,
      reason: "Apply Berserker helm - requires Defence 45, current 1"
    });
  });

  it("uses generated requirements in gear quick action reasons before manual fallback", async () => {
    const { context } = await loadBundledLegacyContext();
    const generatedContext = withGeneratedRequirement(context, "berserker_helm", { strength: 50 });
    const action = gearQuickActionForSlot({
      gameData: generatedContext.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      levels: { ...DEFAULT_FORM_STATE.levels, strength: 49 },
      options: equipmentSlotOptions(generatedContext.gameData, "helm")
    });

    expect(action).toMatchObject({
      itemId: "berserker_helm",
      disabled: false,
      reason: "Apply Berserker helm - requires Strength 50, current 49"
    });
  });

  it("keeps normal gear quick action reasons when requirements are met", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "helm",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_full_helm",
      levels: DEFAULT_FORM_STATE.levels,
      options: equipmentSlotOptions(context.gameData, "helm")
    });

    expect(action).toMatchObject({
      itemId: "berserker_helm",
      disabled: false,
      reason: "Apply Berserker helm"
    });
  });

  it("includes unmet requirements when the current gear is already the best option", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "body",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "rune_platebody",
      levels: { ...DEFAULT_FORM_STATE.levels, defence: 1 },
      options: equipmentSlotOptions(context.gameData, "body")
    });

    expect(action).toMatchObject({
      itemId: "rune_platebody",
      disabled: true,
      reason: "Best visible option: Rune platebody - requires Defence 40, current 1"
    });
  });

  it("does not add requirement copy for gear with no known requirement", async () => {
    const { context } = await loadBundledLegacyContext();
    const action = gearQuickActionForSlot({
      gameData: context.gameData,
      slot: "amulet",
      combatStyle: "melee",
      weaponId: "rune_scimitar",
      styleId: "aggressive",
      currentItemId: "none",
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 1, defence: 1 },
      options: equipmentSlotOptions(context.gameData, "amulet").filter(
        (option) => option.id === "none" || option.id === "amu_power"
      )
    });

    expect(action).toMatchObject({
      itemId: "amu_power",
      disabled: false,
      reason: "Apply Amulet of power"
    });
  });

  it("optimizes the visible whole loadout deterministically for current-target normal DPS", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "black_dragon",
      weaponId: "bronze_dagger",
      gear: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, "none"]))
    });
    const input = {
      form,
      context,
      weaponOptions: weaponOptions(context.gameData, form.combatStyle),
      gearOptions: Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => [slot, equipmentSlotOptions(context.gameData, slot)])
      ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>
    };
    const startedAt = performance.now();
    const first = optimizeVisibleLoadout(input);
    const elapsedMs = performance.now() - startedAt;
    const second = optimizeVisibleLoadout(input);

    expect(first.optimizedDps).toBeGreaterThan(first.baselineDps);
    expect(first.dpsDelta).toBeCloseTo(first.optimizedDps - first.baselineDps, 12);
    expect(first.changedFields).toContain("weapon");
    expect(first.evaluatedLoadouts).toBeGreaterThan(1);
    expect(first).toEqual(second);
    expect(elapsedMs).toBeLessThan(750);
  });

  it("keeps whole-loadout optimization inside visible candidates and two-handed rules", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "black_dragon",
      weaponId: "bronze_dagger"
    });
    const visibleWeapons = weaponOptions(context.gameData, form.combatStyle).filter(
      (option) => option.id !== "dragon_halberd"
    );
    const visibleGear = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [
        slot,
        equipmentSlotOptions(context.gameData, slot).filter(
          (option) => option.id !== "berserker_helm"
        )
      ])
    ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>;
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: visibleWeapons,
      gearOptions: visibleGear
    });

    expect(visibleWeapons.map((option) => option.id)).toContain(result.form.weaponId);
    expect(result.form.weaponId).not.toBe("dragon_halberd");
    for (const slot of EQUIPMENT_SLOTS) {
      expect(visibleGear[slot].map((option) => option.id)).toContain(
        result.form.gear[slot] ?? "none"
      );
    }
    if (context.gameData.weapons[result.form.weaponId]?.twoHand) {
      expect(result.form.gear.shield).toBe("none");
    }
  });

  it("filters unmet optimizer candidates by default and reports bounded no-regression results", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "black_dragon",
      weaponId: "bronze_dagger",
      levels: {
        ...DEFAULT_FORM_STATE.levels,
        attack: 1,
        strength: 1,
        defence: 1
      },
      gear: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, "none"]))
    });
    const gearOptions = Object.fromEntries(
      EQUIPMENT_SLOTS.map((slot) => [slot, equipmentSlotOptions(context.gameData, slot)])
    ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>;
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: weaponOptions(context.gameData, form.combatStyle),
      gearOptions,
      frontierLimit: 1
    });
    const optimizedViewModel = createSimulationViewModel(result.form, context);

    expect(result.eligibilityPolicy).toBe("respect-current-levels");
    expect(result.excludedCandidateCount).toBeGreaterThan(0);
    expect(result.capped).toBe(true);
    expect(result.optimizedDps).toBeGreaterThanOrEqual(result.baselineDps);
    expect(result.changedFields.length).toBeGreaterThan(0);
    expect(optimizedViewModel.setupRequirements.hasWarnings).toBe(false);
  });

  it("keeps the original warning-only candidate policy behind an explicit optimizer input", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "black_dragon",
      weaponId: "bronze_dagger",
      levels: {
        ...DEFAULT_FORM_STATE.levels,
        attack: 1,
        strength: 1,
        defence: 1
      },
      gear: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, "none"]))
    });
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: weaponOptions(context.gameData, form.combatStyle),
      gearOptions: Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => [slot, equipmentSlotOptions(context.gameData, slot)])
      ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>,
      eligibilityPolicy: "ignore-requirements",
      frontierLimit: 1
    });

    expect(result.eligibilityPolicy).toBe("ignore-requirements");
    expect(result.excludedCandidateCount).toBe(0);
    expect(result.optimizedDps).toBeGreaterThanOrEqual(result.baselineDps);
    expect(createSimulationViewModel(result.form, context).setupRequirements.hasWarnings).toBe(
      true
    );
  });

  it("keeps an unmet current loadout as the no-regression baseline", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      weaponId: "dragon_longsword",
      levels: { ...DEFAULT_FORM_STATE.levels, attack: 1 }
    });
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: [{ id: "dragon_longsword", label: "Dragon longsword" }],
      gearOptions: Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => {
          const itemId = form.gear[slot] ?? "none";
          return [
            slot,
            [
              {
                id: itemId,
                label: context.gameData.equipment[slot]?.[itemId]?.name ?? "None"
              }
            ]
          ];
        })
      ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>
    });

    expect(result.excludedCandidateCount).toBeGreaterThan(0);
    expect(result.form).toEqual(form);
    expect(result.changedFields).toEqual([]);
    expect(result.dpsDelta).toBe(0);
    expect(createSimulationViewModel(result.form, context).setupRequirements.hasWarnings).toBe(
      true
    );
  });

  it("keeps the current loadout on an equal visible candidate set", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState(DEFAULT_FORM_STATE);
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: [
        {
          id: form.weaponId,
          label: context.gameData.weapons[form.weaponId]?.name ?? form.weaponId
        }
      ],
      gearOptions: Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => {
          const itemId = form.gear[slot] ?? "none";
          return [
            slot,
            [
              {
                id: itemId,
                label: context.gameData.equipment[slot]?.[itemId]?.name ?? "None"
              }
            ]
          ];
        })
      ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>
    });

    expect(result.form).toEqual(form);
    expect(result.changedFields).toEqual([]);
    expect(result.dpsDelta).toBe(0);
    expect(result.capped).toBe(false);
  });

  it("sanitizes an invalid frontier limit without dropping valid candidates", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = normalizeFormState({
      ...DEFAULT_FORM_STATE,
      monsterId: "black_dragon",
      weaponId: "bronze_dagger",
      gear: Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, "none"]))
    });
    const result = optimizeVisibleLoadout({
      form,
      context,
      weaponOptions: weaponOptions(context.gameData, form.combatStyle),
      gearOptions: Object.fromEntries(
        EQUIPMENT_SLOTS.map((slot) => [slot, equipmentSlotOptions(context.gameData, slot)])
      ) as Record<(typeof EQUIPMENT_SLOTS)[number], ReturnType<typeof equipmentSlotOptions>>,
      frontierLimit: Number.NaN
    });

    expect(result.evaluatedLoadouts).toBeGreaterThan(1);
    expect(result.optimizedDps).toBeGreaterThan(result.baselineDps);
  });

  it("clears and locks shield state when a two-handed weapon is selected", async () => {
    const { context } = await loadBundledLegacyContext();
    const ranged = normalizeFormState({
      ...switchCombatStyleLoadout(DEFAULT_FORM_STATE, "ranged"),
      weaponId: "steel_knife_w",
      ammoId: "none",
      gear: {
        ...DEFAULT_FORM_STATE.gear,
        shield: "unholy_book"
      }
    });

    const bow = applyWeaponSelection(ranged, "magic_shortbow", context.gameData);
    const bowFromThrownAmmo = applyWeaponSelection(
      { ...ranged, ammoId: "steel_knife" },
      "magic_shortbow",
      context.gameData
    );
    const thrown = applyWeaponSelection(
      {
        ...bow,
        gear: { ...bow.gear, shield: "unholy_book" }
      },
      "steel_knife_w",
      context.gameData
    );

    expect(bow.weaponId).toBe("magic_shortbow");
    expect(bow.ammoId).toBe("rune_arrow");
    expect(bow.gear.shield).toBe("none");
    expect(bowFromThrownAmmo.ammoId).toBe("rune_arrow");
    expect(thrown.weaponId).toBe("steel_knife_w");
    expect(thrown.ammoId).toBe("steel_knife");
    expect(thrown.gear.shield).toBe("unholy_book");
  });

  it("surfaces unmet setup requirements for low defence rune armour", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, defence: 1 }
      },
      context
    );
    const runeBodyWarning = result.setupRequirements.warnings.find(
      (warning) => warning.itemId === "rune_platebody" && warning.skill === "defence"
    );

    expect(runeBodyWarning).toMatchObject({
      itemName: "Rune platebody",
      slot: "body",
      slotLabel: "Body",
      skillLabel: "Defence",
      requiredLevel: 40,
      currentLevel: 1,
      severity: "warning"
    });
    expect(runeBodyWarning?.message).toContain("Rune platebody requires Defence 40");
    expect(result.setupRequirements.source).toBe("manual-fallback");
    expect(result.setupRequirements.policyLabel).toBe("Manual requirement fallback");
    expect(activeAssumptionRow(result, "setup-requirements")).toMatchObject({
      label: "Setup requirements",
      reviewTab: "melee",
      tone: "warning"
    });
    expect(activeAssumptionRow(result, "setup-requirements")?.resetAction).toBeUndefined();
  });

  it("surfaces unmet setup requirements for low attack dragon weapons", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = applyWeaponSelection(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, attack: 1 }
      },
      "dragon_longsword",
      context.gameData
    );
    const result = createSimulationViewModel(form, context);

    expect(result.setupRequirements.warnings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          itemId: "dragon_longsword",
          itemName: "Dragon longsword",
          slot: "weapon",
          slotLabel: "Weapon",
          skill: "attack",
          skillLabel: "Attack",
          requiredLevel: 60,
          currentLevel: 1
        })
      ])
    );
    expect(activeAssumptionRow(result, "setup-requirements")).toMatchObject({
      reviewTab: "melee"
    });
  });

  it("uses generated setup requirements without the manual fallback label", async () => {
    const { context } = await loadBundledLegacyContext();
    const generatedContext = withGeneratedRequirement(context, "iron_scimitar", { strength: 5 });
    const form = applyWeaponSelection(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, strength: 1 },
        gear: {
          helm: "none",
          amulet: "none",
          body: "none",
          legs: "none",
          shield: "none",
          gloves: "none",
          boots: "none",
          cape: "none",
          ring: "none"
        }
      },
      "iron_scimitar",
      generatedContext.gameData
    );
    const result = createSimulationViewModel(form, generatedContext);

    expect(result.setupRequirements.policyLabel).toBe("Generated requirement data");
    expect(result.setupRequirements.source).toBe("generated");
    expect(result.setupRequirements.warnings).toEqual([
      expect.objectContaining({
        itemId: "iron_scimitar",
        skill: "strength",
        requiredLevel: 5,
        currentLevel: 1
      })
    ]);
  });

  it("keeps matching setup levels free of requirement warnings", async () => {
    const { context } = await loadBundledLegacyContext();
    const result = createSimulationViewModel(DEFAULT_FORM_STATE, context);

    expect(result.setupRequirements.warnings).toEqual([]);
    expect(activeAssumptionRow(result, "setup-requirements")).toBeUndefined();
  });

  it("ignores selected gear with no known setup requirement", async () => {
    const { context } = await loadBundledLegacyContext();
    const form = applyWeaponSelection(
      {
        ...DEFAULT_FORM_STATE,
        levels: { ...DEFAULT_FORM_STATE.levels, attack: 1, defence: 1 },
        gear: {
          helm: "none",
          amulet: "amu_power",
          body: "none",
          legs: "none",
          shield: "none",
          gloves: "none",
          boots: "none",
          cape: "none",
          ring: "none"
        }
      },
      "iron_scimitar",
      context.gameData
    );
    const result = createSimulationViewModel(form, context);

    expect(result.setupRequirements.warnings).toEqual([]);
    expect(activeAssumptionRow(result, "setup-requirements")).toBeUndefined();
  });
});
