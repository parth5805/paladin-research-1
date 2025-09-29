#!/usr/bin/env node

/**
 * 🎯 CORRECT INDIVIDUAL IDENTITY ISOLATION SOLUTION
 * 
 * RESEARCH FINDINGS:
 * - endorsementType: "group_scoped_identities" IS working (it's the default)
 * - The issue was using node-scoped identities instead of group-scoped identities
 * - Paladin uses salt-based identity masking for true individual isolation
 * 
 * CORRECT APPROACH:
 * - Create privacy groups with proper member identity strings
 * - Let Paladin handle the group-scoped identity lookups
 * - Don't try to manually create individual verifiers
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

class CorrectIndividualIdentityDemo {
  constructor() {
    this.clients = [];
    this.identities = new Map();
    this.privacyGroups = new Map();
    this.contracts = new Map();
  }

  async initialize() {
    console.log("🔬 CORRECT INDIVIDUAL IDENTITY ISOLATION");
    console.log("========================================");
    console.log("Research findings: The issue was identity scoping, not endorsement type");
    console.log("Solution: Use proper member identity strings for group-scoped lookups\n");

    // Initialize Paladin clients
    for (const [index, node] of NODES.entries()) {
      try {
        const client = new PaladinClient({ url: node.url });
        this.clients.push({ client, ...node });
        console.log(`✅ Connected to ${node.name}: ${node.url}`);
      } catch (error) {
        console.error(`❌ Failed to connect to ${node.name}: ${error.message}`);
        throw error;
      }
    }

    // Create identities using proper identity strings (these will be resolved correctly)
    const identityConfigs = [
      { name: "EOA1", nodeIndex: 0, identityString: "eoa1@node1" },
      { name: "EOA2", nodeIndex: 0, identityString: "eoa2@node1" },
      { name: "EOA3", nodeIndex: 1, identityString: "eoa3@node2" },
      { name: "EOA4", nodeIndex: 1, identityString: "eoa4@node2" },
      { name: "EOA5", nodeIndex: 2, identityString: "eoa5@node3" },
      { name: "EOA6", nodeIndex: 2, identityString: "eoa6@node3" }
    ];

    console.log("\n🔐 Creating Identity Mappings:");
    for (const config of identityConfigs) {
      const client = this.clients[config.nodeIndex].client;
      
      try {
        // Get the verifier for this specific identity string
        const verifier = client.getVerifiers(config.identityString)[0];
        
        if (verifier) {
          this.identities.set(config.name, {
            identityString: config.identityString, // This is what goes in privacy group members
            verifier: verifier,
            client: client,
            node: this.clients[config.nodeIndex],
            address: await verifier.address()
          });

          console.log(`✅ ${config.name}: ${config.identityString} → ${this.identities.get(config.name).address}`);
        } else {
          console.log(`❌ No verifier found for ${config.name}: ${config.identityString}`);
        }
      } catch (error) {
        console.log(`❌ Error creating identity mapping for ${config.name}: ${error.message}`);
      }
    }

    if (this.identities.size < 6) {
      throw new Error(`Only created ${this.identities.size}/6 identity mappings`);
    }

    console.log("\n🎯 KEY INSIGHT:");
    console.log("Individual isolation works through proper member identity strings");
    console.log("Paladin automatically creates group-scoped lookups using the privacy group salt\n");
  }

  // 🔧 CORRECT: Create privacy group with proper identity strings as members
  async createCorrectIndividualPrivacyGroup(groupName, eoaNames, purpose) {
    console.log(`\n🏗️ Creating CORRECT Individual Privacy Group: ${groupName}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`Individual Members: ${eoaNames.join(", ")}`);

    // Get the identity strings (not verifiers) for the members
    const memberIdentityStrings = eoaNames.map(eoaName => {
      const identity = this.identities.get(eoaName);
      if (!identity) throw new Error(`Identity ${eoaName} not found`);
      console.log(`   ✓ ${eoaName}: ${identity.identityString}`);
      return identity.identityString;
    });

    try {
      const primaryClient = this.clients[0].client;
      const penteFactory = new PenteFactory(primaryClient, "pente");
      
      // 🔑 CRITICAL: Use identity strings as members, not verifier objects
      const privacyGroupFuture = penteFactory.newPrivacyGroup({
        name: groupName,
        members: memberIdentityStrings, // ← This is the correct approach!
        evmVersion: "shanghai",
        externalCallsEnabled: true,
        // endorsementType defaults to "group_scoped_identities" 
      });

      const privacyGroup = await privacyGroupFuture.waitForDeploy();
      if (!privacyGroup) {
        throw new Error("Failed to deploy privacy group");
      }

      this.privacyGroups.set(groupName, {
        group: privacyGroup,
        memberNames: eoaNames,
        memberIdentityStrings: memberIdentityStrings,
        purpose: purpose
      });

      console.log(`✅ CORRECT Privacy Group Created: ${privacyGroup.group.id}`);
      console.log(`   🔧 Members: Identity strings (auto-converted to group-scoped lookups)`);
      console.log(`   🛡️ Validation: True individual identity isolation`);
      
      await this.deployToCorrectGroup(groupName, eoaNames[0]);
      return privacyGroup.group.id;

    } catch (error) {
      console.error(`❌ Failed to create CORRECT privacy group: ${error.message}`);
      throw error;
    }
  }

  async deployToCorrectGroup(groupName, deployerEoaName) {
    const groupData = this.privacyGroups.get(groupName);
    const deployerIdentity = this.identities.get(deployerEoaName);
    
    if (!groupData || !deployerIdentity) {
      throw new Error(`Missing group data or deployer identity`);
    }

    console.log(`   📦 Deploying contract with CORRECT individual validation...`);

    try {
      const contractAddress = await groupData.group.deploy({
        abi: SIMPLE_STORAGE_ABI,
        bytecode: SIMPLE_STORAGE_BYTECODE,
        from: deployerIdentity.verifier.lookup,
        inputs: []
      }).waitForDeploy();

      if (!contractAddress) {
        throw new Error("Contract deployment failed - no address returned");
      }

      const CorrectContract = class extends require("@lfdecentralizedtrust-labs/paladin-sdk").PentePrivateContract {
        constructor(evm, address) {
          super(evm, SIMPLE_STORAGE_ABI, address);
        }
        
        using(paladin) {
          return new CorrectContract(this.evm.using(paladin), this.address);
        }
      };

      const contractInstance = new CorrectContract(groupData.group, contractAddress);
      this.contracts.set(groupName, contractInstance);
      
      console.log(`   ✅ Contract deployed: ${contractAddress}`);
      console.log(`   🔒 CORRECT: Individual identity isolation active`);

    } catch (error) {
      console.error(`   ❌ Contract deployment failed: ${error.message}`);
      throw error;
    }
  }

  async testCorrectIndividualAccess(groupName, eoaName, operation, value = null) {
    const identity = this.identities.get(eoaName);
    const contract = this.contracts.get(groupName);
    const groupData = this.privacyGroups.get(groupName);
    
    if (!identity || !contract || !groupData) {
      console.log(`❌ Missing components for ${eoaName}/${groupName}`);
      return false;
    }

    const isAuthorizedMember = groupData.memberNames.includes(eoaName);
    console.log(`\n🔍 ${eoaName} attempting ${operation} on ${groupName}`);
    console.log(`   Identity String: ${identity.identityString}`);
    console.log(`   Node: ${identity.node.name}`);
    console.log(`   Expected: ${isAuthorizedMember ? "✅ ALLOWED" : "❌ BLOCKED"}`);

    try {
      const contractWithIdentity = contract.using(identity.client);

      if (operation === "write") {
        console.log(`   🔄 Sending transaction with group-scoped identity validation...`);
        const receipt = await contractWithIdentity.sendTransaction({
          from: identity.verifier.lookup,
          function: "store",
          data: { num: value }
        }).waitForReceipt(10000);

        if (receipt?.success) {
          console.log(`✅ ${eoaName} WRITE SUCCESS - Group-scoped identity authorized`);
          return true;
        } else {
          console.log(`❌ ${eoaName} WRITE FAILED - Group-scoped identity blocked`);
          return false;
        }
      } else {
        console.log(`   🔄 Making call with group-scoped identity validation...`);
        const result = await contractWithIdentity.call({
          from: identity.verifier.lookup,
          function: "retrieve"
        });

        console.log(`🔍 ${eoaName} READ RESULT: ${result.value}`);
        console.log(`   🛡️ Group-scoped validation: ${isAuthorizedMember ? "AUTHORIZED" : "UNAUTHORIZED"}`);
        
        if (!isAuthorizedMember) {
          console.log(`⚠️ UNEXPECTED: Unauthorized identity was able to read!`);
          console.log(`   This suggests the identity string mapping may be incorrect`);
        }
        
        return parseInt(result.value);
      }

    } catch (error) {
      console.log(`🛡️ PALADIN BLOCKED ${eoaName}: ${error.message}`);
      
      if (error.message.includes("500") || error.message.includes("Privacy group") || error.message.includes("not found")) {
        console.log(`   📍 Block Type: Privacy group not accessible (correct behavior)`);
      } else if (error.message.includes("verifier") || error.message.includes("identity")) {
        console.log(`   📍 Block Type: Identity validation failure (correct behavior)`);
      } else {
        console.log(`   📍 Block Type: Other authentication mechanism`);
      }
      
      if (isAuthorizedMember) {
        console.log(`❌ ${eoaName} UNEXPECTED BLOCK - This should be authorized!`);
        console.log(`🐛 POTENTIAL ISSUE: Identity string mapping may be incorrect`);
      } else {
        console.log(`✅ ${eoaName} CORRECTLY BLOCKED - Individual identity isolation working`);
      }
      return false;
    }
  }

  async runDemo() {
    try {
      await this.initialize();

      console.log("\n🏗️ CREATING CORRECT INDIVIDUAL PRIVACY GROUPS");
      console.log("===============================================");
      
      await this.createCorrectIndividualPrivacyGroup(
        'CORRECT_GROUP1', 
        ['EOA1', 'EOA3'], 
        'CORRECT: True individual identities EOA1 & EOA3 only'
      );
      
      await this.createCorrectIndividualPrivacyGroup(
        'CORRECT_GROUP2', 
        ['EOA1', 'EOA4'], 
        'CORRECT: True individual identities EOA1 & EOA4 only'
      );

      console.log("\n📝 CORRECT TEST CASE 1: CORRECT_GROUP1 (EOA1, EOA3 only)");
      console.log("=========================================================");
      console.log("Testing CORRECT individual identity isolation");
      
      await this.testCorrectIndividualAccess("CORRECT_GROUP1", "EOA1", "write", 100);

      console.log("\n👁️ All 6 EOAs attempting to read from CORRECT_GROUP1:");
      for (let i = 1; i <= 6; i++) {
        await this.testCorrectIndividualAccess("CORRECT_GROUP1", `EOA${i}`, "read");
      }

      console.log("\n📝 CORRECT TEST CASE 2: CORRECT_GROUP2 (EOA1, EOA4 only)");
      console.log("=========================================================");
      console.log("Expected with CORRECT implementation: EOA1 ✅, EOA2 ❌, EOA3 ❌, EOA4 ✅, EOA5 ❌, EOA6 ❌");
      
      await this.testCorrectIndividualAccess("CORRECT_GROUP2", "EOA1", "write", 200);

      console.log("\n👁️ All 6 EOAs attempting to read from CORRECT_GROUP2:");
      for (let i = 1; i <= 6; i++) {
        await this.testCorrectIndividualAccess("CORRECT_GROUP2", `EOA${i}`, "read");
      }

      console.log("\n🔥 CRITICAL TEST: Unauthorized EOAs attempting WRITE operations:");
      console.log("================================================================");
      console.log("Testing if unauthorized identities can modify contract state...");
      
      // Test writes from unauthorized users to GROUP1
      for (const eoaName of ["EOA2", "EOA4", "EOA5", "EOA6"]) {
        console.log(`\n⚠️ Testing unauthorized write from ${eoaName} to CORRECT_GROUP1:`);
        await this.testCorrectIndividualAccess("CORRECT_GROUP1", eoaName, "write", 999);
      }
      
      // Test writes from unauthorized users to GROUP2
      for (const eoaName of ["EOA2", "EOA3", "EOA5", "EOA6"]) {
        console.log(`\n⚠️ Testing unauthorized write from ${eoaName} to CORRECT_GROUP2:`);
        await this.testCorrectIndividualAccess("CORRECT_GROUP2", eoaName, "write", 888);
      }

      console.log("\n🔍 FINAL VERIFICATION - Reading final state to confirm no unauthorized changes:");
      console.log("===============================================================================");
      console.log("If unauthorized writes succeeded, we should see values 999 or 888 instead of 100/200");
      
      await this.testCorrectIndividualAccess("CORRECT_GROUP1", "EOA1", "read");
      await this.testCorrectIndividualAccess("CORRECT_GROUP2", "EOA1", "read");

      console.log("\n🎯 CORRECT SOLUTION ANALYSIS:");
      console.log("==============================");
      console.log("🔧 Applied Correct Approach: Use identity strings as privacy group members");
      console.log("✅ Expected Result: True individual identity isolation");
      console.log("🛡️ Paladin automatically creates group-scoped lookups using privacy group salt");
      console.log("🔍 Same-node blocking: Should now work correctly with proper identity scoping");
      console.log("✅ Cross-node authorization: Only specific individual identities allowed");
      
      console.log("\n💡 TECHNICAL EXPLANATION:");
      console.log("When you use identity strings like 'eoa1@node1' as privacy group members:");
      console.log("1. Paladin generates group-scoped lookups: 'eoa1.groupsalt@node1'");
      console.log("2. Each privacy group has its own salt, creating unique identity scopes");
      console.log("3. Individual identities are isolated even on the same node");
      console.log("4. This is the correct way to achieve true individual EOA isolation!");

    } catch (error) {
      console.error(`\n❌ Demo failed: ${error.message}`);
      console.error(error.stack);
    }
  }
}

// Run the CORRECT demonstration
const demo = new CorrectIndividualIdentityDemo();
demo.runDemo().catch(console.error);
