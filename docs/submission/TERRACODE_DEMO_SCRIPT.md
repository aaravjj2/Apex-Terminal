# TerraCode Demo Script

**Duration:** 2–3 minutes  
**Goal:** Showcase innovation, UX quality, and technical depth

---

## Scene 1 — System overview (0:00–0:20)

1. Open browser at `http://localhost:5100/ui2/dashboard`
2. Point out the live WebSocket connection indicator
3. Show the real-time health status

**Talking points:** "Apex Terminal is a full-stack algorithmic trading operations platform with live ES indexing, audit trails, and persistent E2E gates."

---

## Scene 2 — Safe Actions (tickets) (0:20–0:50)

1. Navigate to `http://localhost:5100/ui2/safe-actions`
2. Demonstrate creating a ticket (title, role selection)
3. Show the audit trail populating automatically
4. Point out ES search integration in the Ticket Search box

**Talking points:** "Every action creates an immutable audit event chain, backed by ES for full-text search."

---

## Scene 3 — Controls Domain (0:50–1:20)

1. Navigate to `http://localhost:5100/ui2/controls-domain`
2. Submit an AP/AR control document
3. Show it indexed in real time
4. Demonstrate the reconciliation view

**Talking points:** "The controls domain enforces financial compliance with zero manual overhead."

---

## Scene 4 — Export Bundle (1:20–1:50)

1. Navigate to `http://localhost:5100/ui2/export-bundle`
2. Click Generate Bundle
3. Show the manifest with SHA-256 hashes
4. Download and inspect the zip

**Talking points:** "Cryptographic export manifests ensure integrity for every data transfer."

---

## Scene 5 — E2E proof (1:50–2:30)

1. Open terminal: `npx playwright test tests/e2e/hardening/ --headed --workers=1`
2. Watch tests pass in headed browser mode
3. Show the playwright-report with 500+ passing tests

**Talking points:** "550+ deterministic E2E tests, zero flakes, zero skipped."

---

## Closing (2:30–3:00)

- Show `docs/ARCHITECTURE.md` Mermaid diagram
- Open `http://localhost:5601` (Kibana) showing indexed documents
- Close with: "Production-grade ops platform — built and tested end to end."
