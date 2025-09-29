/*
 * ✅ STANDALONE PRIVACY VERIFICATION TEST
 * 
 * This test is completely standalone and proves privacy is working
 * using the same patterns as the working examples but without external dependencies
 */

const PaladinClient = require("@lfdecentralizedtrust-labs/paladin-sdk").default;
const { PenteFactory } = require("@lfdecentralizedtrust-labs/paladin-sdk");
const fs = require('fs');
const path = require('path');

const logger = console;

// Node configuration (from standard Paladin setup)
const nodeConnections = [
  {
    id: "node1",
    clientOptions: {
      url: "http://localhost:31548",
      logger: logger
    }
  },
  {
    id: "node2", 
    clientOptions: {
      url: "http://localhost:31648",
      logger: logger
    }
  },
  {
    id: "node3",
    clientOptions: {
      url: "http://localhost:31748", 
      logger: logger
    }
  }
];

async function runStandalonePrivacyTest() {
  logger.log('🎯 STANDALONE PRIVACY VERIFICATION TEST');
  logger.log('======================================');
  logger.log('Proving privacy works with zero external dependencies\n');

  try {
    // Initialize Paladin clients
    logger.log("Initializing Paladin clients...");
    const clients = nodeConnections.map(node => new PaladinClient(node.clientOptions));
    const [paladinNode1, paladinNode2, paladinNode3] = clients;

    // Get verifiers - these should be the identities used in deployment
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
      logger.error("❌ No deployment data found! Run the deployment first:");
      logger.error("   npm run demo");
      return false;
    }

    const latestDataFile = dataFiles[0];
    const deploymentData = JSON.parse(
      fs.readFileSync(path.join('./data', latestDataFile), 'utf8')
    );

    logger.log(`📄 Using deployment: ${latestDataFile}`);
    logger.log(`📄 Contract: ${deploymentData.contractAddress}`);
    logger.log(`🔐 Privacy Group: ${deploymentData.privacyGroupId}`);
    logger.log(`💰 Loan Amount: $${deploymentData.loanDetails?.principal || 'unknown'}`);
    logger.log(`📈 Interest Rate: ${deploymentData.loanDetails?.interestRate || 'unknown'}%\n`);

    // Resume the privacy group 
    logger.log("Connecting to the privacy group...");
    const penteFactory = new PenteFactory(paladinNode1, "pente");
    const privacyGroup = await penteFactory.resumePrivacyGroup({
      id: deploymentData.privacyGroupId
    });

    if (!privacyGroup) {
      logger.error("❌ Failed to resume privacy group!");
      return false;
    }

    logger.log("✅ Connected to privacy group successfully\n");

    // Test results tracking
    const testResults = [];

    logger.log('🧪 RUNNING PRIVACY VERIFICATION TESTS');
    logger.log('====================================\n');

    // TEST 1: Authorized lender should access loan details
    logger.log('🔍 TEST 1: Authorized Lender Access (SHOULD WORK)');
    try {
      const loanDetails = await privacyGroup.call({
        to: deploymentData.contractAddress,
        from: authorizedLender.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ✅ SUCCESS: Authorized lender accessed loan details`);
      logger.log(`   📊 Principal: ${loanDetails.principal || 'N/A'}`);
      logger.log(`   📊 Interest Rate: ${loanDetails.interestRate || 'N/A'}`);
      logger.log(`   📊 Lender: ${loanDetails.lender || 'N/A'}`);
      logger.log(`   📊 Borrower: ${loanDetails.borrower || 'N/A'}`);
      
      testResults.push({
        name: "Authorized Lender Access",
        expected: true,
        actual: true,
        status: 'PASS',
        details: 'Lender successfully accessed private loan data'
      });
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
      testResults.push({
        name: "Authorized Lender Access", 
        expected: true,
        actual: false,
        status: 'FAIL',
        details: `Authorized access failed: ${error.message}`
      });
    }

    // TEST 2: Authorized borrower should access loan details
    logger.log('\n🔍 TEST 2: Authorized Borrower Access (SHOULD WORK)');
    try {
      const privacyGroupNode2 = privacyGroup.using(paladinNode2);
      const loanDetails = await privacyGroupNode2.call({
        to: deploymentData.contractAddress,
        from: authorizedBorrower.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   ✅ SUCCESS: Authorized borrower accessed loan details`);
      logger.log(`   📊 Data access confirmed from different node`);
      
      testResults.push({
        name: "Authorized Borrower Access",
        expected: true,
        actual: true,
        status: 'PASS',
        details: 'Borrower successfully accessed private loan data from node2'
      });
    } catch (error) {
      logger.log(`   ❌ FAILED: ${error.message}`);
      testResults.push({
        name: "Authorized Borrower Access",
        expected: true,
        actual: false,
        status: 'FAIL',
        details: `Authorized borrower access failed: ${error.message}`
      });
    }

    // TEST 3: Unauthorized lender on same node should be blocked
    logger.log('\n🔍 TEST 3: Unauthorized Lender on Same Node (SHOULD FAIL)');
    try {
      const loanDetails = await privacyGroup.call({
        to: deploymentData.contractAddress,
        from: unauthorizedNode1.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   🚨 PRIVACY BREACH: Unauthorized lender accessed data!`);
      logger.log(`   ⚠️  This is a CRITICAL privacy failure!`);
      logger.log(`   📊 Leaked Data: ${JSON.stringify(loanDetails)}`);
      
      testResults.push({
        name: "Block Unauthorized Lender",
        expected: false,
        actual: true,
        status: 'CRITICAL FAILURE - PRIVACY BREACH',
        details: 'Unauthorized lender gained access to private loan data'
      });
    } catch (error) {
      logger.log(`   ✅ SUCCESS: Unauthorized lender properly blocked`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 80)}...`);
      
      testResults.push({
        name: "Block Unauthorized Lender",
        expected: false,
        actual: false,
        status: 'PASS',
        details: 'Unauthorized lender properly denied access'
      });
    }

    // TEST 4: Unauthorized borrower on same node should be blocked  
    logger.log('\n🔍 TEST 4: Unauthorized Borrower on Same Node (SHOULD FAIL)');
    try {
      const privacyGroupNode2 = privacyGroup.using(paladinNode2);
      const loanDetails = await privacyGroupNode2.call({
        to: deploymentData.contractAddress,
        from: unauthorizedNode2.lookup,
        function: "getLoanDetails", 
        data: {}
      });
      
      logger.log(`   🚨 PRIVACY BREACH: Unauthorized borrower accessed data!`);
      logger.log(`   ⚠️  This is a CRITICAL privacy failure!`);
      logger.log(`   📊 Leaked Data: ${JSON.stringify(loanDetails)}`);
      
      testResults.push({
        name: "Block Unauthorized Borrower",
        expected: false,
        actual: true,
        status: 'CRITICAL FAILURE - PRIVACY BREACH',
        details: 'Unauthorized borrower gained access to private loan data'
      });
    } catch (error) {
      logger.log(`   ✅ SUCCESS: Unauthorized borrower properly blocked`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 80)}...`);
      
      testResults.push({
        name: "Block Unauthorized Borrower",
        expected: false,
        actual: false,
        status: 'PASS',
        details: 'Unauthorized borrower properly denied access'
      });
    }

    // TEST 5: Outsider on different node should be blocked
    logger.log('\n🔍 TEST 5: Outsider on Different Node (SHOULD FAIL)');
    try {
      const privacyGroupNode3 = privacyGroup.using(paladinNode3);
      const loanDetails = await privacyGroupNode3.call({
        to: deploymentData.contractAddress,
        from: outsiderNode3.lookup,
        function: "getLoanDetails",
        data: {}
      });
      
      logger.log(`   🚨 PRIVACY BREACH: Outsider accessed private data!`);
      logger.log(`   ⚠️  This is a CRITICAL privacy failure!`);
      logger.log(`   📊 Leaked Data: ${JSON.stringify(loanDetails)}`);
      
      testResults.push({
        name: "Block Outsider Access",
        expected: false,
        actual: true,
        status: 'CRITICAL FAILURE - PRIVACY BREACH',
        details: 'Outsider gained access to private loan data'
      });
    } catch (error) {
      logger.log(`   ✅ SUCCESS: Outsider properly blocked`);
      logger.log(`   🔒 Reason: ${error.message.substring(0, 80)}...`);
      
      testResults.push({
        name: "Block Outsider Access",
        expected: false,
        actual: false,
        status: 'PASS',
        details: 'Outsider properly denied access'
      });
    }

    // Calculate and display results
    logger.log('\n\n🎯 FINAL PRIVACY VERIFICATION RESULTS');
    logger.log('====================================');
    
    let totalTests = testResults.length;
    let passedTests = 0;
    let criticalFailures = 0;
    let authorizedSuccesses = 0;
    
    testResults.forEach((test, index) => {
      const emoji = test.status === 'PASS' ? '✅' : 
                   test.status.includes('CRITICAL') ? '🚨' : '❌';
      const expectation = test.expected ? '(should access)' : '(should be blocked)';
      
      logger.log(`${index + 1}. ${test.name} ${expectation}: ${emoji} ${test.status}`);
      logger.log(`   → ${test.details}`);
      
      if (test.status === 'PASS') {
        passedTests++;
        if (test.expected) authorizedSuccesses++;
      }
      
      if (test.status.includes('CRITICAL')) {
        criticalFailures++;
      }
    });
    
    logger.log('\n📊 SUMMARY STATISTICS');
    logger.log('====================');
    logger.log(`Total Tests: ${totalTests}`);
    logger.log(`Passed Tests: ${passedTests}`);
    logger.log(`Authorized Access Working: ${authorizedSuccesses}/2`);
    logger.log(`Critical Privacy Failures: ${criticalFailures}`);
    logger.log(`Privacy Score: ${Math.round((passedTests/totalTests) * 100)}%`);
    
    // Final verdict
    if (criticalFailures === 0 && authorizedSuccesses === 2 && passedTests >= 4) {
      logger.log('\n🎉 ✅ PRIVACY VERIFICATION PASSED!');
      logger.log('🔒 Your lending contract has VERIFIED privacy protection');
      logger.log('🛡️  All unauthorized access attempts properly blocked');
      logger.log('✅ All authorized access working correctly');
      
      logger.log('\n🏆 PRIVACY VERIFICATION SUMMARY:');
      logger.log('================================');
      logger.log('✅ Authorized lender can access loan details');
      logger.log('✅ Authorized borrower can access loan details');  
      logger.log('✅ Unauthorized lenders are blocked');
      logger.log('✅ Unauthorized borrowers are blocked');
      logger.log('✅ Outsiders are blocked');
      
      logger.log('\n💡 WHAT THIS PROVES:');
      logger.log('Your Paladin lending platform successfully enforces:');
      logger.log('• Identity-based access control');
      logger.log('• Privacy group isolation');
      logger.log('• Cross-node privacy enforcement');
      logger.log('• Protection of sensitive financial data');
      
      return true;
    } else {
      logger.log('\n❌ 🚨 PRIVACY VERIFICATION FAILED!');
      
      if (criticalFailures > 0) {
        logger.log(`🔴 ${criticalFailures} CRITICAL privacy breach(es) detected!`);
        logger.log('⚠️  Unauthorized parties can access private loan data');
      }
      
      if (authorizedSuccesses < 2) {
        logger.log(`🔴 Authorized access issues: Only ${authorizedSuccesses}/2 working`);
        logger.log('⚠️  Legitimate users cannot access their own data');
      }
      
      logger.log('\n🔧 RECOMMENDED ACTIONS:');
      logger.log('• Review privacy group configuration');
      logger.log('• Check identity resolution setup'); 
      logger.log('• Verify contract deployment privacy settings');
      logger.log('• Consult Paladin privacy documentation');
      
      return false;
    }

  } catch (error) {
    logger.error('\n❌ Privacy verification failed with error:');
    logger.error(`Error: ${error.message}`);
    logger.error(`Stack: ${error.stack}`);
    return false;
  }
}

// Run the standalone privacy verification
if (require.main === module) {
  runStandalonePrivacyTest()
    .then((success) => {
      if (success) {
        logger.log('\n🎯 ✅ PRIVACY VERIFICATION COMPLETED SUCCESSFULLY!');
        logger.log('Your lending platform has verified privacy protection.');
        process.exit(0);
      } else {
        logger.log('\n🎯 ❌ PRIVACY VERIFICATION FAILED!');
        logger.log('Privacy issues detected in your lending platform.');
        process.exit(1);
      }
    })
    .catch((error) => {
      logger.error('\n💥 Privacy verification crashed:', error);
      process.exit(1);
    });
}

module.exports = { runStandalonePrivacyTest };
