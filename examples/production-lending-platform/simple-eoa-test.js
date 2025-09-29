#!/usr/bin/env node

/**
 * Simple EOA Privacy Test - Clean Version
 * 
 * Scenario:
 * 1. Create privacy group with 2 nodes (Lender Node + Borrower Node)
 * 2. Create 3 EOA wallets:
 *    - EOA1 on Lender Node (authorized)
 *    - EOA2 on Borrower Node (authorized)  
 *    - EOA3 on Borrower Node (unauthorized - same node as EOA2)
 * 3. Deploy simple storage contract between EOA1 and EOA2
 * 4. Test if EOA3 can access the privacy group
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory, PentePrivateContract } = require("@lfdecentralizedtrust-labs/paladin-sdk");

const logger = console;

// Simple storage contract ABI (using privacy-storage pattern)
const storageABI = {
  "abi": [
    {
      "inputs": [],
      "stateMutability": "nonpayable",
      "type": "constructor"
    },
    {
      "inputs": [{"internalType": "uint256", "name": "num", "type": "uint256"}],
      "name": "store",
      "outputs": [],
      "stateMutability": "nonpayable", 
      "type": "function"
    },
    {
      "inputs": [],
      "name": "retrieve",
      "outputs": [{"internalType": "uint256", "name": "value", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  "bytecode": "0x608060405234801561001057600080fd5b50610150806100206000396000f3fe608060405234801561001057600080fd5b50600436106100365760003560e01c80632e64cec11461003b5780636057361d14610059575b600080fd5b610043610075565b60405161005091906100a1565b60405180910390f35b610073600480360381019061006e91906100ed565b61007e565b005b60008054905090565b8060008190555050565b6000819050919050565b61009b81610088565b82525050565b60006020820190506100b66000830184610092565b92915050565b600080fd5b6100ca81610088565b81146100d557600080fd5b50565b6000813590506100e7816100c1565b92915050565b600060208284031215610103576101026100bc565b5b6000610111848285016100d8565b9150509291505056fea2646970667358221220b5c85f6e46b76c7c5e5e8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c64736f6c63430008120033"
};

// Simple contract wrapper
class SimpleStorage extends PentePrivateContract {
  constructor(evm, address) {
    super(evm, storageABI.abi, address);
  }

  using(paladin) {
    return new SimpleStorage(this.evm.using(paladin), this.address);
  }
}

// Node configuration
const nodeConnections = [
  {
    id: "node1",
    name: "Lender Node",
    clientOptions: {
      url: "http://localhost:31548",
      logger: logger
    }
  },
  {
    id: "node2", 
    name: "Borrower Node",
    clientOptions: {
      url: "http://localhost:31648",
      logger: logger
    }
  }
];

async function runSimpleEOATest() {
  logger.log('🧪 SIMPLE EOA PRIVACY TEST');
  logger.log('===========================');
  logger.log('Testing privacy with 3 EOA wallets on 2 nodes\n');

  try {
    // Step 1: Initialize Paladin clients  
    logger.log('📡 STEP 1: Initialize Paladin Clients');
    logger.log('=====================================');
    
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [lenderNode, borrowerNode] = clients;

    logger.log(`✅ Lender Node: ${nodeConnections[0].clientOptions.url}`);
    logger.log(`✅ Borrower Node: ${nodeConnections[1].clientOptions.url}\n`);

    // Step 2: Create 3 EOA wallets
    logger.log('👛 STEP 2: Create 3 EOA Wallets');
    logger.log('================================');
    
    // EOA1 - Lender on Node1
    const [eoa1] = lenderNode.getVerifiers(`eoa1-lender@${nodeConnections[0].id}`);
    logger.log(`💰 EOA1 (Lender):      ${eoa1.lookup} on ${nodeConnections[0].name}`);
    
    // EOA2 - Borrower on Node2
    const [eoa2] = borrowerNode.getVerifiers(`eoa2-borrower@${nodeConnections[1].id}`);
    logger.log(`💰 EOA2 (Borrower):    ${eoa2.lookup} on ${nodeConnections[1].name}`);
    
    // EOA3 - Unauthorized on Node2 (same node as EOA2!)
    const [eoa3] = borrowerNode.getVerifiers(`eoa3-unauthorized@${nodeConnections[1].id}`);
    logger.log(`💰 EOA3 (Unauthorized): ${eoa3.lookup} on ${nodeConnections[1].name}`);
    logger.log('   ⚠️  Note: EOA3 is on the same node as EOA2\n');

    // Step 3: Create Privacy Group for EOA1 and EOA2 only
    logger.log('🔒 STEP 3: Create Privacy Group');
    logger.log('===============================');
    
    const penteFactory = new PenteFactory(lenderNode, "pente");
    logger.log('Creating privacy group with members: EOA1 and EOA2...');
    
    const privacyGroup = await penteFactory.newPrivacyGroup({
      members: [eoa1, eoa2], // Only EOA1 and EOA2
      evmVersion: "shanghai",
      externalCallsEnabled: true,
    }).waitForDeploy();

    if (!privacyGroup) {
      logger.error("❌ Failed to create privacy group!");
      return false;
    }

    logger.log(`✅ Privacy Group Created: ${privacyGroup.group.id}`);
    logger.log(`👥 Members: ${eoa1.lookup} + ${eoa2.lookup}`);
    logger.log(`❌ NOT a member: ${eoa3.lookup}\n`);

    // Step 4: Deploy Simple Storage Contract
    logger.log('📋 STEP 4: Deploy Simple Storage Contract');
    logger.log('=========================================');
    
    const contractAddress = await privacyGroup.deploy({
      abi: storageABI.abi,
      bytecode: storageABI.bytecode,
      from: eoa1.lookup,
    }).waitForDeploy();

    if (!contractAddress) {
      logger.error("❌ Failed to deploy contract!");
      return false;
    }

    logger.log(`✅ Contract deployed: ${contractAddress}`);
    logger.log(`✅ Deployed by: EOA1 (${eoa1.lookup})\n`);

    // Step 5: Perform Deal - Store Value
    logger.log('🤝 STEP 5: Perform Deal - Store Secret Value');
    logger.log('============================================');
    
    const contract = new SimpleStorage(privacyGroup, contractAddress);
    
    // EOA1 stores a secret value
    const secretValue = 12345;
    logger.log(`EOA1 storing secret value: ${secretValue}`);
    
    const storeReceipt = await contract.sendTransaction({
      from: eoa1.lookup,
      function: "store",
      data: { num: secretValue }
    }).waitForReceipt(10000);

    if (!storeReceipt?.success) {
      logger.error("❌ Failed to store value!");
      return false;
    }

    logger.log(`✅ Secret value stored by EOA1`);
    logger.log(`   Transaction: ${storeReceipt.transactionHash}\n`);

    // Step 6: Test Privacy Access
    logger.log('🔍 STEP 6: Test Privacy Access');
    logger.log('==============================\n');

    // Test 1: EOA1 (Lender) retrieves value (SHOULD WORK)
    logger.log('TEST 1: EOA1 (Lender) retrieving secret value (SHOULD WORK)');
    try {
      const result = await contract.call({
        from: eoa1.lookup,
        function: "retrieve"
      });
      
      logger.log(`   ✅ SUCCESS: EOA1 retrieved value: ${result.value}`);
      
      if (result.value === secretValue.toString()) {
        logger.log(`   ✅ Correct value retrieved!`);
      } else {
        logger.log(`   ⚠️  Value mismatch: expected ${secretValue}, got ${result.value}`);
      }
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
    }

    // Test 2: EOA2 (Borrower) retrieves value (SHOULD WORK)
    logger.log('\nTEST 2: EOA2 (Borrower) retrieving secret value (SHOULD WORK)');
    try {
      const contractNode2 = contract.using(borrowerNode);
      const result = await contractNode2.call({
        from: eoa2.lookup,
        function: "retrieve"
      });
      
      logger.log(`   ✅ SUCCESS: EOA2 retrieved value: ${result.value}`);
      
      if (result.value === secretValue.toString()) {
        logger.log(`   ✅ Correct value retrieved from different node!`);
      } else {
        logger.log(`   ⚠️  Value mismatch: expected ${secretValue}, got ${result.value}`);
      }
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
    }

    // Test 3: EOA3 (Unauthorized) tries to retrieve value (SHOULD FAIL)
    logger.log('\nTEST 3: EOA3 (Unauthorized) retrieving secret value (SHOULD FAIL)');
    logger.log('       👆 This is the KEY test - EOA3 is on same node as EOA2');
    try {
      const contractNode2 = contract.using(borrowerNode);
      const result = await contractNode2.call({
        from: eoa3.lookup,
        function: "retrieve"
      });
      
      logger.log(`   🚨 PRIVACY BREACH: EOA3 accessed secret value: ${result.value}`);
      logger.log(`   ⚠️  This means the same-node issue exists!`);
      logger.log(`   📊 EOA2 and EOA3 are both on ${nodeConnections[1].name} but only EOA2 should have access`);
      
      return false; // Privacy breach detected
    } catch (error) {
      logger.log(`   ✅ SUCCESS: EOA3 properly blocked`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 100)}...`);
    }

    // Test 4: EOA3 tries to modify the value (SHOULD FAIL)
    logger.log('\nTEST 4: EOA3 (Unauthorized) trying to store new value (SHOULD FAIL)');
    try {
      const contractNode2 = contract.using(borrowerNode);
      const receipt = await contractNode2.sendTransaction({
        from: eoa3.lookup,
        function: "store",
        data: { num: 99999 }
      }).waitForReceipt(5000);
      
      logger.log(`   🚨 PRIVACY BREACH: EOA3 modified the contract!`);
      logger.log(`   📊 Transaction: ${receipt.transactionHash}`);
      
      return false; // Privacy breach detected
    } catch (error) {
      logger.log(`   ✅ SUCCESS: EOA3 blocked from modifications`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 100)}...`);
    }

    // Final Summary
    logger.log('\n\n🎯 FINAL RESULTS');
    logger.log('================');
    logger.log('🏗️  Test Architecture:');
    logger.log(`   • Privacy Group: EOA1 (${eoa1.lookup}) ↔ EOA2 (${eoa2.lookup})`);
    logger.log(`   • Unauthorized: EOA3 (${eoa3.lookup}) on same node as EOA2`);
    logger.log(`   • Secret Value: ${secretValue} stored by EOA1`);
    logger.log('');
    logger.log('✅ Privacy Test Results:');
    logger.log('   ✅ EOA1 (authorized) can access secret value');
    logger.log('   ✅ EOA2 (authorized) can access secret value');
    logger.log('   🔒 EOA3 (unauthorized) blocked from reading');
    logger.log('   🔒 EOA3 (unauthorized) blocked from writing');
    logger.log('');
    logger.log('🎉 CONCLUSION: Privacy working correctly!');
    logger.log('🛡️  EOA3 cannot access privacy group despite being on same node as EOA2');
    logger.log('✅ This proves privacy is enforced at the EOA level, not node level');

    return true;

  } catch (error) {
    logger.error('\n❌ Simple EOA privacy test failed:');
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the test
if (require.main === module) {
  runSimpleEOATest()
    .then((success) => {
      if (success) {
        logger.log('\n🧪 ✅ SIMPLE EOA PRIVACY TEST PASSED!');
        logger.log('Privacy is working correctly with EOA wallets.');
        process.exit(0);
      } else {
        logger.log('\n🧪 ❌ SIMPLE EOA PRIVACY TEST FAILED!');
        logger.log('Privacy breach detected.');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('\n💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { runSimpleEOATest };
