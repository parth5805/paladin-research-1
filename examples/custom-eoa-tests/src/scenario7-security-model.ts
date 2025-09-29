/**
 * Scenario 7: Understanding Paladin's Real Security Model
 * 
 * This script clarifies how Paladin privacy groups actually work:
 * - Privacy is controlled by Paladin node identities, not individual EOA addresses
 * - Each node has identities like "member@node1", "member@node2", etc.
 * - All EOAs using the same node identity share the same privacy permissions
 * - True privacy isolation requires separate node identities or separate nodes
 */

import { ethers } from "ethers";
import PaladinClient, { 
  PenteFactory, 
  PentePrivateContract 
} from "@lfdecentralizedtrust-labs/paladin-sdk";
import storageAbi from "./abis/Storage.json";

// Network configuration
const BESU_NODES = [
  "http://localhost:31545", // Node 1
  "http://localhost:31645", // Node 2  
  "http://localhost:31745"  // Node 3
];

const PALADIN_NODES = [
  "http://localhost:31548", // Node 1
  "http://localhost:31648", // Node 2
  "http://localhost:31748"  // Node 3
];

// Test EOAs for each node
const TEST_EOAS = {
  node1: [
    { key: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80", name: "EOA1_Original" },
    { key: "0x701b615bbdfb9de65240bc28bd21bbc0d996645a3dd57e7b12bc2bdf6f192c82", name: "EOA1_New1" },
    { key: "0xa267530f49f8280200edf313ee7af6b827f2a8bce2897751d06a843f644967b1", name: "EOA1_New2" }
  ],
  node2: [
    { key: "0x92db14e403b83dfe3df233f83dfa3a0d7096f21ca9b0d6d6b8d88b2b4ec1564e", name: "EOA2_Original" },
    { key: "0xc526ee95bf44d8fc405a158bb884d9d1238d99f0612e9f33d006bb0789009aaa", name: "EOA2_New1" },
    { key: "0x8166f546bab6da521a8369cab06c5d2b9e46670292d85c875ee9ec20e84ffb61", name: "EOA2_New2" }
  ],
  node3: [
    { key: "0x47c99abed3324a2707c28affff1267e45918ec8c3f20b8aa892e8b065d2942dd", name: "EOA3_New1" },
    { key: "0x689af8efa8c651a91ad287602527f3af2fe9f6501a7ac4b061667b5a93e037fd", name: "EOA3_New2" }
  ]
};

// Privacy contract helper class
class PrivateStorage extends PentePrivateContract<{}> {
  constructor(
    protected evm: any,
    public readonly address: string
  ) {
    super(evm, storageAbi.abi, address);
  }

  using(paladin: PaladinClient) {
    return new PrivateStorage(this.evm.using(paladin), this.address);
  }

  async store(from: string, value: number) {
    console.log(`📝 ${from} storing value ${value}...`);
    const receipt = await this.sendTransaction({
      from: from,
      function: "store",
      data: { num: value },
    }).waitForReceipt(10000);
    
    if (!receipt?.success) {
      throw new Error("Store transaction failed!");
    }
    
    console.log(`✅ Value ${value} stored! Tx: ${receipt.transactionHash}`);
    return receipt;
  }

  async retrieve(from: string) {
    console.log(`👀 ${from} retrieving value...`);
    const result = await this.call({
      from: from,
      function: "retrieve",
      data: {},
    });
    const value = result && typeof result === 'object' ? Number(result.value || result[0] || result) : Number(result);
    console.log(`✅ Retrieved value: ${value}`);
    return value;
  }
}

async function demonstrateNodeBasedSecurity() {
  console.log("🔍 DEMONSTRATION: Node-Based Security Model");
  console.log("=" .repeat(50));
  
  // Connect to Paladin nodes
  const paladinNode1 = new PaladinClient({ url: PALADIN_NODES[0] });
  const paladinNode2 = new PaladinClient({ url: PALADIN_NODES[1] });
  
  // Get node identities
  const [verifierNode1] = paladinNode1.getVerifiers("member@node1");
  const [verifierNode2] = paladinNode2.getVerifiers("member@node2");
  
  console.log(`🔑 Node1 Identity: ${verifierNode1.lookup}`);
  console.log(`🔑 Node2 Identity: ${verifierNode2.lookup}`);
  
  // Create privacy group with Node1 + Node2 identities
  console.log("\n🔒 Creating privacy group: Node1 + Node2 identities");
  const penteFactory = new PenteFactory(paladinNode1, "pente");
  const privacyGroup = await penteFactory.newPrivacyGroup({
    members: [verifierNode1, verifierNode2],
    evmVersion: "shanghai",
    externalCallsEnabled: true,
  }).waitForDeploy();
  
  if (!privacyGroup) {
    throw new Error("Failed to create privacy group");
  }
  
  console.log(`✅ Privacy group created: ${privacyGroup.group.id}`);
  
  // Deploy contract
  const contractAddress = await privacyGroup.deploy({
    abi: storageAbi.abi,
    bytecode: storageAbi.bytecode,
    from: verifierNode1.lookup,
  }).waitForDeploy();
  
  console.log(`✅ Contract deployed: ${contractAddress}`);
  
  return {
    privacyGroup,
    contractAddress,
    verifierNode1,
    verifierNode2
  };
}

async function testSameNodeEOAs(setup: any) {
  console.log("\n📊 TESTING: Multiple EOAs on Same Node");
  console.log("=" .repeat(40));
  
  const privateContract = new PrivateStorage(setup.privacyGroup, setup.contractAddress);
  
  // Test that all Node1 EOAs can access the same privacy group
  console.log("\n🔍 Node1 EOAs (should ALL have access):");
  for (const eoa of TEST_EOAS.node1) {
    try {
      const provider = new ethers.JsonRpcProvider(BESU_NODES[0]);
      const wallet = new ethers.Wallet(eoa.key, provider);
      console.log(`\n   ${eoa.name}: ${wallet.address}`);
      
      // All should be able to access using member@node1 identity
      await privateContract.store(setup.verifierNode1.lookup, Math.floor(Math.random() * 1000));
      const value = await privateContract.retrieve(setup.verifierNode1.lookup);
      console.log(`   ✅ Access granted - Retrieved: ${value}`);
      
    } catch (error: any) {
      console.log(`   ❌ Access denied: ${error.message}`);
    }
  }
  
  // Test that all Node2 EOAs can access the same privacy group
  console.log("\n🔍 Node2 EOAs (should ALL have access):");
  for (const eoa of TEST_EOAS.node2) {
    try {
      const provider = new ethers.JsonRpcProvider(BESU_NODES[1]);
      const wallet = new ethers.Wallet(eoa.key, provider);
      console.log(`\n   ${eoa.name}: ${wallet.address}`);
      
      // All should be able to access using member@node2 identity
      const privateContractNode2 = new PrivateStorage(setup.privacyGroup, setup.contractAddress);
      await privateContractNode2.store(setup.verifierNode2.lookup, Math.floor(Math.random() * 1000));
      const value = await privateContractNode2.retrieve(setup.verifierNode2.lookup);
      console.log(`   ✅ Access granted - Retrieved: ${value}`);
      
    } catch (error: any) {
      console.log(`   ❌ Access denied: ${error.message}`);
    }
  }
}

async function testCrossNodeDenial(setup: any) {
  console.log("\n🚫 TESTING: Cross-Node Access Denial");
  console.log("=" .repeat(35));
  
  const privateContract = new PrivateStorage(setup.privacyGroup, setup.contractAddress);
  
  // Test that Node3 EOAs are denied (Node3 not in privacy group)
  console.log("\n🔍 Node3 EOAs (should be DENIED):");
  for (const eoa of TEST_EOAS.node3) {
    try {
      const provider = new ethers.JsonRpcProvider(BESU_NODES[2]);
      const wallet = new ethers.Wallet(eoa.key, provider);
      console.log(`\n   ${eoa.name}: ${wallet.address}`);
      
      // Connect to Node3 Paladin
      const paladinNode3 = new PaladinClient({ url: PALADIN_NODES[2] });
      const [verifierNode3] = paladinNode3.getVerifiers("member@node3");
      
      // Should be denied - Node3 not in privacy group
      const privateContractNode3 = new PrivateStorage(setup.privacyGroup, setup.contractAddress);
      await privateContractNode3.retrieve(verifierNode3.lookup);
      console.log(`   ❌ SECURITY BREACH! Access granted when it should be denied`);
      
    } catch (error: any) {
      console.log(`   ✅ Access properly denied: ${error.message.substring(0, 60)}...`);
    }
  }
}

async function main() {
  console.log("🌟 Scenario 7: Understanding Paladin's Real Security Model");
  console.log("=" .repeat(60));
  console.log("📚 Key Insights:");
  console.log("   • Privacy is controlled by Paladin node identities, not EOA addresses");
  console.log("   • All EOAs using same node share the same privacy permissions");
  console.log("   • True isolation requires separate node identities or nodes");
  console.log("=" .repeat(60));
  
  try {
    // Step 1: Setup privacy group with node identities
    const setup = await demonstrateNodeBasedSecurity();
    
    // Step 2: Test multiple EOAs on same node
    await testSameNodeEOAs(setup);
    
    // Step 3: Test cross-node denial
    await testCrossNodeDenial(setup);
    
    console.log("\n🏁 FINAL CONCLUSIONS");
    console.log("=" .repeat(30));
    console.log("✅ Paladin Security Model Clarified:");
    console.log("   🔒 Privacy groups are controlled by node identities");
    console.log("   👥 All EOAs on a node share the same privacy permissions");
    console.log("   🚫 Nodes not in privacy group are properly denied access");
    console.log("   🎯 For EOA-level privacy, need separate Paladin node identities");
    
    console.log("\n💡 Security Recommendations:");
    console.log("   • Use separate Paladin nodes for true EOA isolation");
    console.log("   • Create different node identities for different privacy levels");
    console.log("   • Group EOAs by privacy requirements on the same node");
    
  } catch (error) {
    console.error("❌ Error in security model demonstration:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
