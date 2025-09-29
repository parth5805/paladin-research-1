/*
 * 🎯 ADDRESS-LEVEL PRIVACY VERIFICATION TEST
 * 
 * Tests that ONLY the specific authorized addresses can access the lending deal
 * Even if other lenders/borrowers are on the same nodes, they should be BLOCKED
 * 
 * PRIVACY RULE: Only 0xc1e5fdd1d13ce121d3255e7dff14dfe2d0f42dae (lender)
 *               and 0xe37c48e0e63c0fa0f364b5dc101b8ebecc728ac7 (borrower)
 *               can access the private deal data
 */

const http = require('http');

// Your actual deployed contract details
const DEAL_DATA = {
  contractAddress: "0x0d095e0c1312079727ed3ac2276ee9e7aa184d9c",
  privacyGroupId: "0x1ca8f7a62bea0da62f7105d025ebe340f5cfeac5d8ff5502e51f92d4efc21c6a",
  
  // AUTHORIZED IDENTITIES (should work)
  authorizedLender: "bigbank@node1",         // Real lender identity
  authorizedBorrower: "techstartup@node2",   // Real borrower identity
  
  // UNAUTHORIZED IDENTITIES (should fail - even on same nodes!)
  unauthorizedLenderNode1: "fakelender@node1",     // fake lender on node1
  unauthorizedBorrowerNode2: "fakeborrower@node2", // fake borrower on node2
  outsiderNode3: "outsider@node3",                 // outsider on node3
  
  // Test data (for display only)
  loanAmount: "1000000",
  interestRate: "500"
};

const ENDPOINTS = {
  node1: "http://127.0.0.1:31548",
  node2: "http://127.0.0.1:31648", 
  node3: "http://127.0.0.1:31748"
};

