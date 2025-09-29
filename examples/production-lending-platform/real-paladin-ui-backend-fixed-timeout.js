#!/usr/bin/env node

/**
 * 🎯 REAL PALADIN UI BACKEND - VALUE COMPARISON VERSION
 * 
 * This server does value comparison testing for write/read operations
 * Each EOA writes a unique value and we verify if the read matches
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");

const app = express();
const PORT = 3002;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// EXACT SAME configuration as your script
const NODES = [
  { name: "Node 1", url: "http://localhost:31548" },
  { name: "Node 2", url: "http://localhost:31648" },
  { name: "Node 3", url: "http://localhost:31748" }
];

// EXACT SAME contract as your script - MATCH EXACTLY
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

const STORAGE_BYTECODE = "0x6080604052348015600e575f5ffd5b505f5f819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c595f604051604291906091565b60405180910390a160a8565b5f819050919050565b5f819050919050565b5f819050919050565b5f607d6079607584604e565b6060565b6057565b9050919050565b608b816069565b82525050565b5f60208201905060a25f8301846084565b92915050565b6101a8806100b55f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c80632a1afcd9146100435780632f048afa1461006161806357de26a41461007d575b5f5ffd5b61004b61009b565b6040516100589190610100565b60405180910390f35b61007b60048036038101906100769190610147565b6100a0565b005b6100856100e0565b6040516100929190610100565b60405180910390f35b5f5481565b805f819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c59816040516100d59190610100565b60405180910390a150565b5f5f54905090565b5f819050919050565b6100fa816100e8565b82525050565b5f6020820190506101135f8301846100f1565b92915050565b5f5ffd5b610126816100e8565b8114610130575f5ffd5b50565b5f813590506101418161011d565b92915050565b5f6020828403121561015c5761015b610119565b5b5f61016984828501610133565b9150509291505056fea2646970667358221220304da884c1af195f6cdacd96d710202ecbd361a931f54efadab84deaa8e6a76d64736f6c634300081e0033";

// EXACT SAME state structure as your SimplifiedDemo class
let clients = [];
let wallets = {};
let groups = {};
let contracts = {};

// Serve the UI
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'real-paladin-ui.html'));
});

// EXACT SAME initialization as your script
app.post('/api/initialize', async (req, res) => {
  try {
    console.log("🚀 SIMPLIFIED INDIVIDUAL IDENTITY ISOLATION DEMO");
    console.log("===============================================\n");

    // Clear state
    clients = [];
    wallets = {};
    groups = {};
    contracts = {};

    // Connect to nodes - EXACTLY like your script
    for (let i = 0; i < NODES.length; i++) {
      const client = new PaladinClient({ url: NODES[i].url });
      clients.push(client);
      console.log(`✅ Connected to ${NODES[i].name}`);
    }

    // Create wallets (individual identities) - EXACTLY like your script
    wallets.EOA1 = { 
      client: clients[0], 
      verifier: clients[0].getVerifiers("individual_eoa1_unique@node1")[0],
      identity: "individual_eoa1_unique@node1",
      nodeIndex: 0
    };
    wallets.EOA2 = { 
      client: clients[0], 
      verifier: clients[0].getVerifiers("individual_eoa2_unique@node1")[0],
      identity: "individual_eoa2_unique@node1",
      nodeIndex: 0
    };
    wallets.EOA3 = { 
      client: clients[1], 
      verifier: clients[1].getVerifiers("individual_eoa3_unique@node2")[0],
      identity: "individual_eoa3_unique@node2",
      nodeIndex: 1
    };
    wallets.EOA4 = { 
      client: clients[1], 
      verifier: clients[1].getVerifiers("individual_eoa4_unique@node2")[0],
      identity: "individual_eoa4_unique@node2",
      nodeIndex: 1
    };
    wallets.EOA5 = { 
      client: clients[2], 
      verifier: clients[2].getVerifiers("individual_eoa5_unique@node3")[0],
      identity: "individual_eoa5_unique@node3",
      nodeIndex: 2
    };
    wallets.EOA6 = { 
      client: clients[2], 
      verifier: clients[2].getVerifiers("individual_eoa6_unique@node3")[0],
      identity: "individual_eoa6_unique@node3",
      nodeIndex: 2
    };

    console.log("\n🔐 Wallets created:");
    const walletData = {};
    for (const [name, wallet] of Object.entries(wallets)) {
      const address = await wallet.verifier.address();
      wallet.address = address;
      walletData[name] = {
        identity: wallet.identity,
        address: address,
        nodeIndex: wallet.nodeIndex
      };
      console.log(`   ${name}: ${wallet.identity} -> ${address}`);
    }

    res.json({
      success: true,
      wallets: walletData,
      nodes: NODES.map((node, index) => ({
        ...node,
        connected: true,
        eoas: Object.entries(walletData).filter(([name, wallet]) => wallet.nodeIndex === index)
      }))
    });

  } catch (error) {
    console.error('❌ Initialization failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// EXACT SAME group creation as your script
app.post('/api/create-groups', async (req, res) => {
  try {
    console.log("\n🏗️ Creating privacy groups...");

    // Create GROUP1 - EXACTLY like your script
    const group1Members = ["EOA1", "EOA3"];
    const group1Verifiers = group1Members.map(name => wallets[name].verifier);
    const penteFactory1 = new PenteFactory(clients[0], "pente");
    
    console.log(`🏗️ Creating GROUP1 with members: ${group1Members.join(", ")}`);
    const privacyGroup1 = await penteFactory1.newPrivacyGroup({
      name: "GROUP1",
      members: group1Verifiers,
      evmVersion: "shanghai",
      externalCallsEnabled: true,
      endorsementType: "group_scoped_identities"
    }).waitForDeploy(30000);

    // Deploy contract for GROUP1 - EXACTLY like your script
    const contractAddress1 = await privacyGroup1.deploy({
      abi: STORAGE_ABI,
      bytecode: STORAGE_BYTECODE,
      from: group1Verifiers[0].lookup,
      inputs: []
    }).waitForDeploy(30000);

    const ContractClass1 = class extends require("@lfdecentralizedtrust-labs/paladin-sdk").PentePrivateContract {
      constructor(evm, address) {
        super(evm, STORAGE_ABI, address);
      }
      using(paladin) {
        return new ContractClass1(this.evm.using(paladin), this.address);
      }
    };

    groups["GROUP1"] = { group: privacyGroup1, members: group1Members };
    contracts["GROUP1"] = new ContractClass1(privacyGroup1, contractAddress1);
    console.log(`✅ GROUP1 created with contract: ${contractAddress1}\n`);

    // Create GROUP2 - EXACTLY like your script
    const group2Members = ["EOA1", "EOA4"];
    const group2Verifiers = group2Members.map(name => wallets[name].verifier);
    const penteFactory2 = new PenteFactory(clients[0], "pente");
    
    console.log(`🏗️ Creating GROUP2 with members: ${group2Members.join(", ")}`);
    const privacyGroup2 = await penteFactory2.newPrivacyGroup({
      name: "GROUP2",
      members: group2Verifiers,
      evmVersion: "shanghai",
      externalCallsEnabled: true,
      endorsementType: "group_scoped_identities"
    }).waitForDeploy(30000);

    // Deploy contract for GROUP2 - EXACTLY like your script
    const contractAddress2 = await privacyGroup2.deploy({
      abi: STORAGE_ABI,
      bytecode: STORAGE_BYTECODE,
      from: group2Verifiers[0].lookup,
      inputs: []
    }).waitForDeploy(30000);

    const ContractClass2 = class extends require("@lfdecentralizedtrust-labs/paladin-sdk").PentePrivateContract {
      constructor(evm, address) {
        super(evm, STORAGE_ABI, address);
      }
      using(paladin) {
        return new ContractClass2(this.evm.using(paladin), this.address);
      }
    };

    groups["GROUP2"] = { group: privacyGroup2, members: group2Members };
    contracts["GROUP2"] = new ContractClass2(privacyGroup2, contractAddress2);
    console.log(`✅ GROUP2 created with contract: ${contractAddress2}\n`);

    res.json({
      success: true,
      groups: {
        GROUP1: {
          address: privacyGroup1.address,
          contractAddress: contractAddress1,
          members: group1Members
        },
        GROUP2: {
          address: privacyGroup2.address,
          contractAddress: contractAddress2,
          members: group2Members
        }
      }
    });

  } catch (error) {
    console.error('❌ Group creation failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Run all tests - VALUE COMPARISON VERSION
app.post('/api/run-all-tests', async (req, res) => {
  try {
    console.log("📝 Running value comparison tests...");
    
    const testResults = [];

    // Test GROUP1 - Value comparison test
    console.log("📝 TEST 1: GROUP1 (EOA1, EOA3 authorized)");
    console.log("=========================================");
    
    const group1Tests = [
      { wallet: "EOA1", value: 100 },
      { wallet: "EOA2", value: 101 },
      { wallet: "EOA3", value: 102 },
      { wallet: "EOA4", value: 103 },
      { wallet: "EOA5", value: 104 },
      { wallet: "EOA6", value: 105 }
    ];

    for (const test of group1Tests) {
      console.log(`🔍 Testing ${test.wallet} on GROUP1 (write ${test.value}):`);
      
      const wallet = wallets[test.wallet];
      const contract = contracts["GROUP1"].using(wallet.client);
      const isAuthorized = groups["GROUP1"].members.includes(test.wallet);
      
      let writeResult = { success: false, message: '', storedValue: null };
      let readResult = { success: false, value: 0, expectedValue: test.value, valueMatches: false, message: '' };
      
      // Test WRITE - Store the specific value for this EOA
      try {
        const receipt = await contract.sendTransaction({
          from: wallet.verifier.lookup,
          function: "store",
          data: { num: test.value }
        }).waitForReceipt(30000);        if (receipt?.success) {
          writeResult = { success: true, message: `WRITE ${test.value} - SUCCESS`, storedValue: test.value };
          console.log(`   ✅ WRITE ${test.value} - SUCCESS`);
        } else {
          writeResult = { success: false, message: `WRITE ${test.value} - FAILED`, storedValue: null };
          console.log(`   ❌ WRITE ${test.value} - FAILED`);
        }
      } catch (error) {
        writeResult = { success: false, message: `WRITE ${test.value} - FAILED (${error.message.split('\n')[0]})`, storedValue: null };
        console.log(`   ❌ WRITE ${test.value} - FAILED (${error.message.split('\n')[0]})`);
      }

      // Test READ - Check if the retrieved value matches what we stored
      try {
        const result = await contract.call({
          from: wallet.verifier.lookup,
          function: "retrieve"
        });
        
        const retrievedValue = parseInt(result.value);
        const valueMatches = writeResult.success && (retrievedValue === test.value);
        
        readResult = { 
          success: true, 
          value: retrievedValue, 
          expectedValue: test.value,
          valueMatches: valueMatches,
          message: `READ ${retrievedValue} - ${valueMatches ? 'MATCHES' : 'MISMATCH'} (expected ${test.value})` 
        };
        console.log(`   📖 READ ${retrievedValue} - ${valueMatches ? '✅ MATCHES' : '❌ MISMATCH'} (expected ${test.value})`);
      } catch (error) {
        readResult = { 
          success: false, 
          value: 0, 
          expectedValue: test.value,
          valueMatches: false,
          message: `READ - FAILED (${error.message.split('\n')[0]})` 
        };
        console.log(`   ❌ READ - FAILED (${error.message.split('\n')[0]})`);
      }
      
      console.log();
      
      testResults.push({
        group: "GROUP1",
        wallet: test.wallet,
        isAuthorized,
        write: writeResult,
        read: readResult
      });
    }

    // Test GROUP2 - Value comparison test
    console.log("📝 TEST 2: GROUP2 (EOA1, EOA4 authorized)");
    console.log("=========================================");
    
    const group2Tests = [
      { wallet: "EOA1", value: 200 },
      { wallet: "EOA2", value: 201 },
      { wallet: "EOA3", value: 202 },
      { wallet: "EOA4", value: 203 },
      { wallet: "EOA5", value: 204 },
      { wallet: "EOA6", value: 205 }
    ];

    for (const test of group2Tests) {
      console.log(`🔍 Testing ${test.wallet} on GROUP2 (write ${test.value}):`);
      
      const wallet = wallets[test.wallet];
      const contract = contracts["GROUP2"].using(wallet.client);
      const isAuthorized = groups["GROUP2"].members.includes(test.wallet);
      
      let writeResult = { success: false, message: '', storedValue: null };
      let readResult = { success: false, value: 0, expectedValue: test.value, valueMatches: false, message: '' };
      
      // Test WRITE - Store the specific value for this EOA
      try {
        const receipt = await contract.sendTransaction({
          from: wallet.verifier.lookup,
          function: "store",
          data: { num: test.value }
        }).waitForReceipt(30000);        if (receipt?.success) {
          writeResult = { success: true, message: `WRITE ${test.value} - SUCCESS`, storedValue: test.value };
          console.log(`   ✅ WRITE ${test.value} - SUCCESS`);
        } else {
          writeResult = { success: false, message: `WRITE ${test.value} - FAILED`, storedValue: null };
          console.log(`   ❌ WRITE ${test.value} - FAILED`);
        }
      } catch (error) {
        writeResult = { success: false, message: `WRITE ${test.value} - FAILED (${error.message.split('\n')[0]})`, storedValue: null };
        console.log(`   ❌ WRITE ${test.value} - FAILED (${error.message.split('\n')[0]})`);
      }

      // Test READ - Check if the retrieved value matches what we stored
      try {
        const result = await contract.call({
          from: wallet.verifier.lookup,
          function: "retrieve"
        });
        
        const retrievedValue = parseInt(result.value);
        const valueMatches = writeResult.success && (retrievedValue === test.value);
        
        readResult = { 
          success: true, 
          value: retrievedValue, 
          expectedValue: test.value,
          valueMatches: valueMatches,
          message: `READ ${retrievedValue} - ${valueMatches ? 'MATCHES' : 'MISMATCH'} (expected ${test.value})` 
        };
        console.log(`   📖 READ ${retrievedValue} - ${valueMatches ? '✅ MATCHES' : '❌ MISMATCH'} (expected ${test.value})`);
      } catch (error) {
        readResult = { 
          success: false, 
          value: 0, 
          expectedValue: test.value,
          valueMatches: false,
          message: `READ - FAILED (${error.message.split('\n')[0]})` 
        };
        console.log(`   ❌ READ - FAILED (${error.message.split('\n')[0]})`);
      }
      
      console.log();
      
      testResults.push({
        group: "GROUP2",
        wallet: test.wallet,
        isAuthorized,
        write: writeResult,
        read: readResult
      });
    }

    // Analysis
    console.log("🎯 VALUE COMPARISON ANALYSIS:");
    console.log("=============================");
    console.log("🔍 GROUP1 write/read operations with unique values (100-105)");
    console.log("🔍 GROUP2 write/read operations with unique values (200-205)");
    console.log("💡 Each EOA writes a unique value and we verify if read matches");
    console.log("\n🎯 CONCLUSION: Value comparison shows actual contract state sharing");

    res.json({
      success: true,
      testResults,
      analysis: {
        testType: "Value Comparison Test",
        group1Values: "100-105",
        group2Values: "200-205", 
        conclusion: "Value comparison shows actual contract state sharing"
      }
    });

  } catch (error) {
    console.error('❌ All tests failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Start server
async function startServer() {
  console.log('🚀 Starting REAL Paladin UI Backend Server (Value Comparison Version)...\n');
  
  app.listen(PORT, () => {
    console.log(`\n🌐 REAL Paladin UI Backend running at http://localhost:${PORT}`);
    console.log(`📖 Open http://localhost:${PORT} in your browser`);
    console.log('\n🔗 This version does VALUE COMPARISON testing');
    console.log('   📊 Each EOA writes a unique value');
    console.log('   🔍 We verify if read matches the written value');
    console.log('   ✅ Shows actual contract state behavior');
    console.log();
  });
}

startServer().catch(console.error);
