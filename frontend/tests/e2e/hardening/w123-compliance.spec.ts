// Wave 123 — Submission compliance: all required docs present.
import { test, expect } from '@playwright/test';
import { existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WORKSPACE = join(__dirname, '..', '..', '..', '..');

const REQUIRED = [
  'README.md',
  'docs/ops/SLO.md',
  'docs/ops/TROUBLESHOOTING.md',
  'docs/ops/RESET.md',
  'docs/ops/JUDGE_MODE.md',
  'docs/ONBOARDING.md',
  'docs/submission/TERRACODE_DEMO_SCRIPT.md',
  'docs/submission/ELASTIHACK_DEMO_SCRIPT.md',
  'scripts/check_submission_compliance.py',
  'scripts/generate_submission_bundle.py',
  'scripts/check_secrets.py',
];

for (const rel of REQUIRED) {
  test(`w123 required file: ${rel}`, async () => {
    expect(existsSync(join(WORKSPACE, rel))).toBe(true);
  });
}
