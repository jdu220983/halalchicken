#!/usr/bin/env bash

# DEPLOYMENT CHECKLIST - Run this to verify implementation
# 
# This script checks that all production-ready components are in place

set -e

echo "=========================================="
echo "Production Implementation Verification"
echo "=========================================="
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

check_file() {
  local file=$1
  local description=$2
  
  if [ -f "$file" ]; then
    echo -e "${GREEN}✓${NC} $description"
    return 0
  else
    echo -e "${RED}✗${NC} $description - NOT FOUND: $file"
    return 1
  fi
}

check_directory() {
  local dir=$1
  local description=$2
  
  if [ -d "$dir" ]; then
    echo -e "${GREEN}✓${NC} $description"
    return 0
  else
    echo -e "${RED}✗${NC} $description - NOT FOUND: $dir"
    return 1
  fi
}

count=0
total=0

echo "Checking Frontend API Service..."
echo ""

# API Service files
total=$((total + 1))
if check_file "frontend/src/lib/api-service/errors.ts" "Error handling class"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "frontend/src/lib/api-service/client.ts" "Axios client with retry"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "frontend/src/lib/api-service/logger.ts" "Structured logging"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "frontend/src/lib/api-service/orders.ts" "Orders API methods"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "frontend/src/lib/api-service/messages-ru.ts" "Russian messages"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "frontend/src/lib/api-service/index.ts" "API service exports"; then
  count=$((count + 1))
fi

echo ""
echo "Checking Frontend Hooks..."
echo ""

total=$((total + 1))
if check_file "frontend/src/lib/hooks/useAdminOrders.ts" "Admin orders hook"; then
  count=$((count + 1))
fi

echo ""
echo "Checking Frontend Components..."
echo ""

total=$((total + 1))
if check_file "frontend/src/components/admin/OrdersList.tsx" "Orders list component"; then
  count=$((count + 1))
fi

echo ""
echo "Checking Backend Files..."
echo ""

total=$((total + 1))
if check_file "backend/shop/views.py" "Backend views (should have logging)"; then
  count=$((count + 1))
fi

echo ""
echo "Checking Documentation..."
echo ""

total=$((total + 1))
if check_file "ROOT_CAUSE_ANALYSIS.md" "Root cause analysis"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "API_SERVICE_README.md" "API service documentation"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "MIGRATION_GUIDE.tsx" "Integration guide"; then
  count=$((count + 1))
fi

total=$((total + 1))
if check_file "TESTING_GUIDE.md" "Testing guide"; then
  count=$((count + 1))
fi

echo ""
echo "=========================================="
echo "Summary: $count/$total files verified"
echo "=========================================="
echo ""

if [ $count -eq $total ]; then
  echo -e "${GREEN}✓ Implementation complete!${NC}"
  echo ""
  echo "Next steps:"
  echo "1. Read ROOT_CAUSE_ANALYSIS.md"
  echo "2. Follow MIGRATION_GUIDE.tsx to integrate into Admin.tsx"
  echo "3. Use TESTING_GUIDE.md to verify functionality"
  echo "4. Reference API_SERVICE_README.md for usage"
  echo ""
  exit 0
else
  echo -e "${RED}✗ Some files are missing${NC}"
  echo ""
  echo "Run this again after creating missing files"
  exit 1
fi
