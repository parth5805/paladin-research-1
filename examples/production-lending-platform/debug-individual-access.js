#!/usr/bin/env node

/**
 * 🔍 DEBUG INDIVIDUAL ACCESS VALIDATION
 * 
 * This script will definitively prove whether EOA2 and EOA4 
 * can actually read/write or are truly blocked by Paladin
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");

// Node configuration
const NODES = [
  { name: "Node 1", id: "node1", url: "http://localhost:31548" },
  { name: "Node 2", id: "node2", url: "http://localhost:31648" },
  { name: "Node 3", id: "node3", url: "http://localhost:31748" }
];

// Simple storage contract ABI
const SIMPLE_STORAGE_ABI = [
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

const SIMPLE_STORAGE_BYTECODE = "0x608060405234801561001057600080fd5b506101a4806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220a13b2d57564902817cb4d9e87985a1a23b5ac5f8d36c0a26d9e2a9a8e43b8b1c64736f6c63430008130033";

class DebugAccessValidator {
  constructor() {
    this.clients = [];
    this.identities = new Map();
  }

  async initialize() {
    console.log("🔍 DEBUG: Individual Access Validation");
    console.log("=====================================");
    
    // Connect to nodes
    for (const [index, node] of NODES.entries()) {
      const client = new PaladinClient({ url: node.url });
      this.clients.push({ client, ...node });
      console.log(`✅ Connected to ${node.name}`);
    }

    // Create test identities
    const identityConfigs = [
      { name: "EOA1", nodeIndex: 0, uniqueId: "debug_eoa1@node1" },
      { name: "EOA2", nodeIndex: 0, uniqueId: "debug_eoa2@node1" }
    ];

    for (const config of identityConfigs) {
      const client = this.clients[config.nodeIndex].client;
      const verifier = client.getVerifiers(config.uniqueId)[0];
      
      this.identities.set(config.name, {
        verifier: verifier,
        client: client,
        uniqueId: config.uniqueId,
        address: await verifier.address()
      });
      
      console.log(`✅ ${config.name}: ${config.uniqueId} (${this.identities.get(config.name).address})`);
    }
  }

  async createTestGroup() {
    console.log("\n🏗️ Creating privacy group with ONLY EOA1...");
    
    const eoa1 = this.identities.get("EOA1");
    const primaryClient = this.clients[0].client;
    const penteFactory = new PenteFactory(primaryClient, "pente");
    
    const privacyGroupFuture = penteFactory.newPrivacyGroup({
      name: "DEBUG_GROUP_EOA1_ONLY",
      members: [eoa1.verifier],
      evmVersion: "shanghai",
      externalCallsEnabled: true,
      endorsementType: "group_scoped_identities"
    });

    const privacyGroup = await privacyGroupFuture.waitForDeploy();
    console.log(`✅ Privacy Group Created: ${privacyGroup.group.id}`);
    
    // Deploy contract
    const contractAddress = await privacyGroup.deploy({
      abi: SIMPLE_STORAGE_ABI,
      bytecode: SIMPLE_STORAGE_BYTECODE,
      from: eoa1.verifier.lookup,
      inputs: []
    }).waitForDeploy();
    
    console.log(`✅ Contract deployed: ${contractAddress}`);
    
    const TestContract = class extends require("@lfdecentralizedtrust-labs/paladin-sdk").PentePrivateContract {
      constructor(evm, address) {
        super(evm, SIMPLE_STORAGE_ABI, address);
      }
      
      using(paladin) {
        return new TestContract(this.evm.using(paladin), this.address);
      }
    };

    this.contract = new TestContract(privacyGroup, contractAddress);
    this.group = privacyGroup;
  }

  async testAccess(eoaName, operation, testValue = null) {
    const identity = this.identities.get(eoaName);
    console.log(`\n🔍 TESTING: ${eoaName} attempting ${operation}`);
    console.log(`   Identity: ${identity.uniqueId}`);
    console.log(`   Expected: ${eoaName === "EOA1" ? "ALLOWED" : "BLOCKED"}`);
    
    try {
      const contractWithIdentity = this.contract.using(identity.client);
      
      if (operation === "write") {
        console.log(`   🔄 Sending transaction...`);
        const receipt = await contractWithIdentity.sendTransaction({
          from: identity.verifier.lookup,
          function: "store",
          data: { num: testValue }
        }).waitForReceipt(10000);
        
        console.log(`🚨 ${eoaName} WRITE COMPLETED - Receipt: ${JSON.stringify(receipt?.success)}`);
        return receipt?.success;
        
      } else {
        console.log(`   🔄 Making call...`);
        const result = await contractWithIdentity.call({
          from: identity.verifier.lookup,
          function: "retrieve"
        });
        
        console.log(`🚨 ${eoaName} READ COMPLETED - Value: ${result.value}`);
        console.log(`   💡 If this shows a value, Paladin ALLOWED the read!`);
        return result.value;
      }
      
    } catch (error) {
      console.log(`✅ ${eoaName} BLOCKED by Paladin: ${error.message}`);
      return null;
    }
  }

  async runDebugTest() {
    try {
      await this.initialize();
      await this.createTestGroup();
      
      console.log("\n📝 DEBUG TEST SEQUENCE:");
      console.log("=======================");
      
      // 1. EOA1 writes initial value
      console.log("\n1. EOA1 (authorized) writes value 42:");
      await this.testAccess("EOA1", "write", 42);
      
      // 2. Both EOAs try to read
      console.log("\n2. Both EOAs attempt to read:");
      const eoa1ReadResult = await this.testAccess("EOA1", "read");
      const eoa2ReadResult = await this.testAccess("EOA2", "read");
      
      // 3. EOA2 tries to write
      console.log("\n3. EOA2 (unauthorized) attempts to write value 999:");
      const eoa2WriteResult = await this.testAccess("EOA2", "write", 999);
      
      // 4. Final read to check if unauthorized write succeeded
      console.log("\n4. Final read to check if unauthorized write succeeded:");
      const finalValue = await this.testAccess("EOA1", "read");
      
      console.log("\n🎯 ANALYSIS:");
      console.log("=============");
      console.log(`EOA1 Read Result: ${eoa1ReadResult} (Expected: 42)`);
      console.log(`EOA2 Read Result: ${eoa2ReadResult} (Expected: null/error)`);
      console.log(`EOA2 Write Result: ${eoa2WriteResult} (Expected: null/error)`);
      console.log(`Final Value: ${finalValue} (Should be 42 if security works)`);
      
      if (eoa2ReadResult !== null) {
        console.log("\n🚨 SECURITY ISSUE: EOA2 was able to read private data!");
      }
      
      if (eoa2WriteResult) {
        console.log("\n🚨 CRITICAL SECURITY ISSUE: EOA2 was able to write to private contract!");
      }
      
      if (finalValue === "999") {
        console.log("\n🚨 SECURITY BREACH: Unauthorized write succeeded!");
      }
      
    } catch (error) {
      console.error(`Debug test failed: ${error.message}`);
    }
  }
}

const debug = new DebugAccessValidator();
debug.runDebugTest().catch(console.error);
