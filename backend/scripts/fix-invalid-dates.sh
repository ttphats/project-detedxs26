#!/bin/bash

# Fix Invalid Datetime Values - Safe Script
# This script checks if column exists before updating

DB_HOST="103.179.188.241"
DB_USER="rymukbi_admin"
DB_PASS="Admin@2026"
DB_NAME="rymukbi_easyticketdb"

echo "========================================"
echo "Fix Invalid Datetime Values"
echo "========================================"
echo ""

# Function to check if column exists
check_column() {
    local table=$1
    local column=$2
    
    result=$(mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME -N -e \
        "SELECT COUNT(*) FROM information_schema.COLUMNS 
         WHERE TABLE_SCHEMA = '$DB_NAME' 
         AND TABLE_NAME = '$table' 
         AND COLUMN_NAME = '$column'")
    
    echo $result
}

# Function to fix table
fix_table() {
    local table=$1
    
    echo "Checking table: $table"
    
    has_updated_at=$(check_column $table "updated_at")
    
    if [ "$has_updated_at" -eq "1" ]; then
        echo "  ✓ Table $table has updated_at column"
        echo "  → Fixing invalid dates..."
        
        mysql -h $DB_HOST -u $DB_USER -p"$DB_PASS" $DB_NAME << EOF
UPDATE $table 
SET updated_at = COALESCE(created_at, NOW())
WHERE updated_at = '0000-00-00 00:00:00' 
   OR updated_at IS NULL 
   OR updated_at < '1000-01-01'
   OR YEAR(updated_at) = 0;
EOF
        
        echo "  ✓ Fixed $table"
    else
        echo "  ✗ Table $table does not have updated_at column - skipping"
    fi
    echo ""
}

# Fix main tables
fix_table "orders"
fix_table "seats"
fix_table "events"
fix_table "users"
fix_table "speakers"
fix_table "timelines"
fix_table "order_items"

echo "========================================"
echo "✅ Fix Complete!"
echo "========================================"
echo ""
echo "Restart backend: pm2 restart tedx-backend"
