#!/bin/bash

##############################################################################
# Deployment Health Check Script
#
# Performs basic health checks after deployment to ensure the application
# is accessible and functioning correctly.
#
# Usage: ./health-check.sh <environment-url>
##############################################################################

set -e

ENVIRONMENT_URL=${1:-"http://localhost:5173"}
MAX_RETRIES=5
RETRY_DELAY=5

echo "========================================"
echo "Deployment Health Check"
echo "========================================"
echo "Target: $ENVIRONMENT_URL"
echo "Max Retries: $MAX_RETRIES"
echo "========================================"

# Function to check HTTP endpoint
check_http() {
    local url=$1
    local expected_status=${2:-200}

    echo "Checking: $url"

    for i in $(seq 1 $MAX_RETRIES); do
        if response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null); then
            if [ "$response" -eq "$expected_status" ]; then
                echo "✓ Success (HTTP $response)"
                return 0
            else
                echo "⚠ Unexpected status: HTTP $response (expected $expected_status)"
            fi
        fi

        if [ $i -lt $MAX_RETRIES ]; then
            echo "Retry $i/$MAX_RETRIES in ${RETRY_DELAY}s..."
            sleep $RETRY_DELAY
        fi
    done

    echo "✗ Health check failed after $MAX_RETRIES attempts"
    return 1
}

# Perform health checks
check_http "$ENVIRONMENT_URL"

echo ""
echo "========================================"
echo "Health Check PASSED"
echo "========================================"
exit 0
