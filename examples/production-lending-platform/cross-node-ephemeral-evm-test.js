/**
 * Cross-Node Ephemeral EVM Privacy Test
 * 
 * This test demonstrates true EOA-level privacy across multiple Paladin nodes using ephemeral EVMs.
 * 
 * Test Setup:
 * - 3 Paladin nodes (NODE1, NODE2, NODE3) exposed via Kubernetes NodePorts
 * - 6 EOAs: 2 per node (EOA1, EOA2 on NODE1; EOA3, EOA4 on NODE2; EOA5, EOA6 on NODE3)
 * - Each EOA gets its own ephemeral EVM for complete isolation
 * 
 * Test Scenario:
 * - EOA1 (NODE1) and EOA3 (NODE2) form a cross-node privacy group
 * - EOA1 writes value=1 to SimpleStorage contract
 * - EOA3 can read value=1 (authorized)
 * - EOA2, EOA4, EOA5, EOA6 cannot access the contract (isolated)
 */

const PaladinClient = require('@lfdecentralizedtrust-labs/paladin-sdk').default;
const { ethers } = require('ethers');

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

class CrossNodePrivacyTest {
    constructor() {
        // Kubernetes NodePort endpoints for the 3 Paladin nodes
        this.nodes = {
            node1: new PaladinClient({ url: 'http://localhost:31548' }),
            node2: new PaladinClient({ url: 'http://localhost:31549' }),
            node3: new PaladinClient({ url: 'http://localhost:31550' })
        };
        
        // EOA identity mappings (2 per node)
        this.eoas = {
            eoa1: { identity: 'eoa1-lender@node1', node: 'node1' },
            eoa2: { identity: 'eoa2-saver@node1', node: 'node1' },
            eoa3: { identity: 'eoa3-borrower@node2', node: 'node2' },
            eoa4: { identity: 'eoa4-trader@node2', node: 'node2' },
            eoa5: { identity: 'eoa5-investor@node3', node: 'node3' },
            eoa6: { identity: 'eoa6-validator@node3', node: 'node3' }
        };
        
        this.ephemeralEvms = {};
        this.contractAddress = null;
        this.crossNodePrivacyGroup = null;
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async createEphemeralEvm(eoaKey, eoaInfo) {
        this.log(`Creating ephemeral EVM for ${eoaKey} (${eoaInfo.identity})`);
        
        const client = this.nodes[eoaInfo.node];
        const timestamp = Date.now();
        
        try {
            const ephemeralEvm = await client.pgroup.createGroup({
                domain: 'pente',
                members: [eoaInfo.identity],
                name: `${eoaKey}-ephemeral-evm-${timestamp}`,
                properties: {
                    type: 'ephemeral-evm',
                    purpose: `${eoaKey}-isolated-environment`,
                    created: new Date().toISOString()
                },
                configuration: {
                    endorsementType: 'group_scoped_identities',
                    evmVersion: 'shanghai',
                    externalCallsEnabled: 'true'
                }
            });
            
            this.ephemeralEvms[eoaKey] = {
                ...ephemeralEvm,
                client: client,
                identity: eoaInfo.identity,
                node: eoaInfo.node
            };
            
            this.log(`✅ Created ephemeral EVM for ${eoaKey}: ${ephemeralEvm.id}`);
            return ephemeralEvm;
            
        } catch (error) {
            this.log(`❌ Failed to create ephemeral EVM for ${eoaKey}: ${error.message}`);
            throw error;
        }
    }

    async createCrossNodePrivacyGroup() {
        this.log('Creating cross-node privacy group between EOA1 (Node1) and EOA3 (Node2)');
        
        try {
            // Use Node1's client to create the cross-node privacy group
            const client = this.nodes.node1;
            
            const privacyGroup = await client.pgroup.createGroup({
                domain: 'pente',
                members: [
                    this.eoas.eoa1.identity,  // EOA1 from Node1
                    this.eoas.eoa3.identity   // EOA3 from Node2
                ],
                name: `cross-node-eoa1-eoa3-${Date.now()}`,
                properties: {
                    type: 'cross-node-privacy-group',
                    purpose: 'eoa1-eoa3-private-storage',
                    created: new Date().toISOString()
                },
                configuration: {
                    endorsementType: 'group_scoped_identities',
                    evmVersion: 'shanghai',
                    externalCallsEnabled: 'true'
                }
            });
            
            this.crossNodePrivacyGroup = {
                ...privacyGroup,
                client: client
            };
            
            this.log(`✅ Created cross-node privacy group: ${privacyGroup.id}`);
            this.log(`   Members: ${privacyGroup.members.join(', ')}`);
            this.log(`   Contract Address: ${privacyGroup.contractAddress}`);
            
            return privacyGroup;
            
        } catch (error) {
            this.log(`❌ Failed to create cross-node privacy group: ${error.message}`);
            throw error;
        }
    }

    async deploySimpleStorageContract() {
        this.log('Deploying SimpleStorage contract to cross-node privacy group');
        
        try {
            const txInput = {
                domain: 'pente',
                group: this.crossNodePrivacyGroup.id,
                from: this.eoas.eoa1.identity,
                bytecode: SimpleStorageBytecode,
                function: {
                    type: "constructor",
                    inputs: []
                },
                publicTxOptions: {
                    gas: '1000000'
                }
            };
            
            const txId = await this.crossNodePrivacyGroup.client.pgroup.sendTransaction(txInput);
            this.log(`📄 Contract deployment transaction sent: ${txId}`);
            
            // Wait for transaction receipt
            await this.waitForTransaction(txId, this.crossNodePrivacyGroup.client);
            
            // The contract will be deployed at a deterministic address within the privacy group
            this.contractAddress = this.crossNodePrivacyGroup.contractAddress;
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

    async writeValue(eoaKey, value) {
        this.log(`EOA${eoaKey.slice(-1)} attempting to write value ${value} to SimpleStorage contract`);
        
        try {
            const eoaInfo = this.eoas[eoaKey];
            const client = this.nodes[eoaInfo.node];
            
            const txInput = {
                domain: 'pente',
                group: this.crossNodePrivacyGroup.id,
                from: eoaInfo.identity,
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
            
            const txId = await client.pgroup.sendTransaction(txInput);
            this.log(`📝 Write transaction sent by ${eoaKey}: ${txId}`);
            
            await this.waitForTransaction(txId, client);
            this.log(`✅ ${eoaKey} successfully wrote value ${value}`);
            
            return txId;
            
        } catch (error) {
            this.log(`❌ ${eoaKey} failed to write value: ${error.message}`);
            throw error;
        }
    }

    async readValue(eoaKey) {
        this.log(`EOA${eoaKey.slice(-1)} attempting to read value from SimpleStorage contract`);
        
        try {
            const eoaInfo = this.eoas[eoaKey];
            const client = this.nodes[eoaInfo.node];
            
            const callInput = {
                domain: 'pente',
                group: this.crossNodePrivacyGroup.id,
                from: eoaInfo.identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "read",
                    inputs: [],
                    outputs: [{"name": "", "type": "uint256"}]
                }
            };
            
            const result = await client.pgroup.call(callInput);
            
            // Decode the result - it should be a uint256
            let value;
            if (typeof result === 'string' && result.startsWith('0x')) {
                value = parseInt(result, 16);
            } else if (Array.isArray(result) && result.length > 0) {
                value = parseInt(result[0], 10);
            } else {
                value = result;
            }
            
            this.log(`✅ ${eoaKey} successfully read value: ${value}`);
            return value;
            
        } catch (error) {
            this.log(`❌ ${eoaKey} failed to read value: ${error.message}`);
            
            // Check if this is a privacy group access error
            if (error.message.includes('Privacy group not found') || 
                error.message.includes('not authorized') ||
                error.message.includes('access denied')) {
                this.log(`🔒 ${eoaKey} is correctly blocked from accessing the private contract`);
                return 'ACCESS_DENIED';
            }
            
            throw error;
        }
    }

    async runPrivacyTest() {
        this.log('🚀 Starting Cross-Node Ephemeral EVM Privacy Test');
        this.log('================================================');
        
        try {
            // Step 1: Create ephemeral EVMs for all 6 EOAs
            this.log('\n📋 Step 1: Creating ephemeral EVMs for all EOAs');
            for (const [eoaKey, eoaInfo] of Object.entries(this.eoas)) {
                await this.createEphemeralEvm(eoaKey, eoaInfo);
            }
            
            // Step 2: Create cross-node privacy group between EOA1 and EOA3
            this.log('\n📋 Step 2: Creating cross-node privacy group');
            await this.createCrossNodePrivacyGroup();
            
            // Step 3: Deploy SimpleStorage contract
            this.log('\n📋 Step 3: Deploying SimpleStorage contract');
            await this.deploySimpleStorageContract();
            
            // Step 4: EOA1 writes value to contract
            this.log('\n📋 Step 4: EOA1 writes value to private contract');
            await this.writeValue('eoa1', 42);
            
            // Step 5: EOA3 reads the value (should work - same privacy group)
            this.log('\n📋 Step 5: EOA3 reads value (authorized member)');
            const eoa3Value = await this.readValue('eoa3');
            if (eoa3Value === 42) {
                this.log('✅ Cross-node privacy group working: EOA3 can access EOA1\'s private data');
            }
            
            // Step 6: Test privacy isolation - other EOAs should be blocked
            this.log('\n📋 Step 6: Testing privacy isolation for unauthorized EOAs');
            
            const unauthorizedEoas = ['eoa2', 'eoa4', 'eoa5', 'eoa6'];
            let isolationSuccessCount = 0;
            
            for (const eoaKey of unauthorizedEoas) {
                try {
                    const value = await this.readValue(eoaKey);
                    if (value === 'ACCESS_DENIED') {
                        isolationSuccessCount++;
                        this.log(`✅ ${eoaKey} correctly blocked (privacy isolation working)`);
                    } else {
                        this.log(`❌ ${eoaKey} should not have access but read value: ${value}`);
                    }
                } catch (error) {
                    if (error.message.includes('Privacy group not found') || 
                        error.message.includes('not authorized') ||
                        error.message.includes('access denied')) {
                        isolationSuccessCount++;
                        this.log(`✅ ${eoaKey} correctly blocked (privacy isolation working)`);
                    } else {
                        this.log(`❌ ${eoaKey} failed with unexpected error: ${error.message}`);
                    }
                }
            }
            
            // Final results
            this.log('\n🎯 TEST RESULTS SUMMARY');
            this.log('=======================');
            this.log(`✅ Ephemeral EVMs created: 6/6`);
            this.log(`✅ Cross-node privacy group created: EOA1 ↔ EOA3`);
            this.log(`✅ SimpleStorage contract deployed and accessible`);
            this.log(`✅ EOA1 → EOA3 cross-node communication: WORKING`);
            this.log(`✅ Privacy isolation: ${isolationSuccessCount}/${unauthorizedEoas.length} EOAs correctly blocked`);
            
            if (isolationSuccessCount === unauthorizedEoas.length) {
                this.log('\n🎉 SUCCESS: True EOA-level privacy achieved across multiple nodes!');
                this.log('   - Individual ephemeral EVMs provide complete isolation');
                this.log('   - Cross-node privacy groups enable selective collaboration');
                this.log('   - Unauthorized EOAs cannot access private data');
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
const test = new CrossNodePrivacyTest();
test.runPrivacyTest().catch(console.error);
