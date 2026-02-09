# Parity & Verification 🔍

This project includes deterministic parity verification tools for ensuring generated bars match reference data.

## CanonicalExporter
- `export_csv(bars, path)` — export bars to a deterministic CSV format.
- `compute_hash(bars)` — returns a deterministic hash string prefixed with `sha256:`.
- Formatting rules: prices are formatted with up to 8 decimal places; volume is formatted with 2 decimals.

## BarComparator
- Usage: instantiate with `price_tolerance` and `volume_tolerance`.
- `load_reference_csv(path)` — parse canonical & TradingView formats into canonical dicts.
- `compare(local_bars, reference_bars)` — compare lists and return a `ParityReport` with diffs.
- `compare_with_reference(local_bars, reference_path)` — convenience wrapper that loads CSV then compares.

## CLI parity script
- `scripts/parity_compare.py` — compare `--csv` generated output with `--reference` CSV using a numeric `--tolerance`.

## Testing tips
- Make exports deterministic by sorting bars before exporting and using `CanonicalExporter` for both generated and reference datasets.
- Use `BarComparator`'s tolerances to allow floating numerics small differences.

---

If you'd like, I can also add a small example reference CSV and a test that runs parity_compare as part of CI.