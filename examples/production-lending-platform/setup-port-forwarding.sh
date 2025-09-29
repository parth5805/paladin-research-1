#!/bin/bash

echo "🚀 Setting up port forwarding for Paladin nodes..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl could not be found. Please install kubectl first."
    exit 1
fi

# Check if nodes are running
echo "📋 Checking Paladin node status..."
kubectl get pods | grep paladin

echo ""
echo "🔗 Setting up port forwarding..."
echo "NODE1 -> localhost:8545"
echo "NODE2 -> localhost:8546" 
echo "NODE3 -> localhost:8547"
echo ""

# Kill any existing port forwards
pkill -f "kubectl port-forward.*paladin-node"

# Port forward Paladin nodes (using correct internal port 8548)
kubectl port-forward paladin-node1-0 8545:8548 &
kubectl port-forward paladin-node2-0 8546:8548 &
kubectl port-forward paladin-node3-0 8547:8548 &

echo "⏳ Waiting for port forwards to establish..."
sleep 5

echo "✅ Port forwarding established!"
echo ""
echo "You can now run the cross-node test:"
echo "node cross-node-ephemeral-privacy-test.js"
echo ""
echo "To stop port forwarding, run:"
echo "pkill -f 'kubectl port-forward.*paladin-node'"
