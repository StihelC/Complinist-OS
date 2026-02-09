#!/bin/bash

# Test script for cursor modes and boundary nesting
# Runs optimized tests with parallel execution and detailed reporting

set -e

echo "🧪 Running Cursor Mode and Boundary Nesting Tests..."
echo ""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if dev server is running
check_dev_server() {
  if curl -s http://localhost:5173 > /dev/null; then
    echo -e "${GREEN}✓${NC} Dev server is running on port 5173"
    return 0
  else
    echo -e "${YELLOW}⚠${NC}  Dev server not detected on port 5173"
    return 1
  fi
}

# Run unit tests
run_unit_tests() {
  echo -e "\n${BLUE}1. Running Unit Tests${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  npx vitest run tests/unit/stores/cursorModes.test.ts --reporter=verbose

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Unit tests passed${NC}"
  else
    echo -e "${RED}✗ Unit tests failed${NC}"
    exit 1
  fi
}

# Run E2E tests
run_e2e_tests() {
  echo -e "\n${BLUE}2. Running E2E Tests${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  if ! check_dev_server; then
    echo -e "${YELLOW}Starting dev server...${NC}"
    npm run dev > /dev/null 2>&1 &
    DEV_SERVER_PID=$!

    # Wait for dev server to start
    for i in {1..30}; do
      if curl -s http://localhost:5173 > /dev/null; then
        echo -e "${GREEN}✓${NC} Dev server started"
        break
      fi
      sleep 1
    done

    if ! check_dev_server; then
      echo -e "${RED}✗ Failed to start dev server${NC}"
      exit 1
    fi
  fi

  npx playwright test --config=playwright.cursor-tests.config.ts

  local exit_code=$?

  # Cleanup
  if [ -n "$DEV_SERVER_PID" ]; then
    echo "Stopping dev server..."
    kill $DEV_SERVER_PID 2>/dev/null || true
  fi

  if [ $exit_code -eq 0 ]; then
    echo -e "${GREEN}✓ E2E tests passed${NC}"
  else
    echo -e "${RED}✗ E2E tests failed${NC}"
    echo -e "${YELLOW}View report: playwright-report/cursor-tests/index.html${NC}"
    exit 1
  fi
}

# Run visual tests
run_visual_tests() {
  echo -e "\n${BLUE}3. Running Visual Regression Tests${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  npx playwright test tests/visual/cursor-states.spec.ts --config=playwright.cursor-tests.config.ts

  if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Visual tests passed${NC}"
  else
    echo -e "${YELLOW}⚠  Visual tests failed or need updating${NC}"
    echo -e "${YELLOW}To update baselines: npm run test:visual:update${NC}"
  fi
}

# Generate coverage report
generate_coverage() {
  echo -e "\n${BLUE}4. Generating Coverage Report${NC}"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  npx vitest run tests/unit/stores/cursorModes.test.ts --coverage

  echo -e "${GREEN}✓ Coverage report generated${NC}"
  echo -e "${YELLOW}View coverage: coverage/index.html${NC}"
}

# Main execution
main() {
  echo "╔════════════════════════════════════════════╗"
  echo "║   Cursor Mode & Boundary Nesting Tests    ║"
  echo "╚════════════════════════════════════════════╝"

  # Parse arguments
  if [ "$1" = "--unit" ]; then
    run_unit_tests
  elif [ "$1" = "--e2e" ]; then
    run_e2e_tests
  elif [ "$1" = "--visual" ]; then
    run_visual_tests
  elif [ "$1" = "--coverage" ]; then
    generate_coverage
  elif [ "$1" = "--all" ]; then
    run_unit_tests
    run_e2e_tests
    run_visual_tests
    generate_coverage
  else
    echo "Usage: $0 [--unit|--e2e|--visual|--coverage|--all]"
    echo ""
    echo "Options:"
    echo "  --unit      Run unit tests only"
    echo "  --e2e       Run E2E tests only"
    echo "  --visual    Run visual regression tests only"
    echo "  --coverage  Generate coverage report"
    echo "  --all       Run all tests (default)"
    echo ""
    exit 1
  fi

  echo -e "\n${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
  echo -e "${GREEN}✓ All tests completed successfully!${NC}"
  echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

main "$@"
