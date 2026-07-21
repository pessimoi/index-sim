// @vitest-environment jsdom

import { act, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { SearchableSelectField } from "../app/components/form-fields";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: () => undefined
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.useRealTimers();
});

function key(element: HTMLElement, value: string): void {
  act(() => element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
}

function typeSearch(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Missing HTMLInputElement value setter");
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function renderFixture(onChange: (value: string) => void = () => undefined): void {
  function Harness() {
    const [value, setValue] = useState("bronze_sword");
    return (
      <>
        <SearchableSelectField
          label="Weapon"
          value={value}
          options={[
            { id: "bronze_sword", label: "Bronze sword", hint: "Slash" },
            { id: "iron_sword", label: "Iron sword", hint: "Slash" },
            { id: "oak_staff", label: "Oak staff", hint: "Magic" }
          ]}
          onChange={(nextValue) => {
            setValue(nextValue);
            onChange(nextValue);
          }}
        />
        <button type="button">After field</button>
      </>
    );
  }

  act(() => root.render(<Harness />));
}

function renderCollisionFixture(onChange: (value: string) => void): void {
  function Harness() {
    const [value, setValue] = useState("loop_half_key");
    return (
      <SearchableSelectField
        label="Item"
        value={value}
        options={[
          {
            id: "loop_half_key",
            label: "Half of a key — loop half",
            accessibleLabel: "Half of a key — loop half",
            hint: "Key half"
          },
          {
            id: "tooth_half_key",
            label: "Half of a key — tooth half",
            accessibleLabel: "Half of a key — tooth half",
            hint: "Key half"
          },
          {
            id: "dragonhide_black",
            label: "Dragonhide — black",
            accessibleLabel: "Dragonhide — black"
          }
        ]}
        onChange={(nextValue) => {
          setValue(nextValue);
          onChange(nextValue);
        }}
      />
    );
  }
  act(() => root.render(<Harness />));
}

function trigger(): HTMLButtonElement {
  const element = container.querySelector(".searchable-combobox-trigger");
  if (!(element instanceof HTMLButtonElement)) throw new Error("Missing searchable trigger");
  return element;
}

function input(): HTMLInputElement {
  const element = container.querySelector('input[role="combobox"]');
  if (!(element instanceof HTMLInputElement)) throw new Error("Missing searchable input");
  return element;
}

describe("SearchableSelectField accessibility contract", () => {
  it("uses a native closed trigger and gives the focused search input the combobox contract", () => {
    renderFixture();

    const button = trigger();
    expect(button.getAttribute("role")).toBeNull();
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(button.getAttribute("aria-haspopup")).toBe("listbox");
    expect(button.getAttribute("aria-controls")).toBeTruthy();
    const descriptionId = button.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toBe("Bronze sword");
    expect(container.querySelector('[role="combobox"]')).toBeNull();

    act(() => button.click());

    const search = input();
    expect(document.activeElement).toBe(search);
    expect(search.getAttribute("aria-expanded")).toBe("true");
    expect(search.getAttribute("aria-autocomplete")).toBe("list");
    expect(search.getAttribute("aria-controls")).toBe(button.getAttribute("aria-controls"));
    const activeId = search.getAttribute("aria-activedescendant");
    expect(activeId).toBeTruthy();
    expect(document.getElementById(activeId!)?.getAttribute("role")).toBe("option");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(3);
    for (const option of container.querySelectorAll<HTMLElement>('[role="option"]')) {
      expect(option.tabIndex).toBe(-1);
    }
  });

  it("keeps DOM focus on the input, commits the active descendant and restores trigger focus", () => {
    const changes: string[] = [];
    renderFixture((value) => changes.push(value));
    const button = trigger();
    act(() => button.click());
    const search = input();

    key(search, "End");
    expect(document.activeElement).toBe(search);
    expect(
      document.getElementById(search.getAttribute("aria-activedescendant")!)?.textContent
    ).toContain("Oak staff");
    key(search, "Enter");

    expect(changes).toEqual(["oak_staff"]);
    expect(button.dataset.selectedId).toBe("oak_staff");
    expect(document.activeElement).toBe(button);
    expect(container.querySelector('[role="listbox"]')).toBeNull();

    act(() => button.click());
    key(input(), "Escape");
    expect(document.activeElement).toBe(button);
    expect(container.querySelector('[role="combobox"]')).toBeNull();
  });

  it("announces one settled result count and exposes a related zero-result state", () => {
    vi.useFakeTimers();
    const changes: string[] = [];
    renderFixture((value) => changes.push(value));
    act(() => trigger().click());
    const search = input();
    const status = container.querySelector('[role="status"]');
    expect(status?.textContent).toBe("3 of 3 options");

    typeSearch(search, "missing fixture");
    expect(search.hasAttribute("aria-activedescendant")).toBe(false);
    expect(container.textContent).toContain("No matching options");
    const describedBy = search.getAttribute("aria-describedby")?.split(" ") ?? [];
    expect(describedBy).toHaveLength(2);
    expect(describedBy.every((id) => document.getElementById(id))).toBe(true);
    expect(status?.textContent).toBe("3 of 3 options");

    act(() => vi.advanceTimersByTime(200));
    expect(status?.textContent).toBe("0 of 3 options");
    key(search, "Enter");
    expect(changes).toEqual([]);
    expect(document.activeElement).toBe(search);
  });

  it("keeps colliding visible and accessible option names unique and searchable by every identity", () => {
    const changes: string[] = [];
    renderCollisionFixture((value) => changes.push(value));
    expect(trigger().textContent).toContain("Half of a key — loop half");

    act(() => trigger().click());
    const names = [...container.querySelectorAll<HTMLElement>('[role="option"]')].map((option) =>
      option.getAttribute("aria-label")
    );
    expect(names).toEqual([
      "Half of a key — loop half",
      "Half of a key — tooth half",
      "Dragonhide — black"
    ]);
    expect(new Set(names).size).toBe(names.length);
    expect(container.querySelector(".searchable-combobox-option small")?.textContent).toBe(
      "Key half"
    );

    typeSearch(input(), "tooth half");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    key(input(), "Enter");
    expect(changes).toEqual(["tooth_half_key"]);
    expect(trigger().dataset.selectedId).toBe("tooth_half_key");

    act(() => trigger().click());
    typeSearch(input(), "dragonhide_black");
    expect(container.querySelectorAll('[role="option"]')).toHaveLength(1);
    key(input(), "Enter");
    expect(changes).toEqual(["tooth_half_key", "dragonhide_black"]);
  });
});
