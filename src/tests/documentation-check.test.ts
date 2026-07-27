import {
  checkDocumentation,
  parseDocumentationMetadata
} from "../../scripts/documentation-check-core";

const validMetadata = `# Example specification

- Status: implemented
- Date: 2026-07-27
- Owner: technical documentation
- Evidence: verified
- Contract: closed

## Purpose
`;

describe("documentation metadata", () => {
  it("parses the bounded canonical block", () => {
    expect(parseDocumentationMetadata("docs/technical/example-spec.md", validMetadata)).toEqual({
      diagnostics: [],
      metadata: {
        status: "implemented",
        date: "2026-07-27",
        owner: "technical documentation",
        evidence: "verified",
        contract: "closed"
      }
    });
  });

  it("reports missing, duplicate, malformed and impossible metadata", () => {
    const parsed = parseDocumentationMetadata(
      "docs/technical/example-spec.md",
      `# Example

- Status: generated
- Status: surprise
- Date: 27-07-2026
- Owner: ---
- Evidence: maybe
`
    );
    expect(parsed.diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining([
        "metadata-duplicate",
        "metadata-date",
        "metadata-owner",
        "metadata-evidence",
        "metadata-contract",
        "metadata-generated"
      ])
    );
  });

  it("requires a named replacement for superseded documents", () => {
    const parsed = parseDocumentationMetadata(
      "docs/project/example-spec.md",
      `# Example

- Status: superseded
- Date: 2026-07-27
- Owner: project documentation
`
    );
    expect(parsed.diagnostics).toContainEqual(
      expect.objectContaining({ code: "metadata-superseded" })
    );
  });
});

describe("documentation consistency", () => {
  function fixture(extraFiles: Readonly<Record<string, string>> = {}) {
    return {
      "docs/README.md": `# Documentation

- [Technical](technical/README.md)
`,
      "docs/technical/README.md": `# Technical

- [Catalog](specifications.md)
- [Example](example-spec.md)
`,
      "docs/technical/specifications.md": `# Specifications

## Implemented evidence

- [Example](example-spec.md) — status=\`implemented\`; contract=\`closed\`; owner=technical documentation; date=2026-07-27
`,
      "docs/technical/example-spec.md": validMetadata,
      ...extraFiles
    };
  }

  it("accepts valid links, commands, reachability and catalog metadata", () => {
    const result = checkDocumentation({ files: fixture(), packageScripts: new Set() });
    expect(result.diagnostics).toEqual([]);
    expect(result.reachability.get("docs/technical/example-spec.md")).toBe(2);
  });

  it("reports broken files, anchors and npm scripts", () => {
    const files = fixture({
      "docs/technical/README.md": `# Technical

- [Catalog](specifications.md)
- [Broken](missing.md)
- [Anchor](example-spec.md#missing-heading)

Run \`npm run absent\`.
`,
      "docs/technical/orphan.md": "# Orphan\n"
    });
    const result = checkDocumentation({ files, packageScripts: new Set() });
    expect(result.diagnostics.map((entry) => entry.code)).toEqual(
      expect.arrayContaining(["link-file", "link-anchor", "npm-command", "navigation-unreachable"])
    );
  });

  it("reports duplicate or conflicting specification catalog entries", () => {
    const files = fixture({
      "docs/technical/specifications.md": `# Specifications

## Active contracts

- [Example](example-spec.md) — status=\`active\`; contract=\`living\`
- [Example again](example-spec.md) — status=\`active\`; contract=\`living\`
`
    });
    const result = checkDocumentation({ files, packageScripts: new Set() });
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "catalog-duplicate" })
    );
  });

  it("keeps volatile evidence out of configured living owners", () => {
    const files = fixture({
      "docs/technical/architecture.md": `# Architecture

The graph has 178 source modules and SHA-256 abcdefabcdefabcdefabcdefabcdefabcdefabcdef.
`,
      "docs/technical/README.md": `# Technical

- [Catalog](specifications.md)
- [Example](example-spec.md)
- [Architecture](architecture.md)
`
    });
    const result = checkDocumentation({ files, packageScripts: new Set() });
    expect(result.diagnostics.filter((entry) => entry.code === "volatile-fact")).toHaveLength(1);
  });
});
