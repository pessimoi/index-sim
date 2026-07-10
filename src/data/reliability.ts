export type DataReliabilityErrorCode = "duplicate_ids" | "duplicate_keys" | "invalid_json";

export interface DataReliabilityIssue {
  path: string;
  message: string;
}

export class DataReliabilityError extends Error {
  readonly code: DataReliabilityErrorCode;
  readonly issues: string[];

  constructor(code: DataReliabilityErrorCode, message: string, issues: string[] = []) {
    super(message);
    this.name = "DataReliabilityError";
    this.code = code;
    this.issues = issues;
  }
}

export interface DuplicateJsonKeyFinding {
  key: string;
  path: string;
  firstOffset: number;
  secondOffset: number;
}

interface StringToken {
  value: string;
  start: number;
}

function byteLength(text: string): number {
  return new TextEncoder().encode(text).byteLength;
}

function safeSegment(segment: string): string {
  return /^[A-Za-z0-9_$-]+$/.test(segment) ? segment : JSON.stringify(segment);
}

function childPath(parent: string, segment: string): string {
  const safe = safeSegment(segment);
  return parent ? `${parent}.${safe}` : safe;
}

function arrayPath(parent: string, index: number): string {
  return `${parent || "<root>"}[${index}]`;
}

class JsonDuplicateKeyScanner {
  private readonly findings: DuplicateJsonKeyFinding[] = [];
  private pos = 0;

  constructor(private readonly text: string) {}

  scan(): DuplicateJsonKeyFinding[] {
    this.skipWhitespace();
    this.parseValue("");
    this.skipWhitespace();
    if (this.pos !== this.text.length) this.syntaxError();
    return this.findings;
  }

  private parseValue(path: string): void {
    this.skipWhitespace();
    const char = this.text[this.pos];
    if (char === "{") {
      this.parseObject(path);
      return;
    }
    if (char === "[") {
      this.parseArray(path);
      return;
    }
    if (char === '"') {
      this.readString();
      return;
    }
    if (char === "-" || (char >= "0" && char <= "9")) {
      this.readNumber();
      return;
    }
    if (this.text.startsWith("true", this.pos)) {
      this.pos += 4;
      return;
    }
    if (this.text.startsWith("false", this.pos)) {
      this.pos += 5;
      return;
    }
    if (this.text.startsWith("null", this.pos)) {
      this.pos += 4;
      return;
    }
    this.syntaxError();
  }

  private parseObject(path: string): void {
    this.pos += 1;
    const seen = new Map<string, number>();
    this.skipWhitespace();
    if (this.text[this.pos] === "}") {
      this.pos += 1;
      return;
    }

    while (this.pos < this.text.length) {
      this.skipWhitespace();
      const key = this.readString();
      this.skipWhitespace();
      if (this.text[this.pos] !== ":") this.syntaxError();
      this.pos += 1;

      const previousOffset = seen.get(key.value);
      if (previousOffset !== undefined) {
        this.findings.push({
          key: key.value,
          path: childPath(path, key.value),
          firstOffset: previousOffset,
          secondOffset: key.start
        });
      } else {
        seen.set(key.value, key.start);
      }

      this.parseValue(childPath(path, key.value));
      this.skipWhitespace();
      const separator = this.text[this.pos];
      if (separator === "}") {
        this.pos += 1;
        return;
      }
      if (separator !== ",") this.syntaxError();
      this.pos += 1;
    }

    this.syntaxError();
  }

  private parseArray(path: string): void {
    this.pos += 1;
    this.skipWhitespace();
    if (this.text[this.pos] === "]") {
      this.pos += 1;
      return;
    }

    let index = 0;
    while (this.pos < this.text.length) {
      this.parseValue(arrayPath(path, index));
      index += 1;
      this.skipWhitespace();
      const separator = this.text[this.pos];
      if (separator === "]") {
        this.pos += 1;
        return;
      }
      if (separator !== ",") this.syntaxError();
      this.pos += 1;
    }

    this.syntaxError();
  }

  private readString(): StringToken {
    if (this.text[this.pos] !== '"') this.syntaxError();
    const start = this.pos;
    this.pos += 1;

    while (this.pos < this.text.length) {
      const char = this.text[this.pos];
      if (char === '"') {
        this.pos += 1;
        try {
          return { value: JSON.parse(this.text.slice(start, this.pos)) as string, start };
        } catch {
          this.syntaxError();
        }
      }
      if (char === "\\") {
        this.pos += 2;
        continue;
      }
      this.pos += 1;
    }

    this.syntaxError();
  }

  private readNumber(): void {
    while (this.pos < this.text.length && /[-+0-9.eE]/.test(this.text[this.pos] ?? "")) {
      this.pos += 1;
    }
  }

  private skipWhitespace(): void {
    while (this.pos < this.text.length && /\s/.test(this.text[this.pos] ?? "")) this.pos += 1;
  }

  private syntaxError(): never {
    throw new DataReliabilityError("invalid_json", "JSON input is not valid");
  }
}

export function findDuplicateJsonKeys(jsonText: string): DuplicateJsonKeyFinding[] {
  return new JsonDuplicateKeyScanner(jsonText).scan();
}

export function assertNoDuplicateJsonKeys(
  jsonText: string,
  options: { source?: string } = {}
): void {
  const source = options.source ?? "JSON input";
  const findings = findDuplicateJsonKeys(jsonText);
  if (!findings.length) return;

  throw new DataReliabilityError(
    "duplicate_keys",
    `${source} contains duplicate JSON keys`,
    findings.map((finding) => `duplicate key '${finding.key}' at ${finding.path}`)
  );
}

export function parseJsonWithDuplicateKeyCheck(
  jsonText: string,
  options: { maxBytes?: number; source?: string } = {}
): unknown {
  const maxBytes = options.maxBytes;
  if (maxBytes !== undefined && byteLength(jsonText) > maxBytes) {
    throw new DataReliabilityError(
      "invalid_json",
      `${options.source ?? "JSON input"} exceeds ${maxBytes} bytes`
    );
  }

  assertNoDuplicateJsonKeys(jsonText, options);
  try {
    return JSON.parse(jsonText) as unknown;
  } catch {
    throw new DataReliabilityError("invalid_json", "JSON input is not valid");
  }
}

export function assertUniqueRecordIds(
  records: readonly Record<string, unknown>[],
  options: { field?: string; label?: string } = {}
): void {
  const field = options.field ?? "id";
  const label = options.label ?? "records";
  const seen = new Map<string, number>();
  const issues: string[] = [];

  records.forEach((record, index) => {
    const value = record[field];
    if (typeof value !== "string" || value.length === 0) return;
    const previous = seen.get(value);
    if (previous !== undefined) {
      issues.push(`${label}[${index}] duplicates ${label}[${previous}] id '${value}'`);
    } else {
      seen.set(value, index);
    }
  });

  if (issues.length) {
    throw new DataReliabilityError(
      "duplicate_ids",
      `${label} contain duplicate '${field}' values`,
      issues
    );
  }
}
