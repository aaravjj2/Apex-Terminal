"""
backend/domains/
-----------------
Domain packages.  Each domain is self-contained:
  - models.py   — persistence models / pydantic schemas
  - routes.py   — FastAPI router registered in main.py
  - service.py  — domain business logic (optional)

Cross-domain communication MUST go through backend.core.contracts,
never through direct imports between domains.

Allowed import graph (strict):
  domain/* → backend.core.contracts   ✓
  domain/* → backend.core.*          ✓
  domain_A → domain_B                ✗  (boundary violation)
"""
