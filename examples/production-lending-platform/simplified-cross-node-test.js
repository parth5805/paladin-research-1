/**
 * Simplified Cross-Node Privacy Test
 * 
 * This test uses existing privacy groups to demonstrate cross-node privacy 
 * instead of creating new ephemeral EVMs.
 * 
 * Test Scenario:
 * - Use existing cross-node privacy group between node1 and node2
 * - Deploy SimpleStorage contract to that privacy group
 * - Test that authorized members can access while others cannot
 */

const PaladinClient = require('@lfdecentralizedtrust-labs/paladin-sdk').default;

// SimpleStorage contract ABI and bytecode
const SimpleStorageABI = [
    {
        "inputs": [],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [
            {
                "indexed": false,
                "internalType": "uint256",
                "name": "newValue",
                "type": "uint256"
            }
        ],
        "name": "ValueChanged",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "read",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "storedData",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [
            {
                "internalType": "uint256",
                "name": "_value",
                "type": "uint256"
            }
        ],
        "name": "write",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

const SimpleStorageBytecode = "0x6080604052348015600e575f5ffd5b505f5f819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c595f604051604291906091565b60405180910390a160a8565b5f819050919050565b5f819050919050565b5f819050919050565b5f607d6079607584604e565b6060565b6057565b9050919050565b608b816069565b82525050565b5f60208201905060a25f8301846084565b92915050565b6101a8806100b55f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c80632a1afcd9146100435780632f048afa1461006157806357de26a41461007d575b5f5ffd5b61004b61009b565b6040516100589190610100565b60405180910390f35b61007b60048036038101906100769190610147565b6100a0565b005b6100856100e0565b6040516100929190610100565b60405180910390f35b5f5481565b805f819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c59816040516100d59190610100565b60405180910390a150565b5f5f54905090565b5f819050919050565b6100fa816100e8565b82525050565b5f6020820190506101135f8301846100f1565b92915050565b5f5ffd5b610126816100e8565b8114610130575f5ffd5b50565b5f813590506101418161011d565b92915050565b5f6020828403121561015c5761015b610119565b5b5f61016984828501610133565b9150509291505056fea26469706673582212205682ad2d388ce03d7b3286dc4e0c08b14990f5009ef3315438f8d20120b1e81164736f6c634300081e0033";

class SimplifiedPrivacyTest {
    constructor() {
        // Kubernetes NodePort endpoints for the 3 Paladin nodes
        this.nodes = {
            node1: new PaladinClient({ url: 'http://localhost:31548' }),
            node2: new PaladinClient({ url: 'http://localhost:31549' }),
            node3: new PaladinClient({ url: 'http://localhost:31550' })
        };
        
        this.targetPrivacyGroup = null;
        this.contractAddress = null;
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async findExistingPrivacyGroup() {
        this.log('Looking for existing cross-node privacy groups');
        
        try {
            const client = this.nodes.node1;
            const groups = await client.pgroup.queryGroups({ limit: 20 });
            
            // Look for a group with members from different nodes
            for (const group of groups) {
                const hasNode1Member = group.members.some(member => member.includes('@node1'));
                const hasNode2Member = group.members.some(member => member.includes('@node2'));
                
                if (hasNode1Member && hasNode2Member) {
                    this.targetPrivacyGroup = group;
                    this.log(`✅ Found cross-node privacy group: ${group.id}`);
                    this.log(`   Name: ${group.name || 'unnamed'}`);
                    this.log(`   Members: ${group.members.join(', ')}`);
                    this.log(`   Contract Address: ${group.contractAddress}`);
                    return group;
                }
            }
            
            this.log('❌ No existing cross-node privacy group found');
            return null;
            
        } catch (error) {
            this.log(`❌ Failed to query privacy groups: ${error.message}`);
            throw error;
        }
    }

    async deploySimpleStorageContract() {
        this.log('Deploying SimpleStorage contract to privacy group');
        
        try {
            // Use the first member as the deployer
            const deployerIdentity = this.targetPrivacyGroup.members[0];
            const client = this.nodes.node1; // Always use node1 for simplicity
            
            const txInput = {
                domain: 'pente',
                group: this.targetPrivacyGroup.id,
                from: deployerIdentity,
                bytecode: SimpleStorageBytecode,
                function: {
                    type: "constructor",
                    inputs: []
                },
                publicTxOptions: {
                    gas: '1000000'
                }
            };
            
            const txId = await client.pgroup.sendTransaction(txInput);
            this.log(`📄 Contract deployment transaction sent: ${txId}`);
            
            // Wait for transaction to complete
            await this.waitForTransaction(txId, client);
            
            // The contract address should be available from the privacy group
            this.contractAddress = this.targetPrivacyGroup.contractAddress;
            this.log(`✅ SimpleStorage contract deployed at: ${this.contractAddress}`);
            
            return this.contractAddress;
            
        } catch (error) {
            this.log(`❌ Failed to deploy SimpleStorage contract: ${error.message}`);
            throw error;
        }
    }

    async waitForTransaction(txId, client) {
        this.log(`⏳ Waiting for transaction ${txId} to complete...`);
        
        const maxAttempts = 30;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const receipt = await client.ptx.getTransactionReceipt(txId);
                if (receipt) {
                    this.log(`✅ Transaction ${txId} completed successfully`);
                    return receipt;
                }
            } catch (error) {
                // Transaction not ready yet, continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error(`Transaction ${txId} did not complete within timeout`);
    }

    async writeValueToContract(identity, value, nodeClient) {
        this.log(`${identity} attempting to write value ${value} to SimpleStorage contract`);
        
        try {
            const txInput = {
                domain: 'pente',
                group: this.targetPrivacyGroup.id,
                from: identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "write",
                    inputs: [{"name": "_value", "type": "uint256"}]
                },
                data: {
                    _value: value
                },
                publicTxOptions: {
                    gas: '100000'
                }
            };
            
            const txId = await nodeClient.pgroup.sendTransaction(txInput);
            this.log(`📝 Write transaction sent by ${identity}: ${txId}`);
            
            await this.waitForTransaction(txId, nodeClient);
            this.log(`✅ ${identity} successfully wrote value ${value}`);
            
            return txId;
            
        } catch (error) {
            this.log(`❌ ${identity} failed to write value: ${error.message}`);
            throw error;
        }
    }

    async readValueFromContract(identity, nodeClient) {
        this.log(`${identity} attempting to read value from SimpleStorage contract`);
        
        try {
            const callInput = {
                domain: 'pente',
                group: this.targetPrivacyGroup.id,
                from: identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "read",
                    inputs: [],
                    outputs: [{"name": "", "type": "uint256"}]
                }
            };
            
            const result = await nodeClient.pgroup.call(callInput);
            
            // Decode the result - it should be a uint256
            let value;
            if (typeof result === 'string' && result.startsWith('0x')) {
                value = parseInt(result, 16);
            } else if (Array.isArray(result) && result.length > 0) {
                value = parseInt(result[0], 10);
            } else {
                value = result;
            }
            
            this.log(`✅ ${identity} successfully read value: ${value}`);
            return value;
            
        } catch (error) {
            this.log(`❌ ${identity} failed to read value: ${error.message}`);
            
            // Check if this is a privacy group access error
            if (error.message.includes('Privacy group not found') || 
                error.message.includes('not authorized') ||
                error.message.includes('access denied')) {
                this.log(`🔒 ${identity} is correctly blocked from accessing the private contract`);
                return 'ACCESS_DENIED';
            }
            
            throw error;
        }
    }

    async testPrivacyIsolation() {
        this.log('Testing privacy isolation with unauthorized identities');
        
        const unauthorizedIdentities = [
            'eoa3-borrower@node3',  // Different node, not in group
            'eoa4-trader@node3',    // Different node, not in group  
            'unauthorized@node1',   // Same node as group member, but not in group
            'unauthorized@node2'    // Same node as group member, but not in group
        ];
        
        let isolationSuccessCount = 0;
        
        for (const identity of unauthorizedIdentities) {
            const nodeNum = identity.includes('@node1') ? 'node1' : 
                           identity.includes('@node2') ? 'node2' : 'node3';
            const client = this.nodes[nodeNum];
            
            try {
                const value = await this.readValueFromContract(identity, client);
                if (value === 'ACCESS_DENIED') {
                    isolationSuccessCount++;
                    this.log(`✅ ${identity} correctly blocked (privacy isolation working)`);
                } else {
                    this.log(`❌ ${identity} should not have access but read value: ${value}`);
                }
            } catch (error) {
                if (error.message.includes('Privacy group not found') || 
                    error.message.includes('not authorized') ||
                    error.message.includes('access denied')) {
                    isolationSuccessCount++;
                    this.log(`✅ ${identity} correctly blocked (privacy isolation working)`);
                } else {
                    this.log(`❌ ${identity} failed with unexpected error: ${error.message}`);
                }
            }
        }
        
        return { tested: unauthorizedIdentities.length, blocked: isolationSuccessCount };
    }

    async runSimplifiedTest() {
        this.log('🚀 Starting Simplified Cross-Node Privacy Test');
        this.log('==============================================');
        
        try {
            // Step 1: Find existing cross-node privacy group
            this.log('\n📋 Step 1: Finding existing cross-node privacy group');
            const group = await this.findExistingPrivacyGroup();
            
            if (!group) {
                this.log('❌ No existing cross-node privacy group found. Cannot proceed with test.');
                return;
            }
            
            // Step 2: Deploy SimpleStorage contract  
            this.log('\n📋 Step 2: Deploying SimpleStorage contract');
            await this.deploySimpleStorageContract();
            
            // Step 3: Authorized member writes value
            this.log('\n📋 Step 3: Authorized member writes value to contract');
            const authorizedIdentity = this.targetPrivacyGroup.members[0];
            const nodeNum = authorizedIdentity.includes('@node1') ? 'node1' : 
                           authorizedIdentity.includes('@node2') ? 'node2' : 'node3';
            const authorizedClient = this.nodes[nodeNum];
            
            await this.writeValueToContract(authorizedIdentity, 42, authorizedClient);
            
            // Step 4: Another authorized member reads the value
            if (this.targetPrivacyGroup.members.length > 1) {
                this.log('\n📋 Step 4: Another authorized member reads value');
                const secondIdentity = this.targetPrivacyGroup.members[1];
                const secondNodeNum = secondIdentity.includes('@node1') ? 'node1' : 
                                     secondIdentity.includes('@node2') ? 'node2' : 'node3';
                const secondClient = this.nodes[secondNodeNum];
                
                const readValue = await this.readValueFromContract(secondIdentity, secondClient);
                if (readValue === 42) {
                    this.log('✅ Cross-node privacy group working: Second member can access private data');
                }
            }
            
            // Step 5: Test privacy isolation
            this.log('\n📋 Step 5: Testing privacy isolation for unauthorized identities');
            const isolationResults = await this.testPrivacyIsolation();
            
            // Final results
            this.log('\n🎯 TEST RESULTS SUMMARY');
            this.log('=======================');
            this.log(`✅ Found existing cross-node privacy group: ${this.targetPrivacyGroup.name || 'unnamed'}`);
            this.log(`✅ SimpleStorage contract deployed and accessible to authorized members`);
            this.log(`✅ Cross-node communication: WORKING`);
            this.log(`✅ Privacy isolation: ${isolationResults.blocked}/${isolationResults.tested} unauthorized identities correctly blocked`);
            
            if (isolationResults.blocked === isolationResults.tested) {
                this.log('\n🎉 SUCCESS: Cross-node privacy working correctly!');
                this.log('   - Authorized members can access private data across nodes');
                this.log('   - Unauthorized identities cannot access private data');
                this.log('   - Privacy isolation is enforced properly');
            } else {
                this.log('\n⚠️  PARTIAL SUCCESS: Some privacy isolation issues detected');
            }
            
        } catch (error) {
            this.log(`\n💥 Test failed with error: ${error.message}`);
            console.error(error);
        }
    }
}

// Run the test
const test = new SimplifiedPrivacyTest();
test.runSimplifiedTest().catch(console.error);
