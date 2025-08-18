#!/bin/bash

# Wallet Detection System Test Script
# This script tests the wallet detection endpoints without requiring Jest

echo "=================================="
echo "WALLET DETECTION SYSTEM TESTS"
echo "=================================="
echo

API_URL="http://localhost:3000/api"

# Test addresses
ADMIN_ADDRESS="0x761E5E59485ec6feb263320f5d636042bD9EBc8c"
CUSTOMER_ADDRESS="0x1234567890123456789012345678901234567890"
SHOP_ADDRESS="0x7890123456789012345678901234567890123456"
UNREGISTERED_ADDRESS="0x9999999999999999999999999999999999999999"
INVALID_ADDRESS="0xinvalid"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to test endpoint
test_endpoint() {
    local endpoint=$1
    local expected_status=$2
    local description=$3
    
    echo -n "Testing: $description... "
    
    response=$(curl -s -w "\n%{http_code}" "$endpoint")
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "Response: $body" | head -50
    fi
}

echo "1. CUSTOMER WALLET DETECTION TESTS"
echo "----------------------------------"
test_endpoint "$API_URL/customers/$CUSTOMER_ADDRESS" "200" "Registered customer wallet"
test_endpoint "$API_URL/customers/$UNREGISTERED_ADDRESS" "404" "Unregistered customer wallet"
test_endpoint "$API_URL/customers/$INVALID_ADDRESS" "400" "Invalid address format"
test_endpoint "$API_URL/customers/${CUSTOMER_ADDRESS^^}" "200" "Uppercase customer address"
echo

echo "2. SHOP WALLET DETECTION TESTS"
echo "------------------------------"
test_endpoint "$API_URL/shops/wallet/$SHOP_ADDRESS" "200" "Registered shop wallet"
test_endpoint "$API_URL/shops/wallet/$UNREGISTERED_ADDRESS" "404" "Unregistered shop wallet"
test_endpoint "$API_URL/shops/wallet/$INVALID_ADDRESS" "400" "Invalid shop address"
test_endpoint "$API_URL/shops/wallet/${SHOP_ADDRESS,,}" "200" "Lowercase shop address"
echo

echo "3. ROLE EXCLUSIVITY TESTS"
echo "-------------------------"
echo -n "Testing: Customer not registered as shop... "
customer_response=$(curl -s "$API_URL/customers/$CUSTOMER_ADDRESS")
shop_response=$(curl -s -w "\n%{http_code}" "$API_URL/shops/wallet/$CUSTOMER_ADDRESS")
shop_status=$(echo "$shop_response" | tail -n1)

if [ "$shop_status" == "404" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Role exclusivity maintained)"
else
    echo -e "${RED}✗ FAIL${NC} (Address registered as both customer and shop!)"
fi

echo -n "Testing: Admin not registered as customer... "
admin_customer_response=$(curl -s -w "\n%{http_code}" "$API_URL/customers/$ADMIN_ADDRESS")
admin_customer_status=$(echo "$admin_customer_response" | tail -n1)

if [ "$admin_customer_status" == "404" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Admin exclusivity maintained)"
else
    echo -e "${RED}✗ FAIL${NC} (Admin registered as customer!)"
fi
echo

echo "4. DATA STRUCTURE TESTS"
echo "-----------------------"
echo -n "Testing: Customer data structure... "
customer_data=$(curl -s "$API_URL/customers/$CUSTOMER_ADDRESS" | grep -o '"customer":{[^}]*"address":"[^"]*"')
if [ ! -z "$customer_data" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Customer data structure valid)"
else
    echo -e "${RED}✗ FAIL${NC} (Invalid customer data structure)"
fi

echo -n "Testing: Shop data structure... "
shop_data=$(curl -s "$API_URL/shops/wallet/$SHOP_ADDRESS" | grep -o '"shopId":"[^"]*"')
if [ ! -z "$shop_data" ]; then
    echo -e "${GREEN}✓ PASS${NC} (Shop data structure valid)"
else
    echo -e "${RED}✗ FAIL${NC} (Invalid shop data structure)"
fi
echo

echo "5. PERFORMANCE TEST"
echo "-------------------"
echo -n "Testing: Concurrent requests... "
start_time=$(date +%s.%N)

# Run 5 concurrent requests
(
    curl -s "$API_URL/customers/$CUSTOMER_ADDRESS" > /dev/null &
    curl -s "$API_URL/shops/wallet/$SHOP_ADDRESS" > /dev/null &
    curl -s "$API_URL/customers/$UNREGISTERED_ADDRESS" > /dev/null &
    curl -s "$API_URL/shops/wallet/$UNREGISTERED_ADDRESS" > /dev/null &
    curl -s "$API_URL/customers/$ADMIN_ADDRESS" > /dev/null &
    wait
)

end_time=$(date +%s.%N)
duration=$(echo "$end_time - $start_time" | bc)

if (( $(echo "$duration < 2" | bc -l) )); then
    echo -e "${GREEN}✓ PASS${NC} (Completed in ${duration}s)"
else
    echo -e "${YELLOW}⚠ SLOW${NC} (Took ${duration}s)"
fi
echo

echo "=================================="
echo "WALLET DETECTION TEST SUMMARY"
echo "=================================="
echo "All tests completed. Check results above for any failures."
echo
echo "Key endpoints tested:"
echo "- GET /api/customers/{address}"
echo "- GET /api/shops/wallet/{address}"
echo
echo "Test coverage:"
echo "- Valid/invalid addresses"
echo "- Role exclusivity"
echo "- Case sensitivity"
echo "- Data structure validation"
echo "- Performance under concurrent load"