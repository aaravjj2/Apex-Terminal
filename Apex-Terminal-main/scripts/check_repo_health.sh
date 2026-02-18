#!/bin/bash
# Repository health check script
# Run this before submitting to ensure repo is clean

set -e
cd "$(dirname "$0")/.."

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "  Repository Health Check"
echo "======================================"
echo ""

ERRORS=0
WARNINGS=0

# Check 1: No secrets tracked
echo -n "Checking for tracked secrets files... "
secrets_tracked=$(git ls-files | grep -E "^keys\.env$|phase1/keys\.env$" | head -1 || true)
if [ -n "$secrets_tracked" ]; then
    echo -e "${RED}FAIL${NC}"
    echo "  Found: $secrets_tracked"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 2: No node_modules tracked
echo -n "Checking for tracked node_modules... "
node_tracked=$(git ls-files | grep "node_modules/" | head -1 || true)
if [ -n "$node_tracked" ]; then
    echo -e "${RED}FAIL${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 3: No venv tracked
echo -n "Checking for tracked venv... "
venv_tracked=$(git ls-files | grep -E "venv/|\.venv/" | head -1 || true)
if [ -n "$venv_tracked" ]; then
    echo -e "${RED}FAIL${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 4: No db files tracked
echo -n "Checking for tracked database files... "
db_tracked=$(git ls-files | grep -E "\.db$|\.sqlite$" | head -1 || true)
if [ -n "$db_tracked" ]; then
    echo -e "${RED}FAIL${NC}"
    ERRORS=$((ERRORS + 1))
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 5: No log files tracked
echo -n "Checking for tracked log files... "
log_tracked=$(git ls-files | grep -E "\.log$|\.out$|nohup\.out" | head -1 || true)
if [ -n "$log_tracked" ]; then
    echo -e "${YELLOW}WARNING${NC}"
    WARNINGS=$((WARNINGS + 1))
else
    echo -e "${GREEN}PASS${NC}"
fi

# Check 6: .gitignore exists
echo -n "Checking .gitignore exists... "
if [ -f ".gitignore" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    ERRORS=$((ERRORS + 1))
fi

# Check 7: keys.env.example exists
echo -n "Checking keys.env.example exists... "
if [ -f "keys.env.example" ] || [ -f "phase1/keys.env.example" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${YELLOW}WARNING${NC}"
    WARNINGS=$((WARNINGS + 1))
fi

# Check 8: README exists
echo -n "Checking README.md exists... "
if [ -f "README.md" ]; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    ERRORS=$((ERRORS + 1))
fi

echo ""
echo "======================================"
if [ $ERRORS -gt 0 ]; then
    echo -e "Result: ${RED}FAILED${NC} ($ERRORS errors, $WARNINGS warnings)"
    exit 1
elif [ $WARNINGS -gt 0 ]; then
    echo -e "Result: ${YELLOW}PASSED WITH WARNINGS${NC} ($WARNINGS warnings)"
    exit 0
else
    echo -e "Result: ${GREEN}PASSED${NC}"
    exit 0
fi
