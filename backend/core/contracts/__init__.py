"""
backend/core/contracts/
------------------------
Shared DTOs, protocols, and base models that cross-domain code may import.

Rules:
  - contracts/ may NOT import from backend.domains.*
  - contracts/ may import from backend.core.* (except domains)
  - All cross-domain payloads must be defined here
"""
