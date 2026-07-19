// @vitest-environment jsdom

import { act, useState, type Dispatch, type SetStateAction } from "react";
import { createRoot, type Root } from "react-dom/client";
import { DecimalField, NumberField, OptionalNumberField } from "../app/components/form-fields";

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT =
  true;

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

function input(): HTMLInputElement {
  const element = container.querySelector("input");
  if (!(element instanceof HTMLInputElement)) throw new Error("Missing numeric input");
  return element;
}

function focus(element: HTMLInputElement): void {
  act(() => element.dispatchEvent(new FocusEvent("focusin", { bubbles: true })));
}

function blur(element: HTMLInputElement): void {
  act(() => element.dispatchEvent(new FocusEvent("focusout", { bubbles: true })));
}

function typeDraft(element: HTMLInputElement, value: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  if (!setter) throw new Error("Missing HTMLInputElement value setter");
  act(() => {
    setter.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function key(element: HTMLInputElement, value: string): void {
  act(() => element.dispatchEvent(new KeyboardEvent("keydown", { key: value, bubbles: true })));
}

describe("shared numeric draft fields", () => {
  it("keeps required drafts literal, marks invalid blur and canonicalizes without duplicate emit", () => {
    const changes: number[] = [];
    act(() => {
      root.render(
        <NumberField
          label="Fixture level"
          value={10}
          min={1}
          max={99}
          description="Whole level from 1 to 99."
          onChange={(value) => changes.push(value)}
        />
      );
    });
    const field = input();
    focus(field);
    typeDraft(field, "");
    expect(field.value).toBe("");
    expect(changes).toEqual([]);
    expect(field.hasAttribute("aria-invalid")).toBe(false);

    blur(field);
    expect(field.value).toBe("");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Not applied — enter a value from 1 to 99.");
    expect(field.getAttribute("aria-describedby")?.split(" ")).toHaveLength(2);

    focus(field);
    typeDraft(field, "0012");
    expect(field.value).toBe("0012");
    expect(changes).toEqual([12]);
    key(field, "Enter");
    expect(field.value).toBe("12");
    expect(changes).toEqual([12]);

    typeDraft(field, "12.5");
    expect(field.value).toBe("12.5");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(changes).toEqual([12]);
    key(field, "Escape");
    expect(field.value).toBe("10");
    expect(field.hasAttribute("aria-invalid")).toBe(false);
  });

  it("preserves decimal transitions and trailing zeros but never rounds an off-step draft", () => {
    const changes: number[] = [];
    act(() => {
      root.render(
        <DecimalField
          label="Fixture decimal"
          value={0}
          min={0}
          max={10}
          step={0.05}
          onChange={(value) => changes.push(value)}
        />
      );
    });
    const field = input();
    focus(field);
    typeDraft(field, "1.");
    expect(field.value).toBe("1.");
    expect(changes).toEqual([]);
    expect(field.hasAttribute("aria-invalid")).toBe(false);

    typeDraft(field, "0.50");
    expect(field.value).toBe("0.50");
    expect(changes).toEqual([0.5]);
    key(field, "Enter");
    expect(field.value).toBe("0.5");
    expect(changes).toEqual([0.5]);

    typeDraft(field, "0.53");
    expect(field.value).toBe("0.53");
    expect(field.getAttribute("aria-invalid")).toBe("true");
    expect(container.textContent).toContain("Not applied — use increments of 0.05.");
    expect(changes).toEqual([0.5]);
  });

  it("delays optional empty until commit and keeps Reset immediate without duplicate callbacks", () => {
    const changes: Array<number | null> = [];
    act(() => {
      root.render(
        <OptionalNumberField
          label="Fixture optional"
          value={5}
          min={0}
          max={10}
          onChange={(value) => changes.push(value)}
        />
      );
    });
    const field = input();
    focus(field);
    typeDraft(field, "");
    expect(changes).toEqual([]);
    blur(field);
    expect(changes).toEqual([null]);
    expect(field.value).toBe("");

    const reset = container.querySelector("button");
    if (!(reset instanceof HTMLButtonElement)) throw new Error("Missing Reset button");
    act(() => reset.click());
    expect(changes).toEqual([null]);
  });

  it("replaces a focused stale draft when an external action supplies a different value", () => {
    let setValue!: Dispatch<SetStateAction<number>>;
    function Harness() {
      const [value, updateValue] = useState(10);
      setValue = updateValue;
      return <NumberField label="External fixture" value={value} onChange={updateValue} />;
    }
    act(() => root.render(<Harness />));
    const field = input();
    focus(field);
    typeDraft(field, "broken");
    expect(field.getAttribute("aria-invalid")).toBe("true");

    act(() => setValue(77));
    expect(field.value).toBe("77");
    expect(field.hasAttribute("aria-invalid")).toBe(false);
    expect(container.querySelector('[role="status"]')?.textContent).toBe(
      "Value updated by another action."
    );
    blur(field);
    expect(field.value).toBe("77");
  });
});
