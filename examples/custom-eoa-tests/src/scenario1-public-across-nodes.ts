/**
 * Scenario 1: Public Smart Contract Testing Across All Besu Nodes
 * 
 * This script demonstrates:
 * - EOA1 connects to Besu Node 1, deploys a public contract, writes a value
 * - EOA2 connects to Besu Node 2, reads the same value
 * - EOA3 connects to Besu Node 3, updates the value
 * - All EOAs can read/write from any node (public blockchain behavior)
 */

import { ethers } from "ethers";
import storageAbi from "./abis/Storage.json";

// Network configuration
const BESU_NODES = {
  node1: "http://localhost:31545",
  node2: "http://localhost:31645", 
  node3: "http://localhost:31745"
};

const CHAIN_ID = 1337;

// Create EOA wallets (you can replace these with your own private keys)
const PRIVATE_KEYS = {
  eoa1: "0x8f2a55949038a9610f50fb23b5883af3b4ecb3c3bb792cbcefbd1542c692be63",
  eoa2: "0xc87509a1c067bbde78beb793e6fa76530b6382a4c0241e5e4a9ec0a0f44dc0d3", 
  eoa3: "0xae6ae8e5ccbfb04590405997ee2d52d2b330726137b875053c36d94e974d162f"
};

// We'll get the bytecode from the ABI file

interface DeployedContract {
  address: string;
  deployer: string;
  node: string;
}

async function deployContract(provider: ethers.JsonRpcProvider, wallet: ethers.Wallet, nodeName: string): Promise<DeployedContract> {
  console.log(`\n🚀 ${wallet.address} deploying contract on ${nodeName}...`);
  
  const factory = new ethers.ContractFactory(storageAbi.abi, storageAbi.bytecode, wallet);
  const contract = await factory.deploy();
  await contract.waitForDeployment();
  
  const address = await contract.getAddress();
  console.log(`✅ Contract deployed at: ${address}`);
  
  return {
    address,
    deployer: wallet.address,
    node: nodeName
  };
}

async function writeValue(provider: ethers.JsonRpcProvider, wallet: ethers.Wallet, contractAddress: string, value: number, nodeName: string) {
  console.log(`\n📝 ${wallet.address} writing value ${value} to contract on ${nodeName}...`);
  
  const contract = new ethers.Contract(contractAddress, storageAbi.abi, wallet);
  const tx = await contract.store(value);
  await tx.wait();
  
  console.log(`✅ Value ${value} written successfully! Tx: ${tx.hash}`);
}

async function readValue(provider: ethers.JsonRpcProvider, wallet: ethers.Wallet, contractAddress: string, nodeName: string): Promise<number> {
  console.log(`\n👀 ${wallet.address} reading value from contract on ${nodeName}...`);
  
  const contract = new ethers.Contract(contractAddress, storageAbi.abi, wallet);
  const value = await contract.retrieve();
  
  console.log(`✅ Read value: ${value}`);
  return Number(value);
}

async function main() {
  console.log("🌟 Scenario 1: Public Smart Contract Testing Across All Besu Nodes");
  console.log("=" .repeat(70));
  
  // Create providers for each Besu node
  const providers = {
    node1: new ethers.JsonRpcProvider(BESU_NODES.node1),
    node2: new ethers.JsonRpcProvider(BESU_NODES.node2),
    node3: new ethers.JsonRpcProvider(BESU_NODES.node3)
  };
  
  // Create wallets connected to each node
  const wallets = {
    eoa1: new ethers.Wallet(PRIVATE_KEYS.eoa1, providers.node1),
    eoa2: new ethers.Wallet(PRIVATE_KEYS.eoa2, providers.node2),
    eoa3: new ethers.Wallet(PRIVATE_KEYS.eoa3, providers.node3)
  };
  
  console.log("\n📋 EOA Addresses:");
  console.log(`EOA1 (Node 1): ${wallets.eoa1.address}`);
  console.log(`  Private Key: ${PRIVATE_KEYS.eoa1}`);
  console.log(`EOA2 (Node 2): ${wallets.eoa2.address}`);
  console.log(`  Private Key: ${PRIVATE_KEYS.eoa2}`);
  console.log(`EOA3 (Node 3): ${wallets.eoa3.address}`);
  console.log(`  Private Key: ${PRIVATE_KEYS.eoa3}`);
  
  try {
    // Step 1: EOA1 deploys contract on Node 1 and writes initial value
    const deployedContract = await deployContract(providers.node1, wallets.eoa1, "Node 1");
    await writeValue(providers.node1, wallets.eoa1, deployedContract.address, 42, "Node 1");
    
    // Step 2: EOA2 reads the value from Node 2 (should see the same value)
    await readValue(providers.node2, wallets.eoa2, deployedContract.address, "Node 2");
    
    // Step 3: EOA3 reads the value from Node 3 (should see the same value)
    await readValue(providers.node3, wallets.eoa3, deployedContract.address, "Node 3");
    
    // Step 4: EOA2 updates the value from Node 2
    await writeValue(providers.node2, wallets.eoa2, deployedContract.address, 84, "Node 2");
    
    // Step 5: EOA1 reads the updated value from Node 1
    await readValue(providers.node1, wallets.eoa1, deployedContract.address, "Node 1");
    
    // Step 6: EOA3 updates the value from Node 3  
    await writeValue(providers.node3, wallets.eoa3, deployedContract.address, 168, "Node 3");
    
    // Step 7: All EOAs read the final value from their respective nodes
    console.log("\n🔍 Final verification - all EOAs reading from their nodes:");
    await readValue(providers.node1, wallets.eoa1, deployedContract.address, "Node 1");
    await readValue(providers.node2, wallets.eoa2, deployedContract.address, "Node 2");
    await readValue(providers.node3, wallets.eoa3, deployedContract.address, "Node 3");
    
    console.log("\n🎉 Scenario 1 completed successfully!");
    console.log("✅ All EOAs can read/write to the public contract from any Besu node");
    console.log(`📄 Contract Address: ${deployedContract.address}`);
    
  } catch (error) {
    console.error("❌ Error in Scenario 1:", error);
  }
}

if (require.main === module) {
  main().catch(console.error);
}
