export type ReleaseCommand = "quality" | "handoff" | "dry-run" | "preview" | "deploy";

export interface NodeReleaseStage {
  readonly id: string;
  readonly kind: "node";
  readonly modulePath: string;
  readonly args: readonly string[];
}

export interface ProcessReleaseStage {
  readonly id: string;
  readonly kind: "process";
  readonly executable: string;
  readonly args: readonly string[];
}

export interface AuditReleaseStage {
  readonly id: "dependency-audit";
  readonly kind: "npm-audit";
}

export type ReleaseStage = NodeReleaseStage | ProcessReleaseStage | AuditReleaseStage;

export const releaseCommands: readonly ReleaseCommand[];
export function getReleasePlan(command: ReleaseCommand): readonly ReleaseStage[];
export function traceReleasePlan(command: ReleaseCommand): string[];
