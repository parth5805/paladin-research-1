/*
 * 🎯 IDENTITY-BASED PRIVACY VERIFICATION TEST
 * 
 * Tests that ONLY the specific authorized identities can access the lending deal
 * Even if other identities exist on the same nodes, they should be BLOCKED
 * 
 * PRIVACY RULE: Only bigbank@node1 and techstartup@node2 can access the deal
 */

const http = require('http');

// Your actual deployed contract details 
const CONTRACT_ADDRESS = "0x0d095e0c1312079727ed3ac2276ee9e7aa184d9c";
const PRIVACY_GROUP_ID = "0x1ca8f7a62bea0da62f7105d025ebe340f5cfeac5d8ff5502e51f92d4efc21c6a";

// Test specific identities - this is what you want to verify!
const AUTHORIZED_LENDER = "bigbank@node1";        // Should work from node1
const AUTHORIZED_BORROWER = "techstartup@node2";  // Should work from node2

// These should FAIL even though they're on the correct nodes
const FAKE_LENDER = "anotherlender@node1";        // Different lender on node1 - should FAIL
const FAKE_BORROWER = "anotherborrower@node2";    // Different borrower on node2 - should FAIL

const ENDPOINTS = {
  node1: "http://127.0.0.1:31548",
  node2: "http://127.0.0.1:31648"
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

async function testIdentityAccess(endpoint, identity, shouldWork) {
  const expectedResult = shouldWork ? "SHOULD WORK" : "SHOULD FAIL";
  console.log(`\n🔍 Testing ${identity} from ${endpoint} (${expectedResult})`);
  
  try {
    const response = await makeRPCCall(endpoint, 'pgroup_call', [{
      domain: "evm",
      groupId: PRIVACY_GROUP_ID,
      to: CONTRACT_ADDRESS,
      data: {
        function: "getLoanDetails",
        inputs: {}
      },
      from: identity
    }]);
    
    if (response.error) {
      console.log(`   ❌ ACCESS DENIED: ${response.error.message}`);
      return false;
    } else {
      console.log(`   ✅ ACCESS GRANTED: Got loan details!`);
      console.log(`   📊 Result: ${JSON.stringify(response.result).slice(0, 100)}...`);
      return true;
    }
  } catch (error) {
    console.log(`   ❌ ACCESS DENIED: ${error.message}`);
    return false;
  }
}

async function runIdentityPrivacyTest() {
  console.log('🎯 IDENTITY-BASED PRIVACY VERIFICATION');
  console.log('======================================\n');
  
  console.log('📋 TESTING SCENARIO:');
  console.log(`📄 Contract: ${CONTRACT_ADDRESS}`);
  console.log(`🏦 Authorized Lender: ${AUTHORIZED_LENDER}`);
  console.log(`🏭 Authorized Borrower: ${AUTHORIZED_BORROWER}`);
  console.log(`💰 Deal: $1M loan at 5% interest (PRIVATE DATA)\n`);
  
  console.log('🔒 PRIVACY REQUIREMENT:');
  console.log('   Only the EXACT authorized identities should access the deal');
  console.log('   Even other identities on the same nodes should be blocked!\n');
  
  console.log('🧪 RUNNING PRIVACY TESTS');
  console.log('========================');
  
  // Test 1: Authorized lender should work
  const test1 = await testIdentityAccess(ENDPOINTS.node1, AUTHORIZED_LENDER, true);
  
  // Test 2: Fake lender on same node should fail
  const test2 = await testIdentityAccess(ENDPOINTS.node1, FAKE_LENDER, false);
  
  // Test 3: Authorized borrower should work 
  const test3 = await testIdentityAccess(ENDPOINTS.node2, AUTHORIZED_BORROWER, true);
  
  // Test 4: Fake borrower on same node should fail
  const test4 = await testIdentityAccess(ENDPOINTS.node2, FAKE_BORROWER, false);
  
  // Test 5: Cross-node access (should fail)
  const test5 = await testIdentityAccess(ENDPOINTS.node2, AUTHORIZED_LENDER, false);
  const test6 = await testIdentityAccess(ENDPOINTS.node1, AUTHORIZED_BORROWER, false);
  
  console.log('\n🎯 PRIVACY TEST RESULTS');
  console.log('=======================');
  
  const results = [
    { name: "Authorized Lender Access", expected: true, actual: test1 },
    { name: "Fake Lender Blocked", expected: false, actual: test2 },
    { name: "Authorized Borrower Access", expected: true, actual: test3 },
    { name: "Fake Borrower Blocked", expected: false, actual: test4 },
    { name: "Cross-node Lender Blocked", expected: false, actual: test5 },
    { name: "Cross-node Borrower Blocked", expected: false, actual: test6 }
  ];
  
  let passed = 0;
  let total = results.length;
  
  results.forEach((test, i) => {
    const success = test.expected === test.actual;
    const status = success ? '✅ PASS' : '❌ FAIL';
    const expectation = test.expected ? '(should access)' : '(should be blocked)';
    
    console.log(`${i + 1}. ${test.name} ${expectation}: ${status}`);
    if (success) passed++;
  });
  
  console.log('\n📊 FINAL RESULT');
  console.log('===============');
  console.log(`Tests Passed: ${passed}/${total}`);
  
  if (passed === total) {
    console.log('🎉 ✅ IDENTITY-BASED PRIVACY WORKING PERFECTLY!');
    console.log('🔒 Only authorized identities can access the private deal');
    console.log('🚫 All unauthorized identities properly blocked');
    console.log('\n🏆 Your lending platform has STRONG identity-level privacy!');
    console.log('\n💡 KEY VERIFICATION POINTS:');
    console.log(`   ✅ ${AUTHORIZED_LENDER} can access from node1`);
    console.log(`   ✅ ${AUTHORIZED_BORROWER} can access from node2`);
    console.log(`   ✅ ${FAKE_LENDER} blocked on node1`);
    console.log(`   ✅ ${FAKE_BORROWER} blocked on node2`);
    console.log('   ✅ Cross-node access blocked');
  } else {
    console.log('❌ 🚨 PRIVACY ISSUES DETECTED!');
    console.log('⚠️  Some unauthorized identities may have access');
    console.log('🔧 Review your privacy group configuration');
  }
}

// Run the identity-based privacy test
runIdentityPrivacyTest().catch(console.error);
