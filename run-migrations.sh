#!/bin/bash

# Script to run database migrations
# This script connects to the RDS database and runs the schema.sql file

set -e

echo "🔍 Retrieving database credentials..."

# Get the secret ARN from CloudFormation outputs
SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name InfraStack \
  --query "Stacks[0].Outputs[?OutputKey=='DbSecretArn'].OutputValue" \
  --output text)

if [ -z "$SECRET_ARN" ] || [ "$SECRET_ARN" == "N/A" ]; then
  echo "❌ Error: Could not find database secret ARN"
  echo "Make sure the stack is deployed: cd infra && cdk deploy"
  exit 1
fi

# Get the secret value
SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --query SecretString \
  --output text)

if [ -z "$SECRET_VALUE" ]; then
  echo "❌ Error: Could not retrieve secret value"
  exit 1
fi

# Parse credentials
DB_HOST=$(echo "$SECRET_VALUE" | jq -r '.host')
DB_PORT=$(echo "$SECRET_VALUE" | jq -r '.port')
DB_NAME=$(echo "$SECRET_VALUE" | jq -r '.dbname')
DB_USER=$(echo "$SECRET_VALUE" | jq -r '.username')
DB_PASSWORD=$(echo "$SECRET_VALUE" | jq -r '.password')

echo "✅ Credentials retrieved"
echo "📍 Host: $DB_HOST"
echo "🗄️  Database: $DB_NAME"
echo ""

# Set PGPASSWORD environment variable for psql
export PGPASSWORD="$DB_PASSWORD"

echo "🚀 Running database migrations..."
echo ""

# Run the schema.sql file
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f database/schema.sql

if [ $? -eq 0 ]; then
  echo ""
  echo "✅ Migrations completed successfully!"
  echo ""
  echo "📊 Verifying tables..."
  psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -c "\dt"
else
  echo ""
  echo "❌ Migration failed!"
  exit 1
fi

# Unset password
unset PGPASSWORD
