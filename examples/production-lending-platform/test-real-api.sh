#!/bin/bash

# Quick test to create a REAL privacy group on your cluster
echo "🎯 Creating REAL ephemeral privacy group on your Kubernetes cluster..."

curl -X POST http://localhost:31548/api/v1/domains/pente/privacy-groups \
  -H "Content-Type: application/json" \
  -d '{
    "name": "real-lending-test",
    "members": ["lender1", "borrower1"],
    "description": "Real test of CEO ephemeral EVM vision"
  }'

echo ""
echo "🎯 This would create an actual ephemeral EVM on your real Paladin cluster!"
