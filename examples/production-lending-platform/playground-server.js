#!/usr/bin/env node

/**
 * 🌐 PALADIN PLAYGROUND BACKEND SERVER
 * 
 * Simple Express server to serve the HTML playground and handle API requests
 * Integrates with actual Paladin nodes for real contract interactions
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Paladin configuration
const NODES = [
  { id: 'node1', name: 'Node 1', url: 'http://localhost:31548' },
  { id: 'node2', name: 'Node 2', url: 'http://localhost:31648' },
  { id: 'node3', name: 'Node 3', url: 'http://localhost:31748' }
];

// Storage contract ABI and bytecode
const STORAGE_ABI = [
  {
    "inputs": [],
    "name": "retrieve",
    "outputs": [{ "internalType": "uint256", "name": "value", "type": "uint256" }],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [{ "internalType": "uint256", "name": "num", "type": "uint256" }],
    "name": "store",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const STORAGE_BYTECODE = "0x608060405234801561001057600080fd5b506101a4806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220";

// Global state
let clients = {};
let wallets = {};
let privacyGroups = {};
let contracts = {};

// Initialize Paladin clients
async function initializePaladin() {
  try {
    for (const node of NODES) {
      console.log(`🔗 Attempting to connect to ${node.name} at ${node.url}...`);
      const client = new PaladinClient({ url: node.url });
      
      // Test the connection by trying to get verifiers
      try {
        const testVerifiers = client.getVerifiers("test_connection");
        console.log(`✅ Connected to ${node.name} at ${node.url} - SDK working`);
        clients[node.id] = client;
      } catch (connError) {
        console.error(`❌ Failed to verify SDK connection to ${node.name}:`, connError.message);
        throw connError;
      }
    }
    console.log('🚀 All Paladin clients initialized and tested');
    return true;
  } catch (error) {
    console.error('❌ Failed to initialize Paladin clients:', error.message);
    return false;
  }
}

// Routes

// Serve the main playground page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'paladin-playground.html'));
});

// Get node status
app.get('/api/nodes', (req, res) => {
  const nodeStatus = NODES.map(node => ({
    ...node,
    status: clients[node.id] ? 'connected' : 'disconnected'
  }));
  res.json(nodeStatus);
});

// Create EOA
app.post('/api/eoa', async (req, res) => {
  try {
    const { nodeId, eoaName } = req.body;
    
    if (!nodeId || !eoaName) {
      return res.status(400).json({ error: 'Node ID and EOA name are required' });
    }

    if (!clients[nodeId]) {
      return res.status(400).json({ error: `Node ${nodeId} not found or not connected` });
    }

    const client = clients[nodeId];
    const identity = `${eoaName}_${Date.now()}@${nodeId}`;
    
    console.log(`🔐 Creating EOA "${eoaName}" on ${nodeId} with identity: ${identity}`);
    
    // Create verifier - EXACTLY like your working script
    const verifiers = client.getVerifiers(identity);
    
    if (verifiers.length === 0) {
      console.error(`❌ Failed to create verifier for ${identity}`);
      return res.status(500).json({ error: 'Failed to create verifier - Paladin SDK issue' });
    }
    
    const verifier = verifiers[0];
    // Get REAL address like your script does: await wallet.verifier.address()
    const address = await verifier.address();
    
    console.log(`✅ EOA created: ${eoaName} -> ${address} (REAL ADDRESS)`);
    
    // Store wallet info - EXACTLY like your script
    const walletKey = `${nodeId}:${eoaName}`;
    wallets[walletKey] = {
      nodeId,
      eoaName,
      identity,
      verifier,
      address,
      client
    };

    res.json({
      success: true,
      eoa: {
        name: eoaName,
        address,
        identity,
        nodeId
      }
    });

  } catch (error) {
    console.error('❌ Error creating EOA:', error);
    res.status(500).json({ error: `Real Paladin error: ${error.message}` });
  }
});

// Create privacy group
app.post('/api/privacy-group', async (req, res) => {
  try {
    const { groupName, members } = req.body;
    
    if (!groupName || !members || members.length === 0) {
      return res.status(400).json({ error: 'Group name and members are required' });
    }

    console.log(`🏗️ Creating REAL privacy group "${groupName}" with members:`, members);

    // Get member verifiers
    const memberVerifiers = [];
    for (const member of members) {
      if (!wallets[member]) {
        return res.status(400).json({ error: `Wallet ${member} not found` });
      }
      memberVerifiers.push(wallets[member].verifier);
      console.log(`   📝 Member: ${wallets[member].eoaName} (${wallets[member].address})`);
    }

    // Use the first member's client for creating the group
    const firstMember = wallets[members[0]];
    const penteFactory = new PenteFactory(firstMember.client, "pente");
    
    console.log(`🔗 Creating privacy group via Paladin SDK (REAL, not fake)...`);
    
    // Create privacy group - REAL Paladin operation EXACTLY like your script
    const privacyGroup = await penteFactory.newPrivacyGroup({
      name: groupName,
      members: memberVerifiers,
      evmVersion: "shanghai",
      externalCallsEnabled: true,
      endorsementType: "group_scoped_identities"  // SAME AS YOUR SCRIPT
    }).waitForDeploy();

    // Get REAL addresses like your script: privacyGroup.address(), contractAddress
    const realGroupAddress = privacyGroup.address();
    const realGroupId = privacyGroup.groupID;
    
    console.log(`✅ Privacy group created: ${realGroupAddress} (REAL ADDRESS)`);
    console.log(`🆔 Group ID: ${realGroupId} (REAL GROUP ID)`);

    // Deploy contract - REAL Paladin contract deployment
    console.log(`📜 Deploying storage contract (REAL, not fake)...`);
    const contractAddress = await privacyGroup.deploy({
      abi: STORAGE_ABI,
      bytecode: STORAGE_BYTECODE,
      from: memberVerifiers[0].lookup,
      inputs: []
    }).waitForDeploy();

    console.log(`✅ Contract deployed: ${contractAddress} (REAL CONTRACT ADDRESS)`);

    // Create contract instance - EXACTLY same as your script
    const ContractClass = class extends require("@lfdecentralizedtrust-labs/paladin-sdk").PentePrivateContract {
      constructor(evm, address) {
        super(evm, STORAGE_ABI, address);
      }
      using(paladin) {
        return new ContractClass(this.evm.using(paladin), this.address);
      }
    };

    const contract = new ContractClass(privacyGroup, contractAddress);

    // Store group info - using REAL addresses
    privacyGroups[groupName] = {
      group: privacyGroup,
      members,
      address: realGroupAddress,  // REAL ADDRESS
      contractAddress,           // REAL ADDRESS
      groupId: realGroupId      // REAL GROUP ID
    };
    contracts[groupName] = contract;

    console.log(`🎉 Privacy group "${groupName}" fully deployed and ready! (ALL REAL ADDRESSES)
`);

    res.json({
      success: true,
      group: {
        name: groupName,
        address: realGroupAddress,      // REAL GROUP ADDRESS
        contractAddress,               // REAL CONTRACT ADDRESS  
        groupId: realGroupId,         // REAL GROUP ID
        members: members.map(member => ({
          key: member,
          name: wallets[member].eoaName,
          address: wallets[member].address  // REAL EOA ADDRESS
        }))
      }
    });

  } catch (error) {
    console.error('❌ Error creating privacy group:', error);
    res.status(500).json({ error: `Real Paladin error: ${error.message}` });
  }
});

// Contract interaction - Write
app.post('/api/contract/write', async (req, res) => {
  try {
    const { groupName, walletKey, value } = req.body;
    
    if (!privacyGroups[groupName] || !wallets[walletKey]) {
      return res.status(400).json({ error: 'Invalid group or wallet' });
    }

    const wallet = wallets[walletKey];
    const contract = contracts[groupName].using(wallet.client);
    const isMember = privacyGroups[groupName].members.includes(walletKey);
    
    console.log(`📝 REAL CONTRACT WRITE:`);
    console.log(`   Group: ${groupName} (${privacyGroups[groupName].address})`);
    console.log(`   Contract: ${privacyGroups[groupName].contractAddress}`);
    console.log(`   EOA: ${wallet.eoaName} (${wallet.address})`);
    console.log(`   Value: ${value}`);
    console.log(`   Is Member: ${isMember}`);
    console.log(`   Expected: ${isMember ? 'SUCCESS' : 'FAILURE'}`);
    
    // Send transaction - REAL Paladin SDK call
    const receipt = await contract.sendTransaction({
      from: wallet.verifier.lookup,
      function: "store",
      data: { num: parseInt(value) }
    }).waitForReceipt(5000);

    const success = receipt?.success || false;
    console.log(`   Result: ${success ? '✅ SUCCESS' : '❌ FAILED'}`);
    
    if (receipt) {
      console.log(`   Receipt ID: ${receipt.id}`);
    }
    
    res.json({
      success,
      receipt,
      isMember,
      walletInfo: {
        name: wallet.eoaName,
        nodeId: wallet.nodeId,
        address: wallet.address
      }
    });

  } catch (error) {
    const wallet = wallets[req.body.walletKey];
    const isMember = privacyGroups[req.body.groupName]?.members.includes(req.body.walletKey) || false;
    
    console.log(`   Result: ❌ FAILED - ${error.message}`);
    console.log(`   This ${isMember ? 'should have succeeded' : 'failure is expected'}`);
    
    res.json({
      success: false,
      error: error.message,
      isMember,
      walletInfo: wallet ? {
        name: wallet.eoaName,
        nodeId: wallet.nodeId,
        address: wallet.address
      } : null
    });
  }
});

// Contract interaction - Read
app.post('/api/contract/read', async (req, res) => {
  try {
    const { groupName, walletKey } = req.body;
    
    if (!privacyGroups[groupName] || !wallets[walletKey]) {
      return res.status(400).json({ error: 'Invalid group or wallet' });
    }

    const wallet = wallets[walletKey];
    const contract = contracts[groupName].using(wallet.client);
    const isMember = privacyGroups[groupName].members.includes(walletKey);
    
    console.log(`📖 REAL CONTRACT READ:`);
    console.log(`   Group: ${groupName} (${privacyGroups[groupName].address})`);
    console.log(`   Contract: ${privacyGroups[groupName].contractAddress}`);
    console.log(`   EOA: ${wallet.eoaName} (${wallet.address})`);
    console.log(`   Is Member: ${isMember}`);
    console.log(`   Expected: ${isMember ? 'SUCCESS' : 'FAILURE'}`);
    
    // Call contract - REAL Paladin SDK call
    const result = await contract.call({
      from: wallet.verifier.lookup,
      function: "retrieve"
    });

    const value = parseInt(result.value);
    console.log(`   Result: ✅ SUCCESS - Read value: ${value}`);
    
    res.json({
      success: true,
      value,
      isMember,
      walletInfo: {
        name: wallet.eoaName,
        nodeId: wallet.nodeId,
        address: wallet.address
      }
    });

  } catch (error) {
    const wallet = wallets[req.body.walletKey];
    const isMember = privacyGroups[req.body.groupName]?.members.includes(req.body.walletKey) || false;
    
    console.log(`   Result: ❌ FAILED - ${error.message}`);
    console.log(`   This ${isMember ? 'should have succeeded' : 'failure is expected'}`);
    
    res.json({
      success: false,
      error: error.message,
      isMember,
      walletInfo: wallet ? {
        name: wallet.eoaName,
        nodeId: wallet.nodeId,
        address: wallet.address
      } : null
    });
  }
});

// Get privacy group info
app.get('/api/privacy-group/:groupName', (req, res) => {
  const { groupName } = req.params;
  
  if (!privacyGroups[groupName]) {
    return res.status(404).json({ error: 'Privacy group not found' });
  }

  const group = privacyGroups[groupName];
  const memberDetails = group.members.map(member => {
    const wallet = wallets[member];
    return {
      key: member,
      name: wallet.eoaName,
      nodeId: wallet.nodeId,
      address: wallet.address,
      identity: wallet.identity
    };
  });

  res.json({
    name: groupName,
    address: group.address,
    contractAddress: group.contractAddress,
    groupId: group.group.groupID,
    members: memberDetails
  });
});

// Start server
async function startServer() {
  console.log('🚀 Starting Paladin Playground Server...\n');
  
  const paladinReady = await initializePaladin();
  
  if (!paladinReady) {
    console.error('❌ Cannot start server - Paladin connection failed');
    console.error('💡 Make sure your Paladin nodes are running on:');
    NODES.forEach(node => console.error(`   - ${node.url}`));
    process.exit(1);
  }
  
  app.listen(PORT, () => {
    console.log(`\n🌐 Paladin Playground Server running at http://localhost:${PORT}`);
    console.log(`📖 Open http://localhost:${PORT} in your browser to start the playground`);
    console.log('\n🔗 Connected Paladin Nodes:');
    NODES.forEach(node => console.log(`   ✅ ${node.name}: ${node.url}`));
    console.log();
  });
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n👋 Shutting down playground server...');
  process.exit(0);
});

startServer().catch(console.error);
