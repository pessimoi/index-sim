export type AccessibilityViewport = {
  readonly width: number;
  readonly height: number;
  readonly label: string;
};

export type AccessibilityJourney = {
  readonly id: `AT-${string}`;
  readonly journey: string;
  readonly fixture: string;
  readonly viewport: AccessibilityViewport;
  readonly entry: string;
  readonly expectedOutcomes: readonly string[];
  readonly announcements: readonly string[];
  readonly scanCheckpoints: readonly string[];
  readonly manualSteps: readonly string[];
  readonly linkedTests: readonly string[];
  readonly exception: null | {
    readonly reason: string;
    readonly owner: string;
    readonly reviewDate: string;
  };
};

const desktop = { label: "desktop", width: 1280, height: 800 } as const;
const compact = { label: "compact mobile", width: 390, height: 844 } as const;

export const ACCESSIBILITY_JOURNEYS = [
  {
    id: "AT-01",
    journey: "Startup and shell",
    fixture: "clean local storage and generated Revision 274 data",
    viewport: desktop,
    entry: "Start at the skip link, then use the Workbench tablist.",
    expectedOutcomes: [
      "One page heading and distinguishable banner, main and complementary landmarks",
      "Skip link reaches the active tabpanel",
      "Workbench tabs expose selected state, roving focus and hidden inactive panels"
    ],
    announcements: ["Startup and tab changes do not repeat stale pane statuses"],
    scanCheckpoints: ["root shell", "Stats tab selected"],
    manualSteps: [
      "Navigate landmarks and headings from the top of the page",
      "Activate the skip link and change tabs with arrow keys"
    ],
    linkedTests: ["shell-accessibility.spec.ts"],
    exception: null
  },
  {
    id: "AT-02",
    journey: "Player and combat setup",
    fixture: "clean local storage and default melee setup",
    viewport: desktop,
    entry: "Enter Player inputs, then open the Weapon searchable selector.",
    expectedOutcomes: [
      "Numeric validation is related to the edited field",
      "The selector trigger is a button and the focused search input owns the combobox state",
      "Listbox options are selected through an active descendant without moving DOM focus"
    ],
    announcements: ["Settled search-result count and numeric validation feedback"],
    scanCheckpoints: ["Melee setup", "Weapon selector open", "numeric validation error"],
    manualSteps: [
      "Edit a required level to an invalid value and review its error",
      "Filter Weapon options, select with Enter and dismiss with Escape"
    ],
    linkedTests: [
      "numeric-input.spec.ts",
      "loadout.spec.ts",
      "shell-accessibility.spec.ts",
      "entity-label-collisions.spec.ts"
    ],
    exception: null
  },
  {
    id: "AT-03",
    journey: "Stats and active assumptions",
    fixture: "clean local storage with one changed melee setup value",
    viewport: desktop,
    entry: "Open Stats, review the result summary, then open Reset review.",
    expectedOutcomes: [
      "Results and active assumptions have unique region names",
      "Reset review explains consequences before mutation",
      "Undo remains one labelled action and status"
    ],
    announcements: ["Reset outcome and its available Undo action"],
    scanCheckpoints: ["Stats results", "Reset active setup review"],
    manualSteps: [
      "Read result and warning summaries",
      "Open Reset review, cancel it and verify focus"
    ],
    linkedTests: ["loadout.spec.ts", "shell-accessibility.spec.ts"],
    exception: null
  },
  {
    id: "AT-04",
    journey: "Monsters and Dense table",
    fixture: "generated monster fixture with local filters only",
    viewport: desktop,
    entry: "Open Monsters and enter the All monsters table.",
    expectedOutcomes: [
      "Table name, column headers, sort direction and selected row are programmatic",
      "Dense horizontal overflow remains keyboard reachable",
      "An empty filter result retains instructions and Reset filters"
    ],
    announcements: ["Settled comparison status without row-by-row noise"],
    scanCheckpoints: ["All monsters table", "empty monster filter"],
    manualSteps: [
      "Navigate headers and select a monster row",
      "Create and recover from no matches"
    ],
    linkedTests: ["compare-numerics.spec.ts", "shell-accessibility.spec.ts"],
    exception: null
  },
  {
    id: "AT-05",
    journey: "Saved setups and comparison",
    fixture: "clean Duel storage and current default setup",
    viewport: desktop,
    entry: "Open Setups, save the current setup and review its comparison row.",
    expectedOutcomes: [
      "Save, rename, diff and merge controls expose their action and state",
      "Validation and import review copy is related to the owning surface",
      "Comparison tables retain distinguishable names and headers"
    ],
    announcements: ["Save, rename, merge or apply produces one primary outcome"],
    scanCheckpoints: ["empty Setups", "saved setup comparison"],
    manualSteps: ["Save and rename a setup", "Review a diff and dismiss without applying"],
    linkedTests: ["planner-duel.spec.ts", "workspace-backup.spec.ts"],
    exception: null
  },
  {
    id: "AT-06",
    journey: "Loot and Trip",
    fixture: "default Goblin loot and trip assumptions",
    viewport: compact,
    entry: "Open Loot, traverse disclosures and nested tables, then open Trip.",
    expectedOutcomes: [
      "Loot tables and nested tables have distinguishable names and native headers",
      "Drop actions and no-data states retain visible instructions",
      "Trip controls and output are contained at the compact viewport"
    ],
    announcements: ["Explicit drop or reset action outcome, not continuous calculation values"],
    scanCheckpoints: ["Loot", "Trip"],
    manualSteps: [
      "Read loot composition and disclose nested data",
      "Edit Food and review Trip output"
    ],
    linkedTests: [
      "cannon-trip-loot.spec.ts",
      "shell-accessibility.spec.ts",
      "entity-label-collisions.spec.ts"
    ],
    exception: null
  },
  {
    id: "AT-07",
    journey: "Risk and Cannon",
    fixture: "default deterministic generated setup",
    viewport: desktop,
    entry: "Open Risk and run analysis, then inspect Cannon controls and status.",
    expectedOutcomes: [
      "Lifecycle, unavailable and failure states remain labelled and distinguishable",
      "Retained previous output is explicitly stale",
      "Reset and retry controls keep visible focus"
    ],
    announcements: ["One bounded lifecycle or failure outcome per explicit action"],
    scanCheckpoints: ["Risk", "Cannon"],
    manualSteps: [
      "Run Risk analysis and read its result",
      "Review Cannon status and reset feedback"
    ],
    linkedTests: ["risk.spec.ts", "calculation-lifecycle.spec.ts", "cannon-trip-loot.spec.ts"],
    exception: null
  },
  {
    id: "AT-08",
    journey: "Planner",
    fixture: "default planner draft and deterministic generated result",
    viewport: desktop,
    entry: "Open Planner, edit one target and compute the plan.",
    expectedOutcomes: [
      "Planner lifecycle and issues expose current versus retained state",
      "Charts have concise text alternatives and decision values in tables or summaries",
      "Issue actions move focus without mutating on navigation alone"
    ],
    announcements: ["Settled compute outcome and bounded issue count"],
    scanCheckpoints: ["Planner controls", "Planner output"],
    manualSteps: [
      "Compute a plan and read its summary/table",
      "Inspect chart description and issue actions"
    ],
    linkedTests: ["planner-duel.spec.ts", "calculation-lifecycle.spec.ts"],
    exception: null
  },
  {
    id: "AT-09",
    journey: "Economy",
    fixture: "committed static prices without live provider access",
    viewport: desktop,
    entry: "Open Economy and traverse snapshot, trend and manual-price controls.",
    expectedOutcomes: [
      "Price provenance, timestamps and manual state have meaningful names",
      "Trend charts have adjacent equivalent values",
      "PriceSet import and export review states remain labelled and bounded"
    ],
    announcements: ["Manual price and transfer actions each produce one primary outcome"],
    scanCheckpoints: ["Economy overview", "manual price validation"],
    manualSteps: ["Read provenance and trend values", "Trigger and correct a manual-price error"],
    linkedTests: [
      "integrations-economy.spec.ts",
      "shell-accessibility.spec.ts",
      "entity-label-collisions.spec.ts"
    ],
    exception: null
  },
  {
    id: "AT-10",
    journey: "Settings",
    fixture: "clean local storage plus a deterministic malformed-key fixture",
    viewport: desktop,
    entry: "Open Settings and traverse backup, restore and recovery regions.",
    expectedOutcomes: [
      "Backup and restore reviews explain included data and consequences",
      "Destructive confirmations use explicit native actions",
      "Blocked local data remains named without exposing raw content"
    ],
    announcements: ["Export, restore, clear and recovery outcomes are not duplicated globally"],
    scanCheckpoints: ["Settings", "local-state recovery review"],
    manualSteps: [
      "Review backup and restore controls",
      "Open and cancel one destructive confirmation"
    ],
    linkedTests: ["workspace-backup.spec.ts", "persistence-migration.spec.ts"],
    exception: null
  },
  {
    id: "AT-11",
    journey: "Hiscores",
    fixture: "deterministic unavailable and mocked-response provider states",
    viewport: desktop,
    entry: "Enter the top-bar Hiscores region and inspect its validation and preview states.",
    expectedOutcomes: [
      "Unavailable state and player validation remain visible and associated",
      "Lookup failure contains fixed privacy-safe copy",
      "Successful preview is a uniquely named table with explicit Apply"
    ],
    announcements: ["Lookup failure or successful preview readiness once per request"],
    scanCheckpoints: ["Hiscores unavailable", "Hiscores validation error"],
    manualSteps: [
      "Inspect unavailable and invalid-player states",
      "Review a fixture preview and Apply action"
    ],
    linkedTests: ["integrations-economy.spec.ts", "shell-accessibility.spec.ts"],
    exception: null
  },
  {
    id: "AT-12",
    journey: "Share and fatal recovery",
    fixture: "default setup, native Share dialog and deterministic invalid-share fixture",
    viewport: desktop,
    entry: "Invoke Share setup, traverse the modal and return to its trigger.",
    expectedOutcomes: [
      "The native modal has a programmatic name and description",
      "Initial focus, sequential containment, Escape/Close and focus return work",
      "Invalid share and safe-session recovery expose bounded privacy-safe errors"
    ],
    announcements: ["Share creation or invalid-share outcome without hidden background status"],
    scanCheckpoints: ["Share dialog", "safe-session recovery surface"],
    manualSteps: [
      "Open, traverse and close Share with keyboard only",
      "Read invalid-share and recovery guidance"
    ],
    linkedTests: ["shareable-setup.spec.ts", "persistence-migration.spec.ts"],
    exception: null
  }
] as const satisfies readonly AccessibilityJourney[];
