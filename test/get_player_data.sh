#!/bin/bash

# --- PLAN DATABASE CONFIG ---
PLAN_DB_HOST="46.38.138.42"
PLAN_DB_USER="plan_user"
PLAN_DB_PASSWORD="7Ds9VD2XtU2Zt06YsmvyyyGPcCT6T5sz"
PLAN_DB_DATABASE="plan_db"

SQL_FILE="query_players.sql"
OUTPUT_FILE="player_data.json"

# بررسی وجود فایل SQL
if [ ! -f "$SQL_FILE" ]; then
    echo "Error: SQL file '$SQL_FILE' not found."
    echo "Please make sure 'query_players.sql' is in the same directory."
    exit 1
fi

echo "Connecting to MariaDB and executing SQL query (without TLS/SSL using skip-ssl)..."

# اجرای دستورات SQL و گرفتن خروجی JSON
# --skip-ssl برای غیرفعال کردن اتصال SSL/TLS (مناسب برای نسخه‌های قدیمی‌تر)
mysql -h "$PLAN_DB_HOST" -u "$PLAN_DB_USER" -p"$PLAN_DB_PASSWORD" "$PLAN_DB_DATABASE" \
      --skip-ssl \
      --skip-column-names \
      --raw \
      --batch \
      --compress \
      < "$SQL_FILE" \
      > "$OUTPUT_FILE"

# افزودن '[' و ']' برای ساخت یک آرایه JSON معتبر از چندین شیء JSON
# این مرحله ضروری است زیرا هر SELECT یک JSON object جداگانه تولید می‌کند.
sed -i '1s/^/[/' "$OUTPUT_FILE"
echo "]" >> "$OUTPUT_FILE"
sed -i -e 's/}{/},{/g' "$OUTPUT_FILE"


if [ $? -eq 0 ]; then
    echo "Data successfully saved to '$OUTPUT_FILE'"
else
    echo "Error: Failed to retrieve data from the database."
    echo "Check database credentials, host, or SQL file."
fi

# بررسی اینکه آیا فایل خروجی خالی است (ممکن است به دلیل عدم یافتن بازیکنان باشد)
if [ ! -s "$OUTPUT_FILE" ]; then
    echo "Warning: Output file '$OUTPUT_FILE' is empty or contains no data. This might happen if player names are not found or database is empty."
fi