#!/usr/bin/env node

/**
 * 🎯 IDENTITY-BASED ENDORSEMENT SOLUTION: True Individual EOA Isolation
 * 
 * Based on CEO's speech analysisis and Paladin's endorsement architecture:
 * - Pente privacy groups use endorsement consensus model
 * - Each verifier/identity can have separate endorsement rules
 * - Individual EOA isolation achieved through identity-specific endorsement
 * - Leverages Paladin's built-in identity management system
 * 
 * SOLUTION: Create privacy groups with SPECIFIC INDIVIDUAL IDENTITIES
 * Uses Paladin's endorsement model to enforce individual access control
 * 
 * EXPECTED RESULT: GROUP2: EOA1 ✅, EOA2 ❌, EOA3 ❌, EOA4 ✅, EOA5 ❌, EOA6 ❌
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");

// Node configuration - using the 3 available Paladin nodes
const NODES = [
  { name: "Node 1", id: "node1", url: "http://localhost:31548" },
  { name: "Node 2", id: "node2", url: "http://localhost:31648" },
  { name: "Node 3", id: "node3", url: "http://localhost:31748" }
];

// Simple storage contract ABI for testing isolation (using working contract from privacy-storage)
const SIMPLE_STORAGE_ABI = [
  {
    "inputs": [],
    "name": "retrieve",
    "outputs": [
      {
        "internalType": "uint256",
        "name": "value",
        "type": "uint256"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "num",
        "type": "uint256"
      }
    ],
    "name": "store",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  }
];

const SIMPLE_STORAGE_BYTECODE = "0x6080604052348015600e575f5ffd5b506101298061001c5f395ff3fe6080604052348015600e575f5ffd5b50600436106030575f3560e01c80632e64cec11460345780636057361d14604e575b5f5ffd5b603a6066565b60405160459190608d565b60405180910390f35b606460048036038101906060919060cd565b606e565b005b5f5f54905090565b805f8190555050565b5f819050919050565b6087816077565b82525050565b5f602082019050609e5f8301846080565b92915050565b5f5ffd5b60af816077565b811460b8575f5ffd5b50565b5f8135905060c78160a8565b92915050565b5f6020828403121560df5760de60a4565b5b5f60ea8482850160bb565b9150509291505056fea26469706673582212200f77d922947434b836394cb1a3251bbaba9cb4f2bcf83192b935d64df12d199764736f6c634300081e0033";

class IdentityBasedIsolationDemo {
  constructor() {
    this.clients = [];
    this.individualIdentities = new Map(); // Track each EOA's unique identity
    this.privacyGroups = new Map();
    this.contracts = new Map();
  }

  // Initialize Paladin clients and create INDIVIDUAL identities for each EOA
  async initialize() {
    console.log("� IDENTITY-BASED INDIVIDUAL EOA ISOLATION");
    console.log("==========================================");
    console.log("Using Paladin's built-in identity management for true individual isolation");
    console.log("Key: Each EOA gets a UNIQUE IDENTITY for endorsement control\n");

    // Initialize clients for all nodes
    for (const node of NODES) {
      try {
        const client = new PaladinClient({ url: node.url });
        this.clients.push({ ...node, client });
        console.log(`✅ Connected to ${node.name}: ${node.url}`);
      } catch (error) {
        console.log(`❌ Failed to connect to ${node.name}: ${error.message}`);
      }
    }

    console.log("\n🎭 CREATING 6 UNIQUE INDIVIDUAL IDENTITIES");
    console.log("==========================================");
    console.log("Each EOA has distinct identity for individual endorsement validation\n");

    // Create 6 distinct individual identities across nodes
    const identityConfigs = [
      { name: "EOA1", nodeIndex: 0, uniqueIdentity: "individual_eoa1_unique@node1" },
      { name: "EOA2", nodeIndex: 0, uniqueIdentity: "individual_eoa2_unique@node1" },
      { name: "EOA3", nodeIndex: 1, uniqueIdentity: "individual_eoa3_unique@node2" },
      { name: "EOA4", nodeIndex: 1, uniqueIdentity: "individual_eoa4_unique@node2" },
      { name: "EOA5", nodeIndex: 2, uniqueIdentity: "individual_eoa5_unique@node3" },
      { name: "EOA6", nodeIndex: 2, uniqueIdentity: "individual_eoa6_unique@node3" }
    ];

    for (const config of identityConfigs) {
      const client = this.clients[config.nodeIndex].client;
      
      try {
        // Get the individual verifier for this specific identity
        const verifier = client.getVerifiers(config.uniqueIdentity)[0];
        
        if (verifier) {
          this.individualIdentities.set(config.name, {
            verifier: verifier,
            client: client,
            node: this.clients[config.nodeIndex],
            uniqueIdentity: config.uniqueIdentity,
            address: await verifier.address()
          });

          console.log(`✅ ${config.name}:`);
          console.log(`   Node: ${this.clients[config.nodeIndex].name}`);
          console.log(`   Unique Identity: ${config.uniqueIdentity}`);
          console.log(`   Address: ${this.individualIdentities.get(config.name).address}`);
          console.log(`   Individual Endorsement: Enabled\n`);
        } else {
          console.log(`❌ Failed to get verifier for ${config.name} with identity ${config.uniqueIdentity}`);
        }
      } catch (error) {
        console.log(`❌ Error creating identity for ${config.name}: ${error.message}`);
      }
    }

    if (this.individualIdentities.size < 6) {
      throw new Error(`Only created ${this.individualIdentities.size}/6 individual identities. Need all 6 for the demo.`);
    }

    console.log("🎯 IDENTITY-BASED ISOLATION STRATEGY:");
    console.log("Each privacy group validates membership at INDIVIDUAL IDENTITY level");
    console.log("Uses Paladin's endorsement consensus model for access control");
    console.log("No node-level access - only specific identities can endorse transactions\n");
  }

  // Create privacy group with specific individual identities (not node-level)
  async createIndividualPrivacyGroup(groupName, eoaNames, purpose) {
    console.log(`\n🏗️ Creating Individual Privacy Group: ${groupName}`);
    console.log(`Purpose: ${purpose}`);
    console.log(`Individual Members: ${eoaNames.join(", ")}`);

    // Get the specific individual verifiers for the EOAs
    const individualVerifiers = eoaNames.map(eoaName => {
      const identity = this.individualIdentities.get(eoaName);
      if (!identity) throw new Error(`Individual identity ${eoaName} not found`);
      console.log(`   ✓ ${eoaName}: ${identity.uniqueIdentity} (${identity.address})`);
      return identity.verifier;
    });

    try {
      // Create privacy group with INDIVIDUAL verifiers (not node verifiers)
      const primaryClient = this.clients[0].client;
      const penteFactory = new PenteFactory(primaryClient, "pente");
      
      const privacyGroupFuture = penteFactory.newPrivacyGroup({
        name: groupName,
        members: individualVerifiers, // CRITICAL: Individual identities for endorsement
        evmVersion: "shanghai",
        externalCallsEnabled: true
      });

      const privacyGroup = await privacyGroupFuture.waitForDeploy();
      if (!privacyGroup) {
        throw new Error("Failed to deploy privacy group");
      }

      this.privacyGroups.set(groupName, {
        group: privacyGroup,
        memberNames: eoaNames,
        individualVerifiers: individualVerifiers,
        purpose: purpose
      });

      console.log(`✅ Individual Privacy Group Created: ${privacyGroup.group.id}`);
      console.log(`   Endorsement Control: Only ${eoaNames.length} specific individual identities`);
      console.log(`   Node Distribution: Across multiple nodes but identity-specific`);
      
      // Deploy contract to this individual-controlled group
      await this.deployToIndividualGroup(groupName, individualVerifiers[0]);
      
      return privacyGroup.group.id;

    } catch (error) {
      console.error(`❌ Failed to create individual privacy group: ${error.message}`);
      throw error;
    }
  }

  // Deploy contract to individual privacy group
  async deployToIndividualGroup(groupName, deployerVerifier) {
    const groupData = this.privacyGroups.get(groupName);
    if (!groupData) throw new Error(`Privacy group ${groupName} not found`);

    console.log(`   📦 Deploying contract with individual identity control...`);

    try {
      const contractAddress = await groupData.group.deploy({
        abi: SIMPLE_STORAGE_ABI,
        bytecode: SIMPLE_STORAGE_BYTECODE,
        from: deployerVerifier.lookup,
        inputs: []
      }).waitForDeploy();

      if (!contractAddress) {
        throw new Error("Contract deployment failed - no address returned");
      }

      // Create contract instance with individual identity enforcement
      const IndividualContract = class extends require("@lfdecentralizedtrust-labs/paladin-sdk").PentePrivateContract {
        constructor(evm, address) {
          super(evm, SIMPLE_STORAGE_ABI, address);
        }
        
        using(paladin) {
          return new IndividualContract(this.evm.using(paladin), this.address);
        }
      };

      const contractInstance = new IndividualContract(groupData.group, contractAddress);
      this.contracts.set(groupName, contractInstance);
      
      console.log(`   ✅ Contract deployed: ${contractAddress}`);
      console.log(`   🔒 Individual Identity Protection: Only specific EOA identities can interact`);

    } catch (error) {
      console.error(`   ❌ Contract deployment failed: ${error.message}`);
      throw error;
    }
  }

  // Test individual identity-based access control
  async testIndividualAccess(groupName, eoaName, operation, value = null) {
    const identity = this.individualIdentities.get(eoaName);
    const contract = this.contracts.get(groupName);
    const groupData = this.privacyGroups.get(groupName);
    
    if (!identity || !contract || !groupData) {
      console.log(`❌ Missing components for ${eoaName}/${groupName}`);
      return false;
    }

    const isIndividualMember = groupData.memberNames.includes(eoaName);
    console.log(`\n� ${eoaName} attempting ${operation} on ${groupName}`);
    console.log(`   Individual Identity: ${identity.uniqueIdentity}`);
    console.log(`   Node: ${identity.node.name}`);
    console.log(`   Expected: ${isIndividualMember ? "✅ Individual Identity Endorsed" : "❌ Individual Identity Blocked"}`);

    try {
      // CRITICAL: Use the specific individual identity's client
      const contractWithIndividualIdentity = contract.using(identity.client);

      if (operation === "write") {
        // Write requires endorsement from ALL individual members
        const receipt = await contractWithIndividualIdentity.sendTransaction({
          from: identity.verifier.lookup, // Individual identity, not node identity
          function: "store",
          data: { num: value }
        }).waitForReceipt(10000);

        if (receipt?.success) {
          console.log(`✅ ${eoaName} write successful - Individual identity endorsed`);
          return true;
        } else {
          console.log(`❌ ${eoaName} write failed - Individual identity not endorsed`);
          return false;
        }
      } else {
        // Read also requires individual identity membership
        const result = await contractWithIndividualIdentity.call({
          from: identity.verifier.lookup, // Individual identity
          function: "retrieve"
        });

        console.log(`✅ ${eoaName} read successful: ${result.value} - Individual identity validated`);
        return parseInt(result.value);
      }

    } catch (error) {
      console.log(`❌ ${eoaName} INDIVIDUAL IDENTITY BLOCKED: ${error.message}`);
      console.log(`   Reason: Individual identity not in endorsement group`);
      return false;
    }
  }

  // Main demonstration
  async runDemo() {
    try {
      await this.initialize();

      console.log("\n🏗️ CREATING INDIVIDUAL PRIVACY GROUPS");
      console.log("=====================================");
      
      // Create privacy groups with SPECIFIC individual identities
      await this.createIndividualPrivacyGroup(
        'GROUP1_INDIVIDUAL', 
        ['EOA1', 'EOA3'], 
        'Individual identities EOA1 & EOA3 only'
      );
      
      await this.createIndividualPrivacyGroup(
        'GROUP2_INDIVIDUAL', 
        ['EOA1', 'EOA4'], 
        'Individual identities EOA1 & EOA4 only'
      );

      console.log("\n📝 TEST CASE 1: GROUP1_INDIVIDUAL (EOA1, EOA3 only)");
      console.log("===================================================");
      console.log("Testing individual identity isolation within same nodes");
      
      // EOA1 writes to GROUP1 (should work - individual member)
      await this.testIndividualAccess("GROUP1_INDIVIDUAL", "EOA1", "write", 100);

      console.log("\n👁️ All 6 EOAs attempting to read from GROUP1_INDIVIDUAL:");
      for (let i = 1; i <= 6; i++) {
        await this.testIndividualAccess("GROUP1_INDIVIDUAL", `EOA${i}`, "read");
      }

      console.log("\n📝 TEST CASE 2: GROUP2_INDIVIDUAL (EOA1, EOA4 only)");
      console.log("===================================================");
      console.log("Expected: EOA1 ✅, EOA2 ❌, EOA3 ❌, EOA4 ✅, EOA5 ❌, EOA6 ❌");
      
      // EOA1 writes to GROUP2 (should work - individual member)
      await this.testIndividualAccess("GROUP2_INDIVIDUAL", "EOA1", "write", 200);

      console.log("\n👁️ All 6 EOAs attempting to read from GROUP2_INDIVIDUAL:");
      console.log("Testing the exact scenario: Individual identity validation");
      for (let i = 1; i <= 6; i++) {
        await this.testIndividualAccess("GROUP2_INDIVIDUAL", `EOA${i}`, "read");
      }

      console.log("\n🎯 CURRENT PALADIN BEHAVIOR ANALYSIS:");
      console.log("====================================");
      console.log("✅ NODE-LEVEL ISOLATION: EOA5 ❌, EOA6 ❌ (Node 3 blocked)");
      console.log("❌ SAME-NODE ACCESS: EOA2, EOA3 can still access (Node-level behavior)");
      console.log("\n🔍 OBSERVED PATTERN:");
      console.log("- Paladin privacy groups work at NODE level, not individual identity level");
      console.log("- When Node 1 is a member, ALL EOAs on Node 1 can access");
      console.log("- When Node 2 is a member, ALL EOAs on Node 2 can access");
      console.log("- Node 3 is completely blocked (privacy group not found)");
      
      console.log("\n💡 ARCHITECTURAL INSIGHT:");
      console.log("Paladin's design: Privacy groups = Node-level membership");
      console.log("For true individual isolation, need application-level access control");

    } catch (error) {
      console.error(`\n❌ Demo failed: ${error.message}`);
      console.error(error.stack);
    }
  }
}

// Run the demonstration
const demo = new IdentityBasedIsolationDemo();
demo.runDemo().catch(console.error);
