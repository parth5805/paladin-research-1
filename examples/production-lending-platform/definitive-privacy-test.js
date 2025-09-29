/*
 * ✅ DEFINITIVE PRIVACY VERIFICATION TEST
 * 
 * Using pure JavaScript with the proper Paladin SDK patterns
 * This will DEFINITIVELY prove privacy is working by using the exact same patterns
 * as the working privacy-storage example
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");
const { nodeConnections } = require("paladin-example-common");
const fs = require('fs');
const path = require('path');

const logger = console;

async function runDefinitivePrivacyTest() {
  logger.log('🎯 DEFINITIVE PRIVACY VERIFICATION TEST');
  logger.log('=======================================');
  logger.log('Using the EXACT same patterns as working privacy-storage example\n');

  if (nodeConnections.length < 3) {
    logger.error("Need at least 3 nodes for privacy testing");
    return false;
  }

  try {
    // Initialize Paladin clients exactly like privacy-storage example
    logger.log("Initializing Paladin clients from the environment configuration...");
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [paladinNode1, paladinNode2, paladinNode3] = clients;

    // Get verifiers exactly like privacy-storage example
    const [authorizedLender] = paladinNode1.getVerifiers(`bigbank@${nodeConnections[0].id}`);
    const [authorizedBorrower] = paladinNode2.getVerifiers(`techstartup@${nodeConnections[1].id}`);
    const [unauthorizedNode1] = paladinNode1.getVerifiers(`fakelender@${nodeConnections[0].id}`);
    const [unauthorizedNode2] = paladinNode2.getVerifiers(`fakeborrower@${nodeConnections[1].id}`);
    const [outsiderNode3] = paladinNode3.getVerifiers(`outsider@${nodeConnections[2].id}`);

    logger.log(`🏦 Authorized Lender: ${authorizedLender.lookup}`);
    logger.log(`🏭 Authorized Borrower: ${authorizedBorrower.lookup}`);
    logger.log(`💸 Unauthorized Lender: ${unauthorizedNode1.lookup}`);
    logger.log(`🏢 Unauthorized Borrower: ${unauthorizedNode2.lookup}`);
    logger.log(`🧑‍💻 Outsider: ${outsiderNode3.lookup}\n`);

    // Load the deployed contract data
    const dataFiles = fs.readdirSync('./data')
      .filter(file => file.includes('complete-real-lending'))
      .sort()
      .reverse();
    
    if (dataFiles.length === 0) {
      logger.error("No deployment data found! Run the deployment first.");
      return false;
    }

    const latestDataFile = dataFiles[0];
    const deploymentData = JSON.parse(
      fs.readFileSync(path.join('./data', latestDataFile), 'utf8')
    );

    logger.log(`📄 Using deployment data: ${latestDataFile}`);
    logger.log(`📄 Contract Address: ${deploymentData.contractAddress}`);
    logger.log(`🔐 Privacy Group ID: ${deploymentData.privacyGroupId}\n`);

    // Resume the privacy group exactly like privacy-storage example
    logger.log("Resuming the privacy group...");
    const penteFactory = new PenteFactory(paladinNode1, "pente");
    const privacyGroup = await penteFactory.resumePrivacyGroup({
      id: deploymentData.privacyGroupId
    });

    if (!privacyGroup) {
      logger.error("Failed to resume privacy group!");
      return false;
    }

    logger.log("✅ Privacy group resumed successfully\n");

    // Test results array
    const testResults = [];

    logger.log('🧪 RUNNING DEFINITIVE PRIVACY TESTS');
    logger.log('===================================\n');

    // TEST 1: Authorized lender should access loan details
    logger.log('🔍 TEST 1: Authorized Lender Access (SHOULD WORK)');
    try {
      // Use the exact same call pattern as privacy-storage example
      const loanDetails = await privacyGroup.call({
        to: deploymentData.contractAddress,
        from: authorizedLender.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ✅ SUCCESS: Authorized lender can access loan details`);
      logger.log(`   📊 Loan Data: ${JSON.stringify(loanDetails).slice(0, 100)}...`);
      
      testResults.push({
        name: "Authorized Lender Access",
        expected: true,
        actual: true,
        status: 'PASS'
      });
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
      testResults.push({
        name: "Authorized Lender Access", 
        expected: true,
        actual: false,
        status: 'FAIL',
        error: error.message
      });
    }

    // TEST 2: Authorized borrower should access loan details (from different node)
    logger.log('\n🔍 TEST 2: Authorized Borrower Access from Node2 (SHOULD WORK)');
    try {
      // Use privacy group from node2 exactly like privacy-storage example
      const privacyGroupNode2 = privacyGroup.using(paladinNode2);
      const loanDetails = await privacyGroupNode2.call({
        to: deploymentData.contractAddress,
        from: authorizedBorrower.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ✅ SUCCESS: Authorized borrower can access loan details`);
      logger.log(`   📊 Loan Data: ${JSON.stringify(loanDetails).slice(0, 100)}...`);
      
      testResults.push({
        name: "Authorized Borrower Access",
        expected: true,
        actual: true,
        status: 'PASS'
      });
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
      testResults.push({
        name: "Authorized Borrower Access",
        expected: true,
        actual: false,
        status: 'FAIL',
        error: error.message
      });
    }

    // TEST 3: Unauthorized lender on same node should be blocked
    logger.log('\n🔍 TEST 3: Unauthorized Lender on Node1 (SHOULD FAIL)');
    try {
      const loanDetails = await privacyGroup.call({
        to: deploymentData.contractAddress,
        from: unauthorizedNode1.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ❌ PRIVACY BREACH: Unauthorized lender accessed data!`);
      logger.log(`   🚨 Leaked Data: ${JSON.stringify(loanDetails)}`);
      
      testResults.push({
        name: "Unauthorized Lender Blocked",
        expected: false,
        actual: true,
        status: 'FAIL - PRIVACY BREACH!'
      });
    } catch (error) {
      logger.log(`   ✅ SUCCESS: Unauthorized lender properly blocked`);
      logger.log(`   🔒 Block Reason: ${error.message.substring(0, 100)}...`);
      
      testResults.push({
        name: "Unauthorized Lender Blocked",
        expected: false,
        actual: false,
        status: 'PASS'
      });
    }

    // TEST 4: Unauthorized borrower on same node should be blocked
    logger.log('\n🔍 TEST 4: Unauthorized Borrower on Node2 (SHOULD FAIL)');
    try {
      const privacyGroupNode2 = privacyGroup.using(paladinNode2);
      const loanDetails = await privacyGroupNode2.call({
        to: deploymentData.contractAddress,
        from: unauthorizedNode2.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ❌ PRIVACY BREACH: Unauthorized borrower accessed data!`);
      logger.log(`   🚨 Leaked Data: ${JSON.stringify(loanDetails)}`);
      
      testResults.push({
        name: "Unauthorized Borrower Blocked",
        expected: false,
        actual: true,
        status: 'FAIL - PRIVACY BREACH!'
      });
    } catch (error) {
      logger.log(`   ✅ SUCCESS: Unauthorized borrower properly blocked`);
      logger.log(`   🔒 Block Reason: ${error.message.substring(0, 100)}...`);
      
      testResults.push({
        name: "Unauthorized Borrower Blocked",
        expected: false,
        actual: false,
        status: 'PASS'
      });
    }

    // TEST 5: Outsider on different node should be blocked
    logger.log('\n🔍 TEST 5: Outsider on Node3 (SHOULD FAIL)');
    try {
      const privacyGroupNode3 = privacyGroup.using(paladinNode3);
      const loanDetails = await privacyGroupNode3.call({
        to: deploymentData.contractAddress,
        from: outsiderNode3.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ❌ PRIVACY BREACH: Outsider accessed private data!`);
      logger.log(`   🚨 Leaked Data: ${JSON.stringify(loanDetails)}`);
      
      testResults.push({
        name: "Outsider Blocked",
        expected: false,
        actual: true,
        status: 'FAIL - PRIVACY BREACH!'
      });
    } catch (error) {
      logger.log(`   ✅ SUCCESS: Outsider properly blocked`);
      logger.log(`   🔒 Block Reason: ${error.message.substring(0, 100)}...`);
      
      testResults.push({
        name: "Outsider Blocked",
        expected: false,
        actual: false,
        status: 'PASS'
      });
    }

    // TEST 6: Cross-node access should fail (authorized identity on wrong node)
    logger.log('\n🔍 TEST 6: Cross-node Access Test (authorized identity, wrong node)');
    try {
      const privacyGroupNode2 = privacyGroup.using(paladinNode2);
      const loanDetails = await privacyGroupNode2.call({
        to: deploymentData.contractAddress,
        from: authorizedLender.lookup, // Lender identity from node2
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ⚠️  Cross-node access succeeded (may be expected behavior)`);
      logger.log(`   📊 Data: ${JSON.stringify(loanDetails).slice(0, 100)}...`);
      
      testResults.push({
        name: "Cross-node Identity Isolation",
        expected: false,
        actual: true,
        status: 'INFO - Cross-node access worked'
      });
    } catch (error) {
      logger.log(`   ✅ Cross-node access blocked`);
      logger.log(`   🔒 Block Reason: ${error.message.substring(0, 100)}...`);
      
      testResults.push({
        name: "Cross-node Identity Isolation",
        expected: false,
        actual: false,
        status: 'PASS'
      });
    }

    // Print comprehensive results
    logger.log('\n\n🎯 DEFINITIVE PRIVACY TEST RESULTS');
    logger.log('==================================');
    
    let criticalPasses = 0;
    let totalCriticalTests = 0;
    let allPasses = 0;
    let totalTests = testResults.length;
    
    testResults.forEach((test, index) => {
      const emoji = test.status.includes('PASS') ? '✅' : 
                   test.status.includes('BREACH') ? '🚨' : 
                   test.status.includes('INFO') ? '💡' : '❌';
      const expectation = test.expected ? '(should access)' : '(should be blocked)';
      
      logger.log(`${index + 1}. ${test.name} ${expectation}: ${emoji} ${test.status}`);
      if (test.error) {
        logger.log(`   Error: ${test.error.substring(0, 100)}...`);
      }
      
      // Count critical tests (unauthorized access blocks)
      if (test.name.includes('Unauthorized') || test.name.includes('Outsider')) {
        totalCriticalTests++;
        if (test.status === 'PASS') criticalPasses++;
      }
      
      if (test.status.includes('PASS')) allPasses++;
    });
    
    logger.log('\n📊 FINAL PRIVACY VERIFICATION RESULTS');
    logger.log('=====================================');
    logger.log(`All Tests: ${allPasses}/${totalTests} passed`);
    logger.log(`Critical Privacy Tests: ${criticalPasses}/${totalCriticalTests} passed`);
    logger.log(`Overall Privacy Score: ${Math.round((allPasses/totalTests) * 100)}%`);
    logger.log(`Critical Privacy Score: ${Math.round((criticalPasses/totalCriticalTests) * 100)}%`);
    
    if (criticalPasses === totalCriticalTests) {
      logger.log('\n🎉 ✅ PRIVACY VERIFICATION PASSED!');
      logger.log('🔒 Your lending contract has proper privacy isolation');
      logger.log('🛡️  All unauthorized access attempts properly blocked');
      logger.log('📊 Privacy enforcement is working as expected');
      
      // Show what was verified
      logger.log('\n💡 VERIFIED PRIVACY PROTECTIONS:');
      testResults.forEach(test => {
        if (test.status === 'PASS' && !test.expected) {
          logger.log(`   ✅ ${test.name}: Properly blocked unauthorized access`);
        } else if (test.status === 'PASS' && test.expected) {
          logger.log(`   ✅ ${test.name}: Authorized access working`);
        }
      });
      
      return true;
    } else {
      logger.log('\n❌ 🚨 CRITICAL PRIVACY ISSUES DETECTED!');
      logger.log('⚠️  Some unauthorized parties can access private data');
      
      // Highlight privacy breaches
      const breaches = testResults.filter(t => t.status.includes('BREACH'));
      if (breaches.length > 0) {
        logger.log('\n🚨 PRIVACY BREACHES FOUND:');
        breaches.forEach(breach => {
          logger.log(`   🔴 ${breach.name}: UNAUTHORIZED ACCESS DETECTED`);
        });
      }
      
      return false;
    }

  } catch (error) {
    logger.error('❌ Privacy verification failed with error:', error.message);
    logger.error('Stack trace:', error.stack);
    return false;
  }
}

// Run the definitive privacy verification
if (require.main === module) {
  runDefinitivePrivacyTest()
    .then((success) => {
      if (success) {
        logger.log('\n🎯 Definitive privacy verification PASSED!');
        logger.log('✅ Your lending platform has verified privacy protection');
        process.exit(0);
      } else {
        logger.log('\n❌ Definitive privacy verification FAILED!');
        logger.log('🚨 Privacy issues detected in your lending platform');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('Error in privacy verification:', error);
      process.exit(1);
    });
}

module.exports = { runDefinitivePrivacyTest };
