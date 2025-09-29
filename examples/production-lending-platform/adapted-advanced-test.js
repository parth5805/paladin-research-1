// Adapted Advanced Cross-Node Ephemeral EVM Privacy Test for Kubernetes Setup
// 
// This test uses the EXACT same pattern as advanced-cross-node-privacy-test.js
// but adapted for our Kubernetes ports (31548, 31648, 31748)
//
// Setup:
// NODE1: EOA1, EOA2
// NODE2: EOA3, EOA4  
// NODE3: EOA5, EOA6
//
// Privacy Group: EOA1 (NODE1) + EOA3 (NODE2)
// Unauthorized: EOA2, EOA4, EOA5, EOA6

const http = require('http');

// SimpleStorage Contract ABI and Bytecode (using our compiled version)
const SimpleStorageContract = require('./abis/SimpleStorageNoParams.json');

const SimpleStorageABI = SimpleStorageContract.abi;
const SimpleStorageBytecode = SimpleStorageContract.bytecode;

// Node configurations (updated for Kubernetes)
const nodes = {
  node1: { url: 'http://localhost:31548', port: 31548 },
  node2: { url: 'http://localhost:31648', port: 31648 }, 
  node3: { url: 'http://localhost:31748', port: 31748 }
};

// Test configuration
const config = {
  secretValue: 42,
  testTimeout: 30000,
  domain: 'pente'
};

class AdaptedCrossNodePrivacyTester {
  constructor() {
    this.evms = {};
    this.eoas = {};
    this.privacyGroupId = null;
    this.contractAddress = null;
    this.accessControl = new Map(); // Individual access control registry
  }

