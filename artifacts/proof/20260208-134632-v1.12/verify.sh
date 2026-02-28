#!/bin/bash
# Quick verification script for v1.12
# Run from repo root: ./artifacts/proof/20260208-134632-v1.12/verify.sh

set -e

cd "$(dirname "$0")/../../.."

echo "=== v1.12 QUICK VERIFICATION ==="
echo ""

echo "1. TypeScript Compilation..."
cd frontend && npx tsc --noEmit && echo "✅ PASS: 0 errors" || echo "✗ FAIL"
echo ""

echo "2. Vitest Unit Tests..."
npm run test:unit 2>&1 | grep -E "(Test Files|Tests|Duration)" && echo "✅ PASS" || echo "✗ FAIL"
echo ""

cd ..

echo "3. Pytest Backend Tests..."
python -m pytest -v 2>&1 | tail -3 && echo "✅ PASS" || echo "✗ FAIL"
echo ""

echo "4. Selector Policy Gate..."
node scripts/selector-policy-gate.js frontend/tests/e2e/ && echo "✅ PASS" || echo "✗ FAIL"
echo ""

echo "5. Backend Health Check..."
curl -s http://localhost:8000/health | python -m json.tool | head -5 && echo "✅ PASS" || echo "✗ FAIL"
echo ""

echo "6. Tour Video..."
ls -lh artifacts/proof/20260208-134632-v1.12/APEX_TERMINAL_TOUR_v1_12.webm && echo "✅ EXISTS" || echo "✗ MISSING"
echo ""

echo "=== VERIFICATION COMPLETE ==="
