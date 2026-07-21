// @vitest-environment jsdom

import { requestJsonDownload } from "../adapters/browser";

describe("browser JSON download request", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    document.body.replaceChildren();
  });

  it("clicks one connected hidden anchor and revokes its exact pretty JSON URL later", async () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn((blob: Blob) => {
      expect(blob).toBeInstanceOf(Blob);
      return "blob:fixture-download";
    });
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const trigger = document.createElement("button");
    document.body.appendChild(trigger);
    trigger.focus();
    const clickedAnchors: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (
      this: HTMLAnchorElement
    ) {
      clickedAnchors.push(this);
      expect(this.isConnected).toBe(true);
      document.body.tabIndex = -1;
      document.body.focus();
      expect(document.activeElement).toBe(document.body);
    });

    const result = requestJsonDownload("fixture.json", { nested: { value: "ä" } });

    expect(result).toEqual({
      status: "requested",
      fileName: "fixture.json",
      byteLength: new TextEncoder().encode('{\n  "nested": {\n    "value": "ä"\n  }\n}').byteLength
    });
    expect(Object.isFrozen(result)).toBe(true);
    expect(createObjectURL).toHaveBeenCalledOnce();
    const blob = createObjectURL.mock.calls[0]![0];
    expect(blob.type).toBe("application/json");
    expect(await blob.text()).toBe('{\n  "nested": {\n    "value": "ä"\n  }\n}');
    const clickedAnchor = clickedAnchors[0]!;
    expect(clickedAnchor).toMatchObject({
      download: "fixture.json",
      rel: "noopener",
      tabIndex: -1,
      hidden: true
    });
    expect(clickedAnchor.isConnected).toBe(false);
    expect(document.activeElement).toBe(trigger);
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.runOnlyPendingTimers();
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:fixture-download");
    expect(JSON.stringify(result)).not.toContain("blob:fixture-download");
    expect(JSON.stringify(result)).not.toContain("nested");
  });

  it("classifies serialization failure before creating browser resources", () => {
    const createObjectURL = vi.fn();
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });
    const cyclic: { self?: unknown } = {};
    cyclic.self = cyclic;

    expect(requestJsonDownload("cyclic.json", cyclic)).toEqual({
      status: "failed",
      reason: "serialization"
    });
    expect(createObjectURL).not.toHaveBeenCalled();
    expect(document.body.childElementCount).toBe(0);
  });

  it("classifies unavailable and throwing object URL APIs without leaking errors", () => {
    vi.stubGlobal("URL", {});
    expect(requestJsonDownload("missing.json", {})).toEqual({
      status: "failed",
      reason: "browser-api"
    });

    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: () => {
        throw new Error("private URL failure");
      },
      revokeObjectURL
    });
    const result = requestJsonDownload("throwing.json", {});
    expect(result).toEqual({ status: "failed", reason: "browser-api" });
    expect(JSON.stringify(result)).not.toContain("private URL failure");
    expect(revokeObjectURL).not.toHaveBeenCalled();
  });

  it.each(["append", "click"] as const)(
    "classifies %s failure as dispatch and keeps delayed URL cleanup bounded",
    (failure) => {
      vi.useFakeTimers();
      const revokeObjectURL = vi.fn();
      vi.stubGlobal("URL", {
        createObjectURL: () => `blob:${failure}`,
        revokeObjectURL
      });
      if (failure === "append") {
        vi.spyOn(document.body, "appendChild").mockImplementation(() => {
          throw new Error("private append failure");
        });
      } else {
        vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {
          throw new Error("private click failure");
        });
      }

      const result = requestJsonDownload(`${failure}.json`, { failure });

      expect(result).toEqual({ status: "failed", reason: "dispatch" });
      expect(document.body.childElementCount).toBe(0);
      expect(revokeObjectURL).not.toHaveBeenCalled();
      expect(JSON.stringify(result)).not.toContain(`private ${failure} failure`);
      vi.runOnlyPendingTimers();
      expect(revokeObjectURL).toHaveBeenCalledTimes(1);
      expect(revokeObjectURL).toHaveBeenCalledWith(`blob:${failure}`);
    }
  );
});
