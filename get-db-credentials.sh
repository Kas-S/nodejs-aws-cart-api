#!/bin/bash

# Script to retrieve RDS database credentials from AWS Secrets Manager
# Usage: ./get-db-credentials.sh

echo "🔍 Fetching database credentials..."
echo ""

# Get the secret ARN from CloudFormation outputs
SECRET_ARN=$(aws cloudformation describe-stacks \
  --stack-name InfraStack \
  --query "Stacks[0].Outputs[?OutputKey=='DbSecretArn'].OutputValue" \
  --output text)

if [ -z "$SECRET_ARN" ] || [ "$SECRET_ARN" == "N/A" ]; then
  echo "❌ Error: Could not find database secret ARN"
  exit 1
fi

echo "Secret ARN: $SECRET_ARN"
echo ""

# Get the secret value
SECRET_VALUE=$(aws secretsmanager get-secret-value \
  --secret-id "$SECRET_ARN" \
  --query SecretString \
  --output text)

if [ -z "$SECRET_VALUE" ]; then
  echo "❌ Error: Could not retrieve secret value"
  exit 1
fi

# Parse and display the credentials
echo "✅ Database Credentials:"
echo ""
echo "$SECRET_VALUE" | jq -r '
  "Host:     " + .host + "\n" +
  "Port:     " + (.port | tostring) + "\n" +
  "Database: " + .dbname + "\n" +
  "Username: " + .username + "\n" +
  "Password: " + .password
'

echo ""
echo "📝 Connection String:"
echo "$SECRET_VALUE" | jq -r '"postgresql://" + .username + ":" + .password + "@" + .host + ":" + (.port | tostring) + "/" + .dbname'

echo ""
echo "💡 To set environment variables, run:"
echo ""
echo "export DB_HOST=\$(echo '$SECRET_VALUE' | jq -r '.host')"
echo "export DB_PORT=\$(echo '$SECRET_VALUE' | jq -r '.port')"
echo "export DB_NAME=\$(echo '$SECRET_VALUE' | jq -r '.dbname')"
echo "export DB_USERNAME=\$(echo '$SECRET_VALUE' | jq -r '.username')"
echo "export DB_PASSWORD=\$(echo '$SECRET_VALUE' | jq -r '.password')"
