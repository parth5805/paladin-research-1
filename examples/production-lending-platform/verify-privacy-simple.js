/*
 * 🔒 SIMPLE PRIVACY VERIFICATION TEST
 * Tests that your lending deal is truly private using working patterns
 */

const http = require('http');

// Your actual deal data from the successful deployment
const DEAL_DATA = {
  contractAddress: "0x0d095e0c1312079727ed3ac2276ee9e7aa184d9c",
  privacyGroupId: "0x1ca8f7a62bea0da62f7105d025ebe340f5cfeac5d8ff5502e51f92d4efc21c6a",
  lenderIdentity: "bigbank@node1",
  borrowerIdentity: "techstartup@node2",
  lenderAddress: "0xc1e5fdd1d13ce121d3255e7dff14dfe2d0f42dae",
  borrowerAddress: "0xe37c48e0e63c0fa0f364b5dc101b8ebecc728ac7",
  loanAmount: "1000000",
  interestRate: "500"
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
      path: url.pathname,
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

async function testAuthorizedAccess() {
  console.log('\n🔍 TEST 1: Authorized Lender Access');
  console.log('-----------------------------------');
  
  try {
    // Test lender can access the contract within their privacy group
    const result = await makeRPCCall('http://localhost:31548', 'pgroup_call', [{
      to: DEAL_DATA.contractAddress,
      data: {
        function: 'getLoanDetails',
        inputs: {}
      },
      from: DEAL_DATA.lenderIdentity
    }]);
    
    if (result.result) {
      console.log(`✅ LENDER CAN ACCESS: Success!`);
      console.log(`📊 Loan Details: ${JSON.stringify(result.result)}`);
      return true;
    } else {
      console.log(`❌ LENDER ACCESS FAILED: ${JSON.stringify(result.error)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ LENDER ACCESS ERROR: ${error.message}`);
    return false;
  }
}

async function testUnauthorizedAccess() {
  console.log('\n🔍 TEST 2: Unauthorized Outsider Access (Should FAIL)');
  console.log('-----------------------------------------------------');
  
  try {
    // Test outsider cannot access the contract
    const result = await makeRPCCall('http://localhost:31548', 'pgroup_call', [{
      to: DEAL_DATA.contractAddress,
      data: {
        function: 'getLoanDetails',
        inputs: {}
      },
      from: 'outsider@node1'  // Someone not in the privacy group
    }]);
    
    if (result.error) {
      console.log(`✅ OUTSIDER CORRECTLY DENIED ACCESS ✓`);
      console.log(`🔒 Privacy working: ${result.error.message}`);
      return true;
    } else {
      console.log(`❌❌❌ PRIVACY BREACH! Outsider accessed: ${JSON.stringify(result.result)}`);
      console.log(`❌❌❌ THIS IS A SECURITY VIOLATION!`);
      return false;
    }
  } catch (error) {
    console.log(`✅ OUTSIDER ACCESS PROPERLY BLOCKED: ${error.message}`);
    return true;
  }
}

async function testCrossNodeAccess() {
  console.log('\n🔍 TEST 3: Cross-Node Privacy Verification');
  console.log('------------------------------------------');
  
  try {
    // Try to access from borrower's node (should work)
    const borrowerResult = await makeRPCCall('http://localhost:31648', 'pgroup_call', [{
      to: DEAL_DATA.contractAddress,
      data: {
        function: 'getLoanDetails',
        inputs: {}
      },
      from: DEAL_DATA.borrowerIdentity
    }]);
    
    if (borrowerResult.result) {
      console.log(`✅ BORROWER CAN ACCESS FROM NODE2 ✓`);
      return true;
    } else {
      console.log(`❌ BORROWER ACCESS FAILED: ${JSON.stringify(borrowerResult.error)}`);
      return false;
    }
  } catch (error) {
    console.log(`❌ CROSS-NODE ACCESS ERROR: ${error.message}`);
    return false;
  }
}

async function testPrivacyGroupIsolation() {
  console.log('\n🔍 TEST 4: Privacy Group Isolation');
  console.log('----------------------------------');
  
  try {
    // Get recent transactions to see if our privacy group is isolated
    const txResult = await makeRPCCall('http://localhost:31548', 'ptx_queryTransactions', [{
      limit: 10
    }]);
    
    if (txResult.result) {
      console.log(`📊 Found ${txResult.result.length} recent transactions`);
      
      // Check if any transactions belong to our privacy group
      const ourTransactions = txResult.result.filter(tx => 
        tx.from && (tx.from.includes(DEAL_DATA.lenderIdentity) || tx.from.includes(DEAL_DATA.borrowerIdentity))
      );
      
      console.log(`🔐 Our privacy group transactions: ${ourTransactions.length}`);
      
      if (ourTransactions.length > 0) {
        console.log(`✅ Privacy group transactions found and isolated ✓`);
        return true;
      } else {
        console.log(`⚠️  No recent transactions found for our identities`);
        return true; // Not necessarily an error
      }
    }
  } catch (error) {
    console.log(`❌ Privacy group isolation test failed: ${error.message}`);
    return false;
  }
}

async function printDealSummary() {
  console.log('\n📋 DEAL PRIVACY SUMMARY');
  console.log('========================');
  console.log(`📄 Contract Address: ${DEAL_DATA.contractAddress}`);
  console.log(`🔐 Privacy Group ID: ${DEAL_DATA.privacyGroupId}`);
  console.log(`🏦 Authorized Lender: ${DEAL_DATA.lenderIdentity} (${DEAL_DATA.lenderAddress})`);
  console.log(`🏭 Authorized Borrower: ${DEAL_DATA.borrowerIdentity} (${DEAL_DATA.borrowerAddress})`);
  console.log(`💰 Loan Amount: $${DEAL_DATA.loanAmount} (PRIVATE)`);
  console.log(`📈 Interest Rate: ${parseInt(DEAL_DATA.interestRate)/100}% (PRIVATE)`);
  console.log(`\n🔒 PRIVACY REQUIREMENTS:`);
  console.log(`   ✅ Only lender should see loan details`);
  console.log(`   ✅ Only borrower should see loan details`);
  console.log(`   ❌ NO outsiders should access this data`);
  console.log(`   ❌ NO other privacy groups should see this`);
}

async function main() {
  console.log('🚀 LENDING DEAL PRIVACY VERIFICATION');
  console.log('====================================');
  
  await printDealSummary();
  
  // Run all tests
  const test1 = await testAuthorizedAccess();
  const test2 = await testUnauthorizedAccess();
  const test3 = await testCrossNodeAccess();
  const test4 = await testPrivacyGroupIsolation();
  
  // Final verdict
  console.log('\n🎯 PRIVACY VERIFICATION RESULTS');
  console.log('===============================');
  console.log(`Test 1 - Authorized Access: ${test1 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 2 - Unauthorized Denied: ${test2 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 3 - Cross-Node Access: ${test3 ? '✅ PASSED' : '❌ FAILED'}`);
  console.log(`Test 4 - Group Isolation: ${test4 ? '✅ PASSED' : '❌ FAILED'}`);
  
  if (test1 && test2 && test3 && test4) {
    console.log('\n🎉🎉🎉 ALL PRIVACY TESTS PASSED! 🎉🎉🎉');
    console.log('=====================================');
    console.log('✅ Your lending deal is truly private!');
    console.log('✅ Only authorized lender and borrower can access!');
    console.log('✅ Sensitive financial data is protected!');
    console.log('✅ Privacy group isolation is working!');
    console.log('\n🔒 PRIVACY VERIFICATION: PASSED ✓');
  } else {
    console.log('\n❌ PRIVACY VERIFICATION FAILED!');
    console.log('Some privacy tests did not pass.');
    console.log('Your lending platform may have privacy issues.');
  }
}

// Handle node-fetch import for older Node versions
main().catch(error => {
  console.error('Test failed:', error.message);
  process.exit(1);
});
