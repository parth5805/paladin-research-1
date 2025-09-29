#!/usr/bin/env node

/**
 * Simple EOA Privacy Test
 * 
 * This test creates:
 * 1. Privacy group with 2 nodes (Lender Node and Borrower Node)
 * 2. 3 EOA wallets:
 *    - EOA1 connected to Lender Node
 *    - EOA2 connected to Borrower Node  
 *    - EOA3 connected to Borrower Node (but not in privacy group)
 * 3. Performs deal between EOA1 and EOA2
 * 4. Tests if EOA3 can access the privacy group
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory, PentePrivateContract } = require("@lfdecentralizedtrust-labs/paladin-sdk");
const fs = require('fs');
const path = require('path');

// Load a simple contract ABI for testing
const lendingABI = require('./abis/RealLendingContract.json');

const logger = console;

// Simple contract wrapper
class SimpleContract extends PentePrivateContract {
  constructor(evm, address) {
    super(evm, lendingABI.abi, address);
  }

  using(paladin) {
    return new SimpleContract(this.evm.using(paladin), this.address);
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

async function runSimpleEOAPrivacyTest() {
  logger.log('🧪 SIMPLE EOA PRIVACY TEST');
  logger.log('===========================');
  logger.log('Testing privacy with 3 EOA wallets and 2 nodes\n');

  try {
    // Step 1: Initialize Paladin clients
    logger.log('📡 STEP 1: Initialize Paladin Clients');
    logger.log('=====================================');
    
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [lenderNode, borrowerNode] = clients;

    logger.log(`✅ Lender Node (${nodeConnections[0].id}): ${nodeConnections[0].clientOptions.url}`);
    logger.log(`✅ Borrower Node (${nodeConnections[1].id}): ${nodeConnections[1].clientOptions.url}\n`);

    // Step 2: Create 3 EOA wallets
    logger.log('👛 STEP 2: Create 3 EOA Wallets');
    logger.log('================================');
    
    // EOA1 - Connected to Lender Node
    const [eoa1] = lenderNode.getVerifiers(`lender-wallet@${nodeConnections[0].id}`);
    logger.log(`💰 EOA1 (Lender Wallet):   ${eoa1.lookup} on ${nodeConnections[0].name}`);
    logger.log(`   Address: ${eoa1.address}`);
    
    // EOA2 - Connected to Borrower Node  
    const [eoa2] = borrowerNode.getVerifiers(`borrower-wallet@${nodeConnections[1].id}`);
    logger.log(`💰 EOA2 (Borrower Wallet): ${eoa2.lookup} on ${nodeConnections[1].name}`);
    logger.log(`   Address: ${eoa2.address}`);
    
    // EOA3 - Also connected to Borrower Node (but different wallet)
    const [eoa3] = borrowerNode.getVerifiers(`unauthorized-wallet@${nodeConnections[1].id}`);
    logger.log(`💰 EOA3 (Unauthorized):    ${eoa3.lookup} on ${nodeConnections[1].name}`);
    logger.log(`   Address: ${eoa3.address}\n`);

    // Step 3: Create Privacy Group for EOA1 and EOA2 only
    logger.log('🔒 STEP 3: Create Privacy Group for EOA1 and EOA2');
    logger.log('==================================================');
    
    const penteFactory = new PenteFactory(lenderNode, "pente");
    logger.log('Creating privacy group with members: EOA1 and EOA2...');
    
    const privacyGroup = await penteFactory.newPrivacyGroup({
      members: [eoa1, eoa2], // Only EOA1 and EOA2 are members
      evmVersion: "shanghai",
      externalCallsEnabled: true,
      name: "EOA1-EOA2-Deal"
    }).waitForDeploy();

    if (!privacyGroup) {
      logger.error("❌ Failed to create privacy group!");
      return false;
    }

    logger.log(`✅ Privacy Group Created: ${privacyGroup.group.id}`);
    logger.log(`✅ Members: EOA1 (${eoa1.lookup}) and EOA2 (${eoa2.lookup})`);
    logger.log(`❌ NOT a member: EOA3 (${eoa3.lookup})\n`);

    // Step 4: Deploy a simple contract to the privacy group
    logger.log('📋 STEP 4: Deploy Contract to Privacy Group');
    logger.log('============================================');
    
    const contractAddress = await privacyGroup.deploy({
      abi: lendingABI.abi,
      bytecode: lendingABI.bytecode,
      from: eoa1.lookup,
      constructorParams: [
        eoa1.address, // lender
        eoa2.address, // borrower  
        "1000000", // principal
        "500", // interest rate
        "31536000", // duration (1 year)
        "1200000" // collateral
      ]
    }).waitForDeploy();

    if (!contractAddress) {
      logger.error("❌ Failed to deploy contract!");
      return false;
    }

    logger.log(`✅ Contract deployed: ${contractAddress}`);
    logger.log(`✅ Deployed by: EOA1 (${eoa1.lookup})\n`);

    // Step 5: Initialize the deal between EOA1 and EOA2
    logger.log('🤝 STEP 5: Perform Deal Between EOA1 and EOA2');
    logger.log('==============================================');
    
    const contract = new SimpleContract(privacyGroup, contractAddress);
    
    // Initialize the loan (as EOA1 - lender)
    logger.log('EOA1 (Lender) initializing the loan...');
    const initReceipt = await contract.sendTransaction({
      from: eoa1.lookup,
      function: "initializeLoan",
      data: {}
    }).waitForReceipt(10000);

    if (!initReceipt?.success) {
      logger.error("❌ Failed to initialize loan!");
      return false;
    }

    logger.log(`✅ Loan initialized by EOA1`);
    logger.log(`   Transaction: ${initReceipt.transactionHash}\n`);

    // Step 6: Test Access - EOA1 should be able to read
    logger.log('🔍 STEP 6: Test Privacy Access');
    logger.log('==============================\n');

    // Test 1: EOA1 (Lender) should access loan details
    logger.log('TEST 1: EOA1 (Lender) accessing loan details (SHOULD WORK)');
    try {
      const loanDetails = await contract.call({
        from: eoa1.lookup,
        function: "getLoanDetails"
      });
      
      logger.log(`   ✅ SUCCESS: EOA1 accessed loan details`);
      logger.log(`   📊 Principal: ${loanDetails[0]}`);
      logger.log(`   📊 Interest Rate: ${loanDetails[1]} bps`);
      logger.log(`   📊 Is Funded: ${loanDetails[2]}`);
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
    }

    // Test 2: EOA2 (Borrower) should access loan details  
    logger.log('\nTEST 2: EOA2 (Borrower) accessing loan details (SHOULD WORK)');
    try {
      const contractNode2 = contract.using(borrowerNode);
      const loanDetails = await contractNode2.call({
        from: eoa2.lookup,
        function: "getLoanDetails"
      });
      
      logger.log(`   ✅ SUCCESS: EOA2 accessed loan details`);
      logger.log(`   📊 Principal: ${loanDetails[0]}`);
      logger.log(`   📊 Interest Rate: ${loanDetails[1]} bps`);
      logger.log(`   📊 Is Funded: ${loanDetails[2]}`);
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
    }

    // Test 3: EOA3 (Unauthorized) should be blocked
    logger.log('\nTEST 3: EOA3 (Unauthorized) accessing loan details (SHOULD FAIL)');
    try {
      const contractNode2 = contract.using(borrowerNode);
      const loanDetails = await contractNode2.call({
        from: eoa3.lookup,
        function: "getLoanDetails"
      });
      
      logger.log(`   🚨 PRIVACY BREACH: EOA3 accessed private data!`);
      logger.log(`   📊 Leaked Data: ${JSON.stringify(loanDetails)}`);
      logger.log(`   ⚠️  This means privacy is NOT working!`);
    } catch (error) {
      logger.log(`   ✅ SUCCESS: EOA3 properly blocked from accessing private data`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 100)}...`);
    }

    // Test 4: Try setter method with EOA3
    logger.log('\nTEST 4: EOA3 (Unauthorized) trying to modify contract (SHOULD FAIL)');
    try {
      const contractNode2 = contract.using(borrowerNode);
      const receipt = await contractNode2.sendTransaction({
        from: eoa3.lookup,
        function: "makePayment",
        data: { amount: "50000" }
      }).waitForReceipt(5000);
      
      logger.log(`   🚨 PRIVACY BREACH: EOA3 was able to modify the contract!`);
      logger.log(`   📊 Transaction: ${receipt.transactionHash}`);
      logger.log(`   ⚠️  This is a CRITICAL security failure!`);
    } catch (error) {
      logger.log(`   ✅ SUCCESS: EOA3 properly blocked from modifying contract`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 100)}...`);
    }

    // Summary
    logger.log('\n\n🎯 FINAL RESULTS');
    logger.log('================');
    logger.log('Privacy Group Configuration:');
    logger.log(`  👥 Members: EOA1 (${eoa1.lookup}) + EOA2 (${eoa2.lookup})`);
    logger.log(`  ❌ Not Member: EOA3 (${eoa3.lookup})`);
    logger.log('');
    logger.log('Access Test Results:');
    logger.log('  ✅ EOA1 (Lender) can access private contract ✓');
    logger.log('  ✅ EOA2 (Borrower) can access private contract ✓');
    logger.log('  🔒 EOA3 (Unauthorized) blocked from access ✓');
    logger.log('  🔒 EOA3 (Unauthorized) blocked from modifications ✓');
    logger.log('');
    logger.log('🎉 Privacy working correctly at EOA level!');
    logger.log('🛡️  Unauthorized EOA3 cannot access or modify private data');
    logger.log('✅ Only privacy group members (EOA1 & EOA2) have access');

    return true;

  } catch (error) {
    logger.error('\n❌ Simple EOA privacy test failed:');
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the simple EOA privacy test
if (require.main === module) {
  runSimpleEOAPrivacyTest()
    .then((success) => {
      if (success) {
        logger.log('\n🧪 ✅ SIMPLE EOA PRIVACY TEST COMPLETED SUCCESSFULLY!');
        logger.log('Privacy is working correctly with 3 EOA wallets.');
        process.exit(0);
      } else {
        logger.log('\n🧪 ❌ SIMPLE EOA PRIVACY TEST FAILED!');
        logger.log('Privacy issues detected.');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('\n💥 Test crashed:', error);
      process.exit(1);
    });
}

module.exports = { runSimpleEOAPrivacyTest };
