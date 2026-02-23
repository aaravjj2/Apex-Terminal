# Apex Terminal — Architecture

## System Architecture

```mermaid
graph TD
    subgraph Client["Browser (localhost:5100)"]
        UI["React + TypeScript\nVite Frontend\nUI2 Component Library"]
    end

    subgraph Backend["FastAPI Backend (localhost:8090)"]
        API["FastAPI\nPython 3.14"]
        A11Y["W104\nA11y Audit\n/api/v3/a11y"]
        PERF["W105\nPerf Budget\n/api/v3/perf"]
        CTRL["W106\nControls Domain\n/api/v3/controls"]
        SAFE["W107\nSafe Actions\n/api/v3/tickets"]
        EXPORT["W108\nExport Bundle\n/api/v3/export"]
    end

    subgraph Storage["Storage Layer"]
        SQLITE[("SQLite\nbars.db\ntickets, audit, controls")]
        ES[("Elasticsearch 8\nlocalhost:9200\napex-tickets\napex-controls-*\napex-perf-budget")]
    end

    subgraph AI["AI Layer"]
        GROQ["Groq\ncompound-beta\nReasoning + Explanation"]
        GEMINI["Gemini\nflash\nFallback LLM"]
        AGENT["Elastic\nAgent Builder\nES Query + LLM Chain"]
    end

    subgraph Infra["Infrastructure"]
        PG[("PostgreSQL 15\nlocalhost:5432")]
        KIBANA["Kibana\nlocalhost:5601\nES Visualisation"]
        DOCKER["docker-compose.judge.yml\nOne-command startup"]
    end

    UI -->|"REST + WS"| API
    API --> A11Y & PERF & CTRL & SAFE & EXPORT
    A11Y & PERF & CTRL & SAFE --> SQLITE
    CTRL & SAFE & EXPORT --> ES
    SAFE --> GROQ --> AGENT --> ES
    GROQ --> GEMINI
    ES --- KIBANA
    DOCKER -.->|"starts"| Backend & ES & PG & KIBANA
```

## Data Flow: Safe Action (Key Demo)

```mermaid
sequenceDiagram
    participant U as User (Browser)
    participant API as FastAPI Backend
    participant RBAC as RBAC Gate
    participant ES as Elasticsearch
    participant DB as SQLite
    participant AI as Groq AI Agent

    U->>API: POST /api/v3/tickets/tickets {title, role}
    API->>RBAC: check role in {admin, agent, auditor}
    RBAC-->>API: allowed / blocked
    API->>ES: search apex-tickets for duplicates
    ES-->>API: hits=0 (no duplicate)
    API->>AI: reason about compliance context
    AI->>ES: query apex-controls-* for domain context
    ES-->>AI: control nodes + rules
    AI-->>API: justification text
    API->>DB: INSERT INTO tickets + ticket_audit_events
    API->>ES: POST apex-tickets/_doc (refresh=true)
    API-->>U: 201 {ticket_id, audit_event_id, justification}
```

## Export Bundle Flow

```mermaid
sequenceDiagram
    participant J as Judge
    participant API as FastAPI Backend
    participant ES as Elasticsearch
    participant DB as SQLite

    J->>API: POST /api/v3/export/bundle
    API->>DB: SELECT * FROM tickets, controls, audit_events...
    DB-->>API: sorted rows (deterministic)
    API->>ES: GET index templates for apex-* indices
    ES-->>API: templates + settings
    API->>API: SHA256(README + db_tables + es_templates)
    API->>API: bundle_hash = SHA256(sorted file hashes)
    API->>API: ZIP all files + manifest.json
    API-->>J: 201 {filename, manifest, bundle_hash}

    J->>API: GET /api/v3/export/bundle/download
    API-->>J: ZIP binary (header: X-Bundle-Hash)
```

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| SQLite + ES dual-write | SQLite for ACID durability; ES for real-time search |
| `refresh=true` on ES writes | Test determinism without sleep() |
| Deterministic export bundle | Judges can verify integrity without trusting timestamps |
| RBAC via request header | Stateless, testable, auditable |
| `data-testid` only in E2E | Resistant to UI refactors; MCP-compliant |