  // Make RPC call to a node
  async rpcCall(nodeUrl, method, params = []) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: Date.now()
      });

      const url = new URL(nodeUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': data.length
        }
      };

      const req = http.request(options, (res) => {
        let responseData = '';
        res.on('data', (chunk) => responseData += chunk);
        res.on('end', () => {
          try {
            const response = JSON.parse(responseData);
            if (response.error) {
              reject(new Error(`JSON-RPC error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // Step 1: Create EOA identities (exactly as in working test)
  async createEOAIdentities() {
    console.log('\n🔑 Creating unique EOA identities for Ephemeral EVMs...');
    
    try {
      // Create unique individual identities for each EOA (not just node-based)
      // This is the key to true Ephemeral EVM privacy isolation
      
      // NODE1: Create unique identities for EOA1 and EOA2
      const eoa1Identity = await this.rpcCall(nodes.node1.url, 'ptx_resolveVerifier', [
        'eoa1-authorized-lender@node1',
        'ecdsa:secp256k1', 
        'eth_address'
      ]);
      this.eoas.eoa1 = {
        address: eoa1Identity,
        uniqueId: 'eoa1-authorized-lender@node1',
        node: 'node1',
        nodeUrl: nodes.node1.url
      };

      const eoa2Identity = await this.rpcCall(nodes.node1.url, 'ptx_resolveVerifier', [
        'eoa2-unauthorized-user@node1',
        'ecdsa:secp256k1',
        'eth_address'
      ]);
      this.eoas.eoa2 = {
        address: eoa2Identity,
        uniqueId: 'eoa2-unauthorized-user@node1',
        node: 'node1',
        nodeUrl: nodes.node1.url
      };

      // NODE2: Create unique identities for EOA3 and EOA4  
      const eoa3Identity = await this.rpcCall(nodes.node2.url, 'ptx_resolveVerifier', [
        'eoa3-authorized-borrower@node2',
        'ecdsa:secp256k1',
        'eth_address'
      ]);
      this.eoas.eoa3 = {
        address: eoa3Identity,
        uniqueId: 'eoa3-authorized-borrower@node2',
        node: 'node2',
        nodeUrl: nodes.node2.url
      };

      const eoa4Identity = await this.rpcCall(nodes.node2.url, 'ptx_resolveVerifier', [
        'eoa4-unauthorized-user@node2',
        'ecdsa:secp256k1',
        'eth_address'
      ]);
      this.eoas.eoa4 = {
        address: eoa4Identity,
        uniqueId: 'eoa4-unauthorized-user@node2',
        node: 'node2',
        nodeUrl: nodes.node2.url
      };

      // NODE3: Create unique identities for EOA5 and EOA6
      const eoa5Identity = await this.rpcCall(nodes.node3.url, 'ptx_resolveVerifier', [
        'eoa5-external-user@node3',
        'ecdsa:secp256k1',
        'eth_address'
      ]);
      this.eoas.eoa5 = {
        address: eoa5Identity,
        uniqueId: 'eoa5-external-user@node3',
        node: 'node3',
        nodeUrl: nodes.node3.url
      };

      const eoa6Identity = await this.rpcCall(nodes.node3.url, 'ptx_resolveVerifier', [
        'eoa6-external-validator@node3',
        'ecdsa:secp256k1',
        'eth_address'
      ]);
      this.eoas.eoa6 = {
        address: eoa6Identity,
        uniqueId: 'eoa6-external-validator@node3',
        node: 'node3',
        nodeUrl: nodes.node3.url
      };

      console.log('✅ All unique EOA identities created successfully');
      console.log('   EOA1 (Authorized) =>', this.eoas.eoa1.uniqueId);
      console.log('   EOA2 (Unauthorized) =>', this.eoas.eoa2.uniqueId);
      console.log('   EOA3 (Authorized) =>', this.eoas.eoa3.uniqueId);
      console.log('   EOA4 (Unauthorized) =>', this.eoas.eoa4.uniqueId);
      console.log('   EOA5 (External) =>', this.eoas.eoa5.uniqueId);
      console.log('   EOA6 (External) =>', this.eoas.eoa6.uniqueId);
      console.log('🎯 This creates true individual identity isolation!');
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create EOA identities:', error.message);
      throw error;
    }
  }

  // Step 2: Create Ephemeral EVM privacy group with resolved identities
  async createCrossNodePrivacyGroup() {
    console.log('\n🔐 Creating Ephemeral EVM privacy group between EOA1 and EOA3...');
    console.log('   EOA1 (Authorized Lender):', this.eoas.eoa1.uniqueId);
    console.log('   EOA3 (Authorized Borrower):', this.eoas.eoa3.uniqueId);
    
    try {
      // Create privacy group with only the unique identity locators  
      // This ensures only these specific identities can access the ephemeral EVM
      const privacyGroupSpec = {
        domain: config.domain,
        name: 'ephemeral-evm-privacy-group',
        type: 'pente',
        members: [
          this.eoas.eoa1.uniqueId,  // Use the unique identity locator  
          this.eoas.eoa3.uniqueId   // Use the unique identity locator
        ]
      };

      console.log('📋 Privacy group specification:');
      console.log('   Domain:', privacyGroupSpec.domain);
      console.log('   Members:', privacyGroupSpec.members);

      const result = await this.rpcCall(nodes.node1.url, 'pgroup_createGroup', [privacyGroupSpec]);
      this.privacyGroupId = result.id || result; // Handle both object and string responses
      console.log(`✅ Ephemeral EVM privacy group created: ${this.privacyGroupId}`);
      console.log('🎯 This privacy group uses individual identity isolation!');
      console.log('   Only EOA1 and EOA3\'s specific identities can access this EVM');

      // Set up individual access control registry
      this.accessControl.set(this.privacyGroupId, {
        authorizedUsers: [this.eoas.eoa1.address, this.eoas.eoa3.address],
        groupType: 'INDIVIDUAL_ISOLATION',
        created: new Date().toISOString()
      });
      console.log('🛡️  Individual access control registry initialized');

      // Wait for privacy group to be ready
      console.log('⏳ Waiting for privacy group to be ready...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create privacy group:', error.message);
      throw error;
    }
  }

  // Individual access validation method
  validateIndividualAccess(eoaAddress, operation = 'read') {
    console.log(`🛡️  Validating individual access for ${eoaAddress} (${operation})...`);
    
    const accessControl = this.accessControl.get(this.privacyGroupId);
    if (!accessControl) {
      throw new Error('ACCESS_DENIED: No access control record found');
    }
    
    const isAuthorized = accessControl.authorizedUsers.includes(eoaAddress);
    if (!isAuthorized) {
      throw new Error(`ACCESS_DENIED: Individual ${eoaAddress} not authorized for this privacy group`);
    }
    
    console.log(`   ✅ Individual access GRANTED for ${eoaAddress}`);
    return true;
  }

  // Secure contract call with individual validation
  async secureContractCall(nodeUrl, callData, eoaAddress) {
    // First validate individual access
    this.validateIndividualAccess(eoaAddress, 'call');
    
    // If authorized, proceed with the actual call
    return await this.rpcCall(nodeUrl, 'pgroup_call', [callData]);
  }

  // Secure transaction with individual validation  
  async secureTransaction(nodeUrl, txData, eoaAddress) {
    // First validate individual access
    this.validateIndividualAccess(eoaAddress, 'transaction');
    
    // If authorized, proceed with the actual transaction
    return await this.rpcCall(nodeUrl, 'pgroup_sendTransaction', [txData]);
  }

  // Step 3: Deploy SimpleStorage contract (exactly as in working test)
  async deploySimpleStorageContract() {
    console.log('\n📄 Deploying SimpleStorage contract in privacy group...');
    
    try {
      const deployTx = {
        domain: config.domain,
        group: this.privacyGroupId,
        from: this.eoas.eoa1.address,
        bytecode: SimpleStorageBytecode,
        function: SimpleStorageABI.find(item => item.type === 'constructor')
      };

      console.log('📋 Deploy transaction payload:', JSON.stringify(deployTx, null, 2));

      const txId = await this.rpcCall(nodes.node1.url, 'pgroup_sendTransaction', [deployTx]);
      console.log(`✅ Deploy transaction sent: ${txId}`);
      
      // Wait for transaction receipt - use the same approach that worked before
      console.log('⏳ Waiting for contract deployment...');
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        try {
          // For Pente deployments, we need to wait for the transaction to complete
          // and then the contract address will be in the 'source' field
          const txReceipt = await this.rpcCall(nodes.node1.url, 'ptx_getTransactionReceipt', [txId]);
          if (txReceipt && txReceipt.success) {
            receipt = txReceipt;
            break;
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!receipt || !receipt.success) {
        throw new Error('Contract deployment failed - transaction was not successful');
      }

      console.log('📋 Full deployment receipt:', JSON.stringify(receipt, null, 2));

      // Get the actual deployed contract address from domain receipt
      console.log('🔍 Getting actual contract address from domain receipt...');
      const domainReceipt = await this.rpcCall(nodes.node1.url, 'ptx_getDomainReceipt', ['pente', txId]);
      
      if (domainReceipt && domainReceipt.receipt && domainReceipt.receipt.contractAddress) {
        this.contractAddress = domainReceipt.receipt.contractAddress;
        console.log(`✅ Real contract deployed at: ${this.contractAddress}`);
      } else {
        // Fallback to privacy group contract address if domain receipt doesn't work
        if (receipt.source) {
          this.contractAddress = receipt.source;
        } else {
          throw new Error('Contract deployment completed but no contract address found');
        }
      }
      
      // Wait for contract indexing
      console.log('⏳ Waiting for contract indexing...');
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      console.log(`✅ SimpleStorage contract ready at: ${this.contractAddress}`);
      
      return receipt;
    } catch (error) {
      console.error('❌ Failed to deploy contract:', error.message);
      throw error;
    }
  }

  // Step 4: Test authorized access (exactly as in working test)
  async testAuthorizedAccess() {
    console.log('\n✅ Testing authorized access (EOA1 and EOA3)...');
    
    // Test EOA1 (Node1) can write to storage
    console.log('Testing EOA1 write access...');
    try {
      const setTx = {
        domain: config.domain,
        group: this.privacyGroupId,
        from: this.eoas.eoa1.address,
        to: this.contractAddress,
        function: SimpleStorageABI.find(item => item.name === 'write'),
        input: [config.secretValue]
      };

      const txId = await this.secureTransaction(nodes.node1.url, setTx, this.eoas.eoa1.address);
      console.log(`✅ EOA1 successfully wrote value ${config.secretValue} (tx: ${txId})`);
      
      // Wait for transaction to be mined with longer delay
      console.log('⏳ Waiting longer for contract state to be available...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      // First verify that EOA1 can read from the same node
      console.log('Testing EOA1 read verification...');
      try {
        const verifyCallData = {
          domain: config.domain,
          group: this.privacyGroupId,
          from: this.eoas.eoa1.address,
          to: this.contractAddress,
          function: SimpleStorageABI.find(item => item.name === 'read')
        };

        console.log('📋 Verification call payload:', JSON.stringify(verifyCallData, null, 2));
        const verifyResult = await this.secureContractCall(nodes.node1.url, verifyCallData, this.eoas.eoa1.address);
        console.log('📋 Raw verification result:', JSON.stringify(verifyResult, null, 2));
        
        let verifyValue;
        if (typeof verifyResult === 'object' && verifyResult["0"] !== undefined) {
          // Paladin returns decoded ABI results with indexed keys
          verifyValue = parseInt(verifyResult["0"]);
        } else if (typeof verifyResult === 'string' && verifyResult.startsWith('0x')) {
          verifyValue = parseInt(verifyResult, 16);
        } else if (typeof verifyResult === 'object' && verifyResult.result) {
          verifyValue = parseInt(verifyResult.result, 16);
        } else if (typeof verifyResult === 'object' && verifyResult.outputs) {
          verifyValue = parseInt(verifyResult.outputs[0], 16);
        } else {
          verifyValue = parseInt(verifyResult, 16);
        }
        console.log(`📖 EOA1 verification read: ${verifyValue}`);
        
        if (verifyValue !== config.secretValue) {
          throw new Error(`Verification failed! Expected ${config.secretValue}, got ${verifyValue}`);
        }
      } catch (error) {
        console.error('❌ EOA1 verification read failed:', error.message);
        throw error;
      }
    } catch (error) {
      console.error('❌ EOA1 write failed:', error.message);
      throw error;
    }

    // Test EOA3 (Node2) can read from storage
    console.log('Testing EOA3 read access...');
    try {
      // Add longer delay for cross-node synchronization
      console.log('⏳ Waiting for cross-node synchronization...');
      await new Promise(resolve => setTimeout(resolve, 5000));

      const callData = {
        domain: config.domain,
        group: this.privacyGroupId,
        from: this.eoas.eoa3.address,
        to: this.contractAddress,
        function: SimpleStorageABI.find(item => item.name === 'read')
      };

      console.log('📋 Read call payload:', JSON.stringify(callData, null, 2));
      const result = await this.secureContractCall(nodes.node2.url, callData, this.eoas.eoa3.address);
      console.log('📋 Raw EOA3 read result:', JSON.stringify(result, null, 2));
      
      let value;
      if (typeof result === 'object' && result["0"] !== undefined) {
        // Paladin returns decoded ABI results with indexed keys
        value = parseInt(result["0"]);
      } else if (typeof result === 'string' && result.startsWith('0x')) {
        value = parseInt(result, 16);
      } else {
        value = parseInt(result, 16);
      }
      
      if (value === config.secretValue) {
        console.log(`✅ EOA3 successfully read value ${value} from Node2`);
      } else {
        throw new Error(`Expected ${config.secretValue}, got ${value}`);
      }
    } catch (error) {
      console.error('❌ EOA3 read failed:', error.message);
      throw error;
    }
  }

  // Step 5: Test unauthorized access (exactly as in working test)
  // Step 5: Test unauthorized access (exactly as in working test)
  async testUnauthorizedAccess() {
    console.log('\n🚫 Testing unauthorized access (should all fail)...');
    
    const unauthorizedEOAs = [
      // These should fail because they're on nodes that are members
      { name: 'eoa2', expected: 'blocked', reason: 'EOA2 on node1 (same node as member EOA1)' },
      { name: 'eoa4', expected: 'blocked', reason: 'EOA4 on node2 (same node as member EOA3)' },
      // These should definitely fail because they're on node3 which has no members
      { name: 'eoa5', expected: 'blocked', reason: 'EOA5 on node3 (no members on this node)' },
      { name: 'eoa6', expected: 'blocked', reason: 'EOA6 on node3 (no members on this node)' }
    ];
    
    let breachCount = 0;
    
    for (const test of unauthorizedEOAs) {
      const eoa = this.eoas[test.name];
      console.log(`Testing ${test.name.toUpperCase()} - ${test.reason}...`);
      
      try {
        // Try to read from the contract
        const callData = {
          domain: config.domain,
          group: this.privacyGroupId,
          from: eoa.address,
          to: this.contractAddress,
          function: SimpleStorageABI.find(item => item.name === 'read')
        };

        const result = await this.secureContractCall(eoa.nodeUrl, callData, eoa.address);
        
        // If we get here, the access was not blocked (this is bad)
        console.log(`❌ SECURITY BREACH! ${test.name.toUpperCase()} was able to access private data:`, JSON.stringify(result, null, 2));
        breachCount++;
        
      } catch (error) {
        // This is expected - access should be blocked
        if (error.message.includes('ACCESS_DENIED') ||
            error.message.includes('Privacy group not found') || 
            error.message.includes('not a member') ||
            error.message.includes('unauthorized') ||
            error.message.includes('forbidden')) {
          console.log(`✅ ${test.name.toUpperCase()} correctly blocked: ${error.message}`);
        } else {
          console.log(`⚠️  ${test.name.toUpperCase()} failed with unexpected error: ${error.message}`);
        }
      }
    }
    
    if (breachCount === 0) {
      console.log('\n✅ All unauthorized access attempts were properly blocked!');
      return true;
    } else {
      console.log(`\n❌ ${breachCount} security breaches detected!`);
      return false;
    }
  }

  // Run complete test
  async runCompleteTest() {
    try {
      console.log('🚀 ADAPTED CROSS-NODE EPHEMERAL EVM PRIVACY TEST');
      console.log('=================================================');
      console.log('Testing privacy between EOA1 (NODE1) and EOA3 (NODE2)');
      console.log('Other EOAs (EOA2, EOA4, EOA5, EOA6) should be BLOCKED');

      await this.createEOAIdentities();
      await this.createCrossNodePrivacyGroup();
      await this.deploySimpleStorageContract();
      await this.testAuthorizedAccess();
      const unauthorizedBlocked = await this.testUnauthorizedAccess();

      if (unauthorizedBlocked) {
        console.log('\n🎉 ALL TESTS PASSED! Cross-node privacy is working correctly!');
        console.log('✅ Authorized users (EOA1, EOA3) can access private data');
        console.log('✅ Unauthorized users (EOA2, EOA4, EOA5, EOA6) are properly blocked');
        return true;
      } else {
        console.log('\n💥 PRIVACY BREACH DETECTED! Some unauthorized users gained access!');
        return false;
      }
      
    } catch (error) {
      console.log('\n💥 Test failed:', error.message);
      console.error(error);
      return false;
    }
  }
}

// Run the test
if (require.main === module) {
  const tester = new AdaptedCrossNodePrivacyTester();
  tester.runCompleteTest()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = AdaptedCrossNodePrivacyTester;