async function makeRPCCall(endpoint, method, params) {
  const url = new URL(endpoint);
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    });

    const options = {
      hostname: url.hostname,
      port: url.port,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${body}`));
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

// Test contract call with specific identity
async function testContractCall(endpoint, fromIdentity, description) {
  try {
    console.log(`\n🔍 ${description}`);
    console.log(`   From Identity: ${fromIdentity}`);
    console.log(`   Endpoint: ${endpoint}`);
    
    const response = await makeRPCCall(endpoint, 'pgroup_call', [{
      to: DEAL_DATA.contractAddress,
      data: {
        function: "getLoanDetails",
        inputs: {}
      },
      from: fromIdentity
    }]);
    
    if (response.error) {
      console.log(`   ❌ ACCESS DENIED: ${response.error.message}`);
      return { success: false, error: response.error.message };
    } else {
      console.log(`   ✅ ACCESS GRANTED: ${JSON.stringify(response.result)}`);
      return { success: true, result: response.result };
    }
  } catch (error) {
    console.log(`   ❌ ACCESS DENIED: ${error.message}`);
    return { success: false, error: error.message };
  }
}

async function runAddressLevelPrivacyTests() {
  console.log('🎯 ADDRESS-LEVEL PRIVACY VERIFICATION');
  console.log('=====================================\n');
  
  console.log('📋 PRIVACY TEST SCENARIO');
  console.log('========================');
  console.log(`📄 Contract: ${DEAL_DATA.contractAddress}`);
  console.log(`🔐 Privacy Group: ${DEAL_DATA.privacyGroupId}`);
  console.log(`💰 Deal: $${DEAL_DATA.loanAmount} loan at ${DEAL_DATA.interestRate/100}% interest\n`);
  
  console.log('👥 AUTHORIZED PARTIES (should access deal):');
  console.log(`   🏦 Lender: ${DEAL_DATA.authorizedLender} (on node1)`);
  console.log(`   🏭 Borrower: ${DEAL_DATA.authorizedBorrower} (on node2)\n`);
  
  console.log('🚫 UNAUTHORIZED PARTIES (should be BLOCKED):');
  console.log(`   💸 Fake Lender: ${DEAL_DATA.unauthorizedLenderNode1} (on node1)`);
  console.log(`   🏢 Fake Borrower: ${DEAL_DATA.unauthorizedBorrowerNode2} (on node2)`);
  console.log(`   🧑‍💻 Outsider: ${DEAL_DATA.outsiderNode3} (on node3)\n`);
  
  const testResults = [];

  // TEST 1: Authorized lender on node1 should work
  console.log('═══════════════════════════════════════════════════════════');
  const test1 = await testContractCall(
    ENDPOINTS.node1, 
    DEAL_DATA.authorizedLender,
    "TEST 1: Authorized Lender Access (SHOULD WORK)"
  );
  testResults.push({ name: "Authorized Lender", expected: true, actual: test1.success });

  // TEST 2: Unauthorized lender on node1 should fail
  const test2 = await testContractCall(
    ENDPOINTS.node1,
    DEAL_DATA.unauthorizedLenderNode1,
    "TEST 2: Unauthorized Lender on Node1 (SHOULD FAIL)"
  );
  testResults.push({ name: "Unauthorized Lender Node1", expected: false, actual: test2.success });

  // TEST 3: Authorized borrower on node2 should work
  const test3 = await testContractCall(
    ENDPOINTS.node2,
    DEAL_DATA.authorizedBorrower,
    "TEST 3: Authorized Borrower Access (SHOULD WORK)"
  );
  testResults.push({ name: "Authorized Borrower", expected: true, actual: test3.success });

  // TEST 4: Unauthorized borrower on node2 should fail
  const test4 = await testContractCall(
    ENDPOINTS.node2,
    DEAL_DATA.unauthorizedBorrowerNode2,
    "TEST 4: Unauthorized Borrower on Node2 (SHOULD FAIL)"
  );
  testResults.push({ name: "Unauthorized Borrower Node2", expected: false, actual: test4.success });

  // TEST 5: Try authorized lender from wrong node (cross-node test)
  const test5 = await testContractCall(
    ENDPOINTS.node2,
    DEAL_DATA.authorizedLender,
    "TEST 5: Authorized Lender from Wrong Node (SHOULD FAIL)"
  );
  testResults.push({ name: "Lender Wrong Node", expected: false, actual: test5.success });

  // TEST 6: Try authorized borrower from wrong node
  const test6 = await testContractCall(
    ENDPOINTS.node1,
    DEAL_DATA.authorizedBorrower,
    "TEST 6: Authorized Borrower from Wrong Node (SHOULD FAIL)"
  );
  testResults.push({ name: "Borrower Wrong Node", expected: false, actual: test6.success });

  // TEST 7: Random identity on node3 (outsider node)
  const test7 = await testContractCall(
    ENDPOINTS.node3,
    DEAL_DATA.outsiderNode3,
    "TEST 7: Outsider on Node3 (SHOULD FAIL)"
  );
  testResults.push({ name: "Outsider Node3", expected: false, actual: test7.success });

  // Print results summary
  console.log('\n\n🎯 ADDRESS-LEVEL PRIVACY TEST RESULTS');
  console.log('=====================================');
  
  let passedTests = 0;
  let totalTests = testResults.length;
  
  testResults.forEach((test, index) => {
    const passed = test.expected === test.actual;
    const status = passed ? '✅ PASS' : '❌ FAIL';
    const expectation = test.expected ? '(should access)' : '(should be blocked)';
    
    console.log(`${index + 1}. ${test.name} ${expectation}: ${status}`);
    
    if (passed) passedTests++;
  });
  
  console.log('\n📊 FINAL PRIVACY VERIFICATION RESULT');
  console.log('====================================');
  console.log(`Tests Passed: ${passedTests}/${totalTests}`);
  
  if (passedTests === totalTests) {
    console.log('🎉 ✅ ADDRESS-LEVEL PRIVACY WORKING PERFECTLY!');
    console.log('🔒 Only authorized addresses can access the deal');
    console.log('🚫 All unauthorized addresses properly blocked');
    console.log('\n💡 Your lending platform has STRONG privacy protection!');
  } else {
    console.log('❌ 🚨 PRIVACY ISSUES DETECTED!');
    console.log('⚠️  Some unauthorized addresses may have access');
    console.log('🔧 Review your privacy group configuration');
  }
}

// Run the tests
runAddressLevelPrivacyTests().catch(console.error);
