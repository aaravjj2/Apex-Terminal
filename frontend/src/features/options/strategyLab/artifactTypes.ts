/**
 * Strategy Artifact types (v1.28 + v1.29 + v1.30)
 */

export interface StrategyArtifact {
  schema_version: number;
  id: string;
  checksum: string;
  name: string;
  type: string;
  version: string;
  spec: Record<string, unknown>;
  created_at: string;
  parent_id?: string | null;
  derived_from?: string | null;
}

export interface ValidationIssue {
  rule_id: string;
  message: string;
  path: string;
}

export interface ValidationReport {
  input_checksum: string;
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** v1.30: Diff change entry */
export interface DiffChange {
  path: string;
  op: 'added' | 'removed' | 'changed';
  left_value: unknown;
  right_value: unknown;
}

/** v1.30: Diff result between two artifacts */
export interface DiffResult {
  left_id: string;
  right_id: string;
  left_canonical: Record<string, unknown>;
  right_canonical: Record<string, unknown>;
  changes: DiffChange[];
  diff_hash: string;
}

/** v1.30: Lineage chain entry */
export interface LineageEntry {
  id: string;
  name: string;
  depth: number;
  created_at: string;
}
