# v1.13 Market Data Canonicalization Rules

1. Remove `provenance.fetched_at` (timestamp non-deterministic in LOCAL mode)
2. Round `price` to 2 decimal places (floating point normalization)
3. Preserve `provenance.cache_key` (must be deterministic)
4. Preserve `provenance.source` (must be deterministic)
5. Preserve `provenance.checksum` (must be deterministic)
6. In DEMO mode, all fields except fetched_at are deterministic
