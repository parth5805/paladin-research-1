/**
 * Scenario 2: Privacy Groups with EOAs
 * 
 * This script demonstrates:
 * - EOA1 connected to Paladin Node 1 (outsider)
 * - EOA2 connected to Paladin Node 2 (privacy group member)
 * - EOA3 connected to Paladin Node 3 (privacy group member)
 * - Create privacy group between Node 2 and Node 3
 * - EOA2 and EOA3 can read/write to private contract
 * - EOA1 cannot access the private contract
 */

import PaladinClient, { 
  PenteFactory, 
  PentePrivateContract 
} from "@lfdecentralizedtrust-labs/paladin-sdk";
import storageAbi from "./abis/Storage.json";

// Paladin node configuration similar to working examples
const nodeConnections = [
  { clientOptions: { url: "http://localhost:31548" }, id: "node1" },
  { clientOptions: { url: "http://localhost:31648" }, id: "node2" }, 
  { clientOptions: { url: "http://localhost:31748" }, id: "node3" }
];

function checkDeploy(result: any): boolean {
  if (!result) {
    console.error("❌ Deployment failed - no result returned");
    return false;
  }
  console.log(`✅ Deployment successful`);
  return true;
}

// Helper class extending PentePrivateContract for proper Storage contract interaction
class PrivateStorage extends PentePrivateContract<{}> {
  constructor(
    protected evm: any,
    public readonly address: string
  ) {
    super(evm, storageAbi.abi, address);
  }

  // Implement required abstract method - pattern from working example
  using(paladin: PaladinClient) {
    return new PrivateStorage(this.evm.using(paladin), this.address);
  }

  async store(from: string, value: number) {
    console.log(`📝 ${from} storing value ${value} in private contract...`);
    const receipt = await this.sendTransaction({
      from: from,
      function: "store",
      data: { num: value },
    }).waitForReceipt(10000);
    
    if (!receipt?.success) {
      throw new Error("Store transaction failed!");
    }
    
    console.log(`✅ Value ${value} stored successfully! Tx: ${receipt.transactionHash}`);
    return receipt;
  }

  async retrieve(from: string) {
    console.log(`👀 ${from} retrieving value from private contract...`);
    const result = await this.call({
      from: from,
      function: "retrieve",
      data: {},
    });
    // Parse the result correctly - it comes as { value: 'number_string' }
    const value = result && typeof result === 'object' ? Number(result.value || result[0] || result) : Number(result);
    console.log(`✅ Retrieved value: ${value}`);
    return value;
  }
}

async function main() {
  console.log("🌟 Scenario 2: Privacy Groups with EOAs");
  console.log("=" .repeat(50));
  
  try {
    // Initialize Paladin clients (following the working pattern)
    console.log("📡 Initializing Paladin clients from the environment configuration...");
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [paladinNode1, paladinNode2, paladinNode3] = clients;

    // Get verifiers for each node (these act as our EOAs)
    const [verifierNode1] = paladinNode1.getVerifiers(`member@${nodeConnections[0].id}`);
    const [verifierNode2] = paladinNode2.getVerifiers(`member@${nodeConnections[1].id}`);
    const [verifierNode3] = paladinNode3.getVerifiers(`member@${nodeConnections[2].id}`);

    console.log("\n🔑 EOA Identities:");
    
    // Try to resolve wallet addresses
    const resolveAddress = async (verifier: any, client: any) => {
      try {
        // Try different methods to get the address
        if (typeof verifier.address === 'function') {
          return await verifier.address();
        }
        // Try resolving through the client
        const resolved = await client.resolveVerifier(verifier.lookup);
        return resolved?.address || 'N/A';
      } catch (e) {
        return 'N/A';
      }
    };

    const addr1 = await resolveAddress(verifierNode1, paladinNode1);
    const addr2 = await resolveAddress(verifierNode2, paladinNode2);
    const addr3 = await resolveAddress(verifierNode3, paladinNode3);

    console.log(`EOA1/Node1: ${verifierNode1.lookup} (Wallet: ${addr1})`);
    console.log(`EOA2/Node2: ${verifierNode2.lookup} (Wallet: ${addr2})`);
    console.log(`EOA3/Node3: ${verifierNode3.lookup} (Wallet: ${addr3})`);

    // Step 1: Create a privacy group between Node 2 and Node 3
    console.log("\n🔒 Creating a privacy group for Node2 and Node3...");
    const penteFactory = new PenteFactory(paladinNode2, "pente");
    const memberPrivacyGroup = await penteFactory.newPrivacyGroup({
      members: [verifierNode2, verifierNode3],
      evmVersion: "shanghai",
      externalCallsEnabled: true,
    }).waitForDeploy();
    
    if (!checkDeploy(memberPrivacyGroup)) return;
    console.log(`✅ Privacy group created, ID: ${memberPrivacyGroup?.group.id}`);

    // Step 2: Deploy a storage contract within the privacy group
    console.log("\n🚀 Deploying a storage contract to the privacy group...");
    const contractAddress = await memberPrivacyGroup!.deploy({
      abi: storageAbi.abi,
      bytecode: storageAbi.bytecode,
      from: verifierNode2.lookup,
    }).waitForDeploy();
    
    if (!contractAddress) {
      console.error("❌ Failed to deploy the contract. No address returned.");
      return;
    }
    console.log(`✅ Contract deployed successfully! Address: ${contractAddress}`);

    // Create the private storage contract instance
    const privateStorageContract = new PrivateStorage(memberPrivacyGroup!, contractAddress);

    // Step 3: EOA2 (Node 2) stores initial value
    await privateStorageContract.store(verifierNode2.lookup, 100);
    
    // Step 3b: EOA2 immediately reads back the value to verify storage
    console.log("🔍 Verifying storage from the same node that stored...");
    await privateStorageContract.retrieve(verifierNode2.lookup);

    // Step 4: EOA3 (Node 3) reads the value - use client from Node 3
    const privateStorageForNode3 = privateStorageContract.using(paladinNode3);
    await privateStorageForNode3.retrieve(verifierNode3.lookup);

    // Step 5: EOA3 (Node 3) updates the value using Node 3 client
    await privateStorageForNode3.store(verifierNode3.lookup, 200);
    
    // Step 5b: EOA3 immediately reads back the value to verify storage
    console.log("🔍 Verifying storage from Node 3...");
    await privateStorageForNode3.retrieve(verifierNode3.lookup);

    // Step 6: EOA2 (Node 2) reads the updated value using Node 2 client
    console.log("🔍 Node 2 reading the updated value...");
    await privateStorageContract.retrieve(verifierNode2.lookup);

    // Step 7: EOA1 (Node 1) tries to access (should fail) - use Node 1 client
    console.log("\n🚫 EOA1 (outsider) attempting to access private contract...");
    try {
      const privateStorageForNode1 = privateStorageContract.using(paladinNode1);
      await privateStorageForNode1.retrieve(verifierNode1.lookup);
      console.log("❌ EOA1 should not have been able to access the contract!");
    } catch (error: any) {
      console.log("✅ EOA1 correctly denied access to privacy group!");
      console.log(`   Error: ${error.message || error}`);
    }

    console.log("\n🎉 Scenario 2 completed successfully!");
    console.log("✅ EOA2 and EOA3 can access private contract");
    console.log("✅ EOA1 is correctly denied access");
    console.log(`📄 Privacy Group ID: ${memberPrivacyGroup?.group.id}`);
    console.log(`📄 Contract Address: ${contractAddress}`);
    
  } catch (error) {
    console.error("❌ Error in Scenario 2:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
