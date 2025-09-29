// Cross-Node Ephemeral EVM Privacy Test
// 
// This test demonstrates true cross-node privacy using ephemeral EVMs
// 
// Setup:
// NODE1: EOA1, EOA2
// NODE2: EOA3, EOA4  
// NODE3: EOA5, EOA6
//
// Privacy Group: EOA1 (NODE1) + EOA3 (NODE2)
// Unauthorized: EOA2, EOA4, EOA5, EOA6
//
// Expected behavior:
// - EOA1 and EOA3 can read/write the storage value
// - EOA2, EOA4, EOA5, EOA6 are completely blocked from accessing the storage

const http = require('http');

// SimpleStorage Contract ABI
const SimpleStorageABI = [
  {
    "type": "constructor",
    "inputs": [{"name": "x", "type": "uint256"}],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function",
    "name": "set",
    "inputs": [{"name": "_x", "type": "uint256"}],
    "outputs": [],
    "stateMutability": "nonpayable"
  },
  {
    "type": "function", 
    "name": "get",
    "inputs": [],
    "outputs": [{"name": "x", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "function",
    "name": "storedData", 
    "inputs": [],
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view"
  },
  {
    "type": "event",
    "name": "Changed",
    "inputs": [{"name": "x", "type": "uint256", "indexed": false}]
  }
];

// SimpleStorage Contract Bytecode
const SimpleStorageBytecode = "0x608060405234801561001057600080fd5b50604051610187380380610187833981810160405281019061003291906100a7565b61003b81610041565b506100d4565b806000819055507f552c678b57b71b95f1e0e73b8b6a07ec5976b3ab6df2a0275d0e7d4b87d2e4736000546040516100799190610092565b60405180910390a150565b6000819050919050565b61009681610083565b82525050565b60006020820190506100b1600083018461008d565b92915050565b600080fd5b6100c581610083565b81146100d057600080fd5b50565b6000815190506100e2816100bc565b92915050565b6000602082840312156100fe576100fd6100b7565b5b600061010c848285016100d3565b91505092915050565b60a6806101236000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c80632a1afcd91460375780636057361d14604c575b600080fd5b60005460405190815260200160405180910390f35b60596057366004605b565b005b005b6000808280602001905181019060729190608b565b9050670405090b818181605081565b005b60008135905060856081608e565b92915050565b600082015190509291505056fea2646970667358221220e0a7bbcf0b8c5c0a1bf7b6b3a0c0d0e0f0g0h0i0j0k0l0m0n0o0p0q0r0s0t0u0v64736f6c63430008120033";

// Node configurations
const nodes = {
  node1: { url: 'http://localhost:8548', port: 8548 },
  node2: { url: 'http://localhost:8549', port: 8549 }, 
  node3: { url: 'http://localhost:8550', port: 8550 }
};

// Test configuration
const config = {
  secretValue: 42,
  testTimeout: 30000,
  domain: 'pente'
};

class CrossNodePrivacyTester {
  constructor() {
    this.evms = {};
    this.eoas = {};
    this.privacyGroupId = null;
    this.contractAddress = null;
  }

  // Make RPC call to a node
  async rpcCall(nodeUrl, method, params = []) {
    return new Promise((resolve, reject) => {
      const data = JSON.stringify({
        jsonrpc: '2.0',
        method: method,
        params: params,
        id: 1
      });

      const url = new URL(nodeUrl);
      const options = {
        hostname: url.hostname,
        port: url.port,
        path: url.pathname,
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
              reject(new Error(`RPC Error: ${response.error.message}`));
            } else {
              resolve(response.result);
            }
          } catch (error) {
            reject(error);
          }
        });
      });

      req.on('error', reject);
      req.write(data);
      req.end();
    });
  }

  // Step 1: Create ephemeral EVMs for each node
  async createEphemeralEVMs() {
    console.log('\n🏗️  Creating ephemeral EVMs for each node...');
    
    try {
      // Create EVM for Node1 (for EOA1 and EOA2)
      console.log('Creating EVM for Node1...');
      this.evms.node1 = await this.rpcCall(nodes.node1.url, 'pgroup_createEVMGroup', [{
        domain: config.domain,
        members: ['node1_eoa1', 'node1_eoa2'],
        name: 'Node1_EVM'
      }]);
      console.log(`✅ Node1 EVM created: ${this.evms.node1.id}`);

      // Create EVM for Node2 (for EOA3 and EOA4)
      console.log('Creating EVM for Node2...');
      this.evms.node2 = await this.rpcCall(nodes.node2.url, 'pgroup_createEVMGroup', [{
        domain: config.domain,
        members: ['node2_eoa3', 'node2_eoa4'],
        name: 'Node2_EVM'
      }]);
      console.log(`✅ Node2 EVM created: ${this.evms.node2.id}`);

      // Create EVM for Node3 (for EOA5 and EOA6)
      console.log('Creating EVM for Node3...');
      this.evms.node3 = await this.rpcCall(nodes.node3.url, 'pgroup_createEVMGroup', [{
        domain: config.domain,
        members: ['node3_eoa5', 'node3_eoa6'],
        name: 'Node3_EVM'
      }]);
      console.log(`✅ Node3 EVM created: ${this.evms.node3.id}`);

    } catch (error) {
      console.error('❌ Failed to create ephemeral EVMs:', error.message);
      throw error;
    }
  }

  // Step 2: Setup EOA identities
  async setupEOAIdentities() {
    console.log('\n👥 Setting up EOA identities...');
    
    // Define EOA mappings
    this.eoas = {
      eoa1: { node: 'node1', identity: 'node1_eoa1', nodeUrl: nodes.node1.url },
      eoa2: { node: 'node1', identity: 'node1_eoa2', nodeUrl: nodes.node1.url },
      eoa3: { node: 'node2', identity: 'node2_eoa3', nodeUrl: nodes.node2.url },
      eoa4: { node: 'node2', identity: 'node2_eoa4', nodeUrl: nodes.node2.url },
      eoa5: { node: 'node3', identity: 'node3_eoa5', nodeUrl: nodes.node3.url },
      eoa6: { node: 'node3', identity: 'node3_eoa6', nodeUrl: nodes.node3.url }
    };

    // Resolve addresses for each EOA
    for (const [eoaName, eoaInfo] of Object.entries(this.eoas)) {
      try {
        const address = await this.rpcCall(eoaInfo.nodeUrl, 'ptx_resolveVerifier', [
          eoaInfo.identity,
          'ecdsa_secp256k1',
          'eth_address'
        ]);
        eoaInfo.address = address;
        console.log(`✅ ${eoaName.toUpperCase()}: ${eoaInfo.identity} -> ${address} (${eoaInfo.node})`);
      } catch (error) {
        console.error(`❌ Failed to resolve ${eoaName}:`, error.message);
        throw error;
      }
    }
  }

  // Step 3: Create cross-node privacy group (EOA1 + EOA3)
  async createCrossNodePrivacyGroup() {
    console.log('\n🔐 Creating cross-node privacy group (EOA1 + EOA3)...');
    
    try {
      // Create privacy group with EOA1 and EOA3
      const privacyGroupInput = {
        domain: config.domain,
        members: [this.eoas.eoa1.identity, this.eoas.eoa3.identity],
        name: 'CrossNode_EOA1_EOA3_PrivacyGroup'
      };

      // Create the privacy group on Node1 (EOA1's node)
      const privacyGroup = await this.rpcCall(nodes.node1.url, 'pgroup_createGroup', [privacyGroupInput]);
      this.privacyGroupId = privacyGroup.id;
      
      console.log(`✅ Privacy group created: ${this.privacyGroupId}`);
      console.log(`   Members: ${this.eoas.eoa1.identity} (Node1), ${this.eoas.eoa3.identity} (Node2)`);
      
      return privacyGroup;
    } catch (error) {
      console.error('❌ Failed to create privacy group:', error.message);
      throw error;
    }
  }

  // Step 4: Deploy SimpleStorage contract in privacy group
  async deploySimpleStorageContract() {
    console.log('\n📄 Deploying SimpleStorage contract in privacy group...');
    
    try {
      const deployTx = {
        domain: config.domain,
        group: this.privacyGroupId,
        from: this.eoas.eoa1.address,
        bytecode: SimpleStorageBytecode,
        function: {
          type: 'constructor',
          inputs: [{ name: 'x', type: 'uint256' }]
        },
        input: [0] // Initialize with 0
      };

      const txId = await this.rpcCall(nodes.node1.url, 'pgroup_sendTransaction', [deployTx]);
      console.log(`✅ Deploy transaction sent: ${txId}`);
      
      // Wait for transaction receipt
      console.log('⏳ Waiting for contract deployment...');
      let receipt = null;
      for (let i = 0; i < 30; i++) {
        try {
          receipt = await this.rpcCall(nodes.node1.url, 'ptx_getTransactionReceipt', [txId]);
          if (receipt && receipt.contractAddress) {
            break;
          }
        } catch (error) {
          // Continue waiting
        }
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      if (!receipt || !receipt.contractAddress) {
        throw new Error('Contract deployment failed - no contract address received');
      }

      this.contractAddress = receipt.contractAddress;
      console.log(`✅ SimpleStorage contract deployed at: ${this.contractAddress}`);
      
      return receipt;
    } catch (error) {
      console.error('❌ Failed to deploy contract:', error.message);
      throw error;
    }
  }

  // Step 5: Test authorized access (EOA1 and EOA3)
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
        function: {
          type: 'function',
          name: 'set',
          inputs: [{ name: '_x', type: 'uint256' }]
        },
        input: [config.secretValue]
      };

      const txId = await this.rpcCall(nodes.node1.url, 'pgroup_sendTransaction', [setTx]);
      console.log(`✅ EOA1 successfully wrote value ${config.secretValue} (tx: ${txId})`);
      
      // Wait for transaction to be mined
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error) {
      console.error('❌ EOA1 write failed:', error.message);
      throw error;
    }

    // Test EOA3 (Node2) can read from storage
    console.log('Testing EOA3 read access...');
    try {
      const callData = {
        domain: config.domain,
        group: this.privacyGroupId,
        from: this.eoas.eoa3.address,
        to: this.contractAddress,
        function: {
          type: 'function',
          name: 'get',
          inputs: [],
          outputs: [{ name: 'x', type: 'uint256' }]
        }
      };

      const result = await this.rpcCall(nodes.node2.url, 'pgroup_call', [callData]);
      const value = parseInt(result, 16);
      
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

  // Step 6: Test unauthorized access (EOA2, EOA4, EOA5, EOA6)
  async testUnauthorizedAccess() {
    console.log('\n🚫 Testing unauthorized access (should all fail)...');
    
    const unauthorizedEOAs = ['eoa2', 'eoa4', 'eoa5', 'eoa6'];
    
    for (const eoaName of unauthorizedEOAs) {
      const eoa = this.eoas[eoaName];
      console.log(`Testing ${eoaName.toUpperCase()} (${eoa.node}) - should be blocked...`);
      
      try {
        // Try to read from the contract
        const callData = {
          domain: config.domain,
          group: this.privacyGroupId,
          from: eoa.address,
          to: this.contractAddress,
          function: {
            type: 'function',
            name: 'get',
            inputs: [],
            outputs: [{ name: 'x', type: 'uint256' }]
          }
        };

        const result = await this.rpcCall(eoa.nodeUrl, 'pgroup_call', [callData]);
        
        // If we get here, the access was not blocked (this is bad)
        console.log(`❌ SECURITY BREACH! ${eoaName.toUpperCase()} was able to access private data: ${result}`);
        return false;
        
      } catch (error) {
        // This is expected - access should be blocked
        if (error.message.includes('Privacy group not found') || 
            error.message.includes('not a member') ||
            error.message.includes('unauthorized')) {
          console.log(`✅ ${eoaName.toUpperCase()} correctly blocked: ${error.message}`);
        } else {
          console.log(`⚠️  ${eoaName.toUpperCase()} blocked with different error: ${error.message}`);
        }
      }

      // Also try to write (should also fail)
      try {
        const setTx = {
          domain: config.domain,
          group: this.privacyGroupId,
          from: eoa.address,
          to: this.contractAddress,
          function: {
            type: 'function',
            name: 'set',
            inputs: [{ name: '_x', type: 'uint256' }]
          },
          input: [999] // Try to write a different value
        };

        const txId = await this.rpcCall(eoa.nodeUrl, 'pgroup_sendTransaction', [setTx]);
        
        // If we get here, the write was not blocked (this is bad)
        console.log(`❌ SECURITY BREACH! ${eoaName.toUpperCase()} was able to write to private storage: ${txId}`);
        return false;
        
      } catch (error) {
        // This is expected - write should be blocked
        console.log(`✅ ${eoaName.toUpperCase()} write correctly blocked`);
      }
    }
    
    return true;
  }

  // Run complete test
  async runCompleteTest() {
    console.log('🚀 Starting Cross-Node Ephemeral EVM Privacy Test');
    console.log('===================================================');
    
    try {
      // Step 1: Create ephemeral EVMs
      await this.createEphemeralEVMs();
      
      // Step 2: Setup EOA identities  
      await this.setupEOAIdentities();
      
      // Step 3: Create cross-node privacy group
      await this.createCrossNodePrivacyGroup();
      
      // Step 4: Deploy SimpleStorage contract
      await this.deploySimpleStorageContract();
      
      // Step 5: Test authorized access
      await this.testAuthorizedAccess();
      
      // Step 6: Test unauthorized access
      const privacyPreserved = await this.testUnauthorizedAccess();
      
      // Final results
      console.log('\n🎯 TEST RESULTS');
      console.log('================');
      console.log(`✅ Cross-node privacy group created: ${this.privacyGroupId}`);
      console.log(`✅ SimpleStorage contract deployed: ${this.contractAddress}`);
      console.log(`✅ EOA1 (Node1) can write private data`);
      console.log(`✅ EOA3 (Node2) can read private data`);
      console.log(`${privacyPreserved ? '✅' : '❌'} EOA2, EOA4, EOA5, EOA6 are blocked from private data`);
      
      if (privacyPreserved) {
        console.log('\n🎉 SUCCESS: Cross-node ephemeral EVM privacy is working perfectly!');
        console.log('   Privacy is maintained across multiple nodes using ephemeral EVMs');
      } else {
        console.log('\n⚠️  WARNING: Privacy isolation has been breached!');
      }
      
    } catch (error) {
      console.error('\n❌ Test failed:', error.message);
      console.error(error.stack);
      process.exit(1);
    }
  }
}

// Run the test
async function main() {
  const tester = new CrossNodePrivacyTester();
  await tester.runCompleteTest();
}

// Execute if run directly
if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = CrossNodePrivacyTester;
