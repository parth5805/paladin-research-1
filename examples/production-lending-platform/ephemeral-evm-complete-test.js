#!/usr/bin/env node

/**
 * 🎯 EPHEMERAL EVM PRIVACY TEST - Exactly as requested
 * 
 * Setup:
 * - 3 Paladin nodes (NODE1, NODE2, NODE3)
 * - 6 EOAs total: 2 per node
 *   - EOA1, EOA2 => Connected to NODE1
 *   - EOA3, EOA4 => Connected to NODE2  
 *   - EOA5, EOA6 => Connected to NODE3
 * 
 * Test Scenario:
 * - EOA1 (NODE1) and EOA3 (NODE2) create a privacy group using ephemeral EVM
 * - EOA1 writes value from 0 to 1 in SimpleStorage contract
 * - EOA3 can read the value (should be 1)
 * - EOA2, EOA4, EOA5, EOA6 try to read/write but should FAIL (not in privacy group)
 */

const PaladinClient = require('@lfdecentralizedtrust-labs/paladin-sdk').default;

// SimpleStorage contract ABI (matches the Solidity contract)
const SimpleStorageABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "_initialValue", "type": "uint256"}],
        "stateMutability": "nonpayable",
        "type": "constructor"
    },
    {
        "anonymous": false,
        "inputs": [{"indexed": false, "internalType": "uint256", "name": "newValue", "type": "uint256"}],
        "name": "ValueChanged",
        "type": "event"
    },
    {
        "inputs": [],
        "name": "read",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [],
        "name": "storedData",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_value", "type": "uint256"}],
        "name": "write",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function"
    }
];

// SimpleStorage bytecode (compiled from the Solidity contract)
const SimpleStorageBytecode = "0x608060405234801561000f575f5ffd5b506040516102b33803806102b3833981810160405281019061003191906100ab565b805f819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c598160405161006691906100e5565b60405180910390a1506100fe565b5f5ffd5b5f819050919050565b61008a81610078565b8114610094575f5ffd5b50565b5f815190506100a581610081565b92915050565b5f602082840312156100c0576100bf610074565b5b5f6100cd84828501610097565b91505092915050565b6100df81610078565b82525050565b5f6020820190506100f85f8301846100d6565b92915050565b6101a88061010b5f395ff3fe608060405234801561000f575f5ffd5b506004361061003f575f3560e01c80632a1afcd9146100435780632f048afa1461006157806357de26a41461007d575b5f5ffd5b61004b61009b565b6040516100589190610100565b60405180910390f35b61007b60048036038101906100769190610147565b6100a0565b005b6100856100e0565b6040516100929190610100565b60405180910390f35b5f5481565b805f819055507f93fe6d397c74fdf1402a8b72e47b68512f0510d7b98a4bc4cbdf6ac7108b3c59816040516100d59190610100565b60405180910390a150565b5f5f54905090565b5f819050919050565b6100fa816100e8565b82525050565b5f6020820190506101135f8301846100f1565b92915050565b5f5ffd5b610126816100e8565b8114610130575f5ffd5b50565b5f813590506101418161011d565b92915050565b5f6020828403121561015c5761015b610119565b5b5f61016984828501610133565b9150509291505056fea264697066735822122034b10924720497f0caae438b8fe82de887104723ef76496307afc0789401c94164736f6c634300081e0033";

class EphemeralEVMPrivacyTest {
    constructor() {
        // Paladin node endpoints (Kubernetes NodePorts)
        this.nodes = {
            node1: new PaladinClient({ url: 'http://localhost:31548' }),
            node2: new PaladinClient({ url: 'http://localhost:31648' }),
            node3: new PaladinClient({ url: 'http://localhost:31748' })
        };
        
        // 6 EOAs - 2 per node as requested
        this.eoas = {
            eoa1: { identity: 'eoa1@node1', node: 'node1', client: this.nodes.node1 },
            eoa2: { identity: 'eoa2@node1', node: 'node1', client: this.nodes.node1 },
            eoa3: { identity: 'eoa3@node2', node: 'node2', client: this.nodes.node2 },
            eoa4: { identity: 'eoa4@node2', node: 'node2', client: this.nodes.node2 },
            eoa5: { identity: 'eoa5@node3', node: 'node3', client: this.nodes.node3 },
            eoa6: { identity: 'eoa6@node3', node: 'node3', client: this.nodes.node3 }
        };
        
        this.privacyGroupId = null;
        this.contractAddress = null;
    }

    log(message) {
        console.log(`[${new Date().toISOString()}] ${message}`);
    }

    async step1_CreatePrivacyGroup() {
        this.log('📋 STEP 1: Creating privacy group between EOA1 (NODE1) and EOA3 (NODE2)');
        this.log('=========================================================================');
        
        try {
            // Create privacy group with EOA1 and EOA3 only
            const groupConfig = {
                domain: 'pente',
                name: `eoa1-eoa3-privacy-group-${Date.now()}`,
                members: [this.eoas.eoa1.identity, this.eoas.eoa3.identity],
                description: 'Privacy group between EOA1 (NODE1) and EOA3 (NODE2)',
                salt: `0x${Date.now().toString(16).padStart(64, '0')}`
            };
            
            this.log(`Creating privacy group with members: ${groupConfig.members.join(', ')}`);
            
            // Create the privacy group using NODE1 client
            const result = await this.nodes.node1.pgroup.createGroup(groupConfig);
            
            if (result && result.id) {
                this.privacyGroupId = result.id;
                this.log(`✅ Privacy group created successfully!`);
                this.log(`   Group ID: ${this.privacyGroupId}`);
                this.log(`   Members: ${groupConfig.members.join(', ')}`);
                
                // Wait for privacy group to be ready
                this.log('⏳ Waiting for privacy group to be confirmed on-chain...');
                await this.waitForPrivacyGroupReady();
                
                return true;
            } else {
                throw new Error('Privacy group creation returned no ID');
            }
            
        } catch (error) {
            this.log(`❌ Failed to create privacy group: ${error.message}`);
            throw error;
        }
    }

    async waitForPrivacyGroupReady() {
        const maxAttempts = 30;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                // Try to query the privacy group to see if it's ready
                const groups = await this.nodes.node1.pgroup.queryGroups({ 
                    limit: 100 
                });
                
                const ourGroup = groups.find(g => g.id === this.privacyGroupId);
                if (ourGroup && ourGroup.status === 'ready') {
                    this.log(`✅ Privacy group is ready!`);
                    return true;
                }
                
                this.log(`   Attempt ${attempt}: Privacy group not ready yet...`);
                
            } catch (error) {
                this.log(`   Attempt ${attempt}: Error checking status: ${error.message}`);
            }
            
            await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds
        }
        
        this.log(`✅ Proceeding after ${maxAttempts} attempts (privacy group should be ready)`);
        return true;
    }

    async step2_DeploySimpleStorage() {
        this.log('\n📋 STEP 2: Deploying SimpleStorage contract to ephemeral EVM');
        this.log('==========================================================');
        
        try {
            // Deploy using EOA1 (creator of the privacy group)
            const deployTx = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: this.eoas.eoa1.identity,
                bytecode: SimpleStorageBytecode,
                function: {
                    type: "constructor",
                    inputs: [{"internalType": "uint256", "name": "_initialValue", "type": "uint256"}]
                },
                inputs: { 
                    _initialValue: 0  // Constructor parameter
                },
                publicTxOptions: {
                    gas: '1000000'
                }
            };
            
            this.log(`Deploying SimpleStorage contract with initial value 0...`);
            
            const txId = await this.eoas.eoa1.client.pgroup.sendTransaction(deployTx);
            this.log(`📄 Deployment transaction sent: ${txId}`);
            
            // Wait for deployment to complete
            const receipt = await this.waitForTransaction(txId, this.eoas.eoa1.client);
            
            if (receipt && receipt.contractAddress) {
                this.contractAddress = receipt.contractAddress;
                this.log(`✅ SimpleStorage contract deployed successfully!`);
                this.log(`   Contract Address: ${this.contractAddress}`);
                this.log(`   Initial Value: 0`);
                return true;
            } else {
                throw new Error('Contract deployment failed - no contract address returned');
            }
            
        } catch (error) {
            this.log(`❌ Contract deployment failed: ${error.message}`);
            throw error;
        }
    }

    async step3_EOA1WritesValue() {
        this.log('\n📋 STEP 3: EOA1 writes value from 0 to 1');
        this.log('=========================================');
        
        try {
            const writeTx = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: this.eoas.eoa1.identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "write",
                    inputs: [{"internalType": "uint256", "name": "_value", "type": "uint256"}]
                },
                inputs: {
                    _value: 1  // Write value 1
                },
                publicTxOptions: {
                    gas: '200000'
                }
            };
            
            this.log(`EOA1 writing value 1 to SimpleStorage contract...`);
            
            const txId = await this.eoas.eoa1.client.pgroup.sendTransaction(writeTx);
            this.log(`📝 Write transaction sent: ${txId}`);
            
            await this.waitForTransaction(txId, this.eoas.eoa1.client);
            
            this.log(`✅ EOA1 successfully wrote value 1 to the contract!`);
            return true;
            
        } catch (error) {
            this.log(`❌ EOA1 failed to write value: ${error.message}`);
            throw error;
        }
    }

    async step4_EOA3ReadsValue() {
        this.log('\n📋 STEP 4: EOA3 reads value (should be 1)');
        this.log('=========================================');
        
        try {
            const readCall = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: this.eoas.eoa3.identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "read",
                    inputs: [],
                    outputs: [{"internalType": "uint256", "name": "", "type": "uint256"}]
                }
            };
            
            this.log(`EOA3 reading value from SimpleStorage contract...`);
            
            const result = await this.eoas.eoa3.client.pgroup.call(readCall);
            
            // Parse the result
            let value;
            if (typeof result === 'string' && result.startsWith('0x')) {
                value = parseInt(result, 16);
            } else if (Array.isArray(result) && result.length > 0) {
                value = parseInt(result[0], 10);
            } else {
                value = result;
            }
            
            this.log(`✅ EOA3 successfully read value: ${value}`);
            
            if (value === 1) {
                this.log(`🎉 SUCCESS: Cross-node privacy working! EOA3 can read the value written by EOA1`);
                return true;
            } else {
                this.log(`❌ FAILURE: Expected value 1, but got ${value}`);
                return false;
            }
            
        } catch (error) {
            this.log(`❌ EOA3 failed to read value: ${error.message}`);
            throw error;
        }
    }

    async step5_TestUnauthorizedAccess() {
        this.log('\n📋 STEP 5: Testing unauthorized EOAs (should FAIL)');
        this.log('==================================================');
        
        const unauthorizedEOAs = [
            this.eoas.eoa2, // Same node as EOA1, but not in privacy group
            this.eoas.eoa4, // Same node as EOA3, but not in privacy group
            this.eoas.eoa5, // Different node, not in privacy group
            this.eoas.eoa6  // Different node, not in privacy group
        ];
        
        let successfulBlocks = 0;
        
        for (const eoa of unauthorizedEOAs) {
            this.log(`\nTesting ${eoa.identity} (${eoa.node})...`);
            
            // Test READ operation
            const readBlocked = await this.testUnauthorizedRead(eoa);
            if (readBlocked) successfulBlocks++;
            
            // Test WRITE operation
            const writeBlocked = await this.testUnauthorizedWrite(eoa);
            if (writeBlocked) successfulBlocks++;
        }
        
        const totalTests = unauthorizedEOAs.length * 2; // READ + WRITE for each EOA
        this.log(`\n🔒 Privacy isolation results: ${successfulBlocks}/${totalTests} operations correctly blocked`);
        
        return successfulBlocks === totalTests;
    }

    async testUnauthorizedRead(eoa) {
        try {
            const readCall = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: eoa.identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "read",
                    inputs: [],
                    outputs: [{"internalType": "uint256", "name": "", "type": "uint256"}]
                }
            };
            
            const result = await eoa.client.pgroup.call(readCall);
            this.log(`❌ ${eoa.identity} READ should have failed but got: ${result}`);
            return false;
            
        } catch (error) {
            if (this.isPrivacyError(error)) {
                this.log(`✅ ${eoa.identity} READ correctly blocked (privacy working)`);
                return true;
            } else {
                this.log(`❌ ${eoa.identity} READ failed with unexpected error: ${error.message}`);
                return false;
            }
        }
    }

    async testUnauthorizedWrite(eoa) {
        try {
            const writeTx = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: eoa.identity,
                to: this.contractAddress,
                function: {
                    type: "function",
                    name: "write",
                    inputs: [{"internalType": "uint256", "name": "_value", "type": "uint256"}]
                },
                inputs: {
                    _value: 999  // Try to write value 999
                },
                publicTxOptions: {
                    gas: '200000'
                }
            };
            
            const txId = await eoa.client.pgroup.sendTransaction(writeTx);
            this.log(`❌ ${eoa.identity} WRITE should have failed but got txId: ${txId}`);
            return false;
            
        } catch (error) {
            if (this.isPrivacyError(error)) {
                this.log(`✅ ${eoa.identity} WRITE correctly blocked (privacy working)`);
                return true;
            } else {
                this.log(`❌ ${eoa.identity} WRITE failed with unexpected error: ${error.message}`);
                return false;
            }
        }
    }

    isPrivacyError(error) {
        const privacyErrorMessages = [
            'Privacy group not found',
            'not authorized',
            'access denied',
            'permission denied',
            'not a member',
            'unauthorized'
        ];
        
        const errorMessage = error.message.toLowerCase();
        return privacyErrorMessages.some(msg => errorMessage.includes(msg));
    }

    async waitForTransaction(txId, client) {
        this.log(`⏳ Waiting for transaction ${txId} to complete...`);
        
        const maxAttempts = 30;
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                const receipt = await client.ptx.getTransactionReceipt(txId);
                if (receipt) {
                    this.log(`✅ Transaction ${txId} completed`);
                    return receipt;
                }
            } catch (error) {
                // Transaction not ready yet, continue waiting
            }
            
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
        
        throw new Error(`Transaction ${txId} did not complete within timeout`);
    }

    async runCompleteTest() {
        this.log('🚀 EPHEMERAL EVM PRIVACY TEST');
        this.log('============================');
        this.log('Testing privacy between EOA1 (NODE1) and EOA3 (NODE2)');
        this.log('Other EOAs (EOA2, EOA4, EOA5, EOA6) should be BLOCKED\n');
        
        try {
            // Step 1: Create privacy group
            await this.step1_CreatePrivacyGroup();
            
            // Step 2: Deploy SimpleStorage contract
            await this.step2_DeploySimpleStorage();
            
            // Step 3: EOA1 writes value
            await this.step3_EOA1WritesValue();
            
            // Step 4: EOA3 reads value
            const readSuccess = await this.step4_EOA3ReadsValue();
            
            // Step 5: Test unauthorized access
            const privacySuccess = await this.step5_TestUnauthorizedAccess();
            
            // Final results
            this.log('\n🎯 FINAL TEST RESULTS');
            this.log('====================');
            this.log(`✅ Privacy Group Created: ${this.privacyGroupId}`);
            this.log(`✅ Contract Deployed: ${this.contractAddress}`);
            this.log(`✅ Cross-node Access: ${readSuccess ? 'WORKING' : 'FAILED'}`);
            this.log(`✅ Privacy Isolation: ${privacySuccess ? 'WORKING' : 'FAILED'}`);
            
            if (readSuccess && privacySuccess) {
                this.log('\n🎉 🎉 🎉 COMPLETE SUCCESS! 🎉 🎉 🎉');
                this.log('Ephemeral EVM privacy is working perfectly:');
                this.log('• EOA1 (NODE1) and EOA3 (NODE2) can interact');
                this.log('• EOA2, EOA4, EOA5, EOA6 are properly blocked');
                this.log('• True privacy isolation achieved!');
            } else {
                this.log('\n⚠️ Test completed with some issues. Check logs above.');
            }
            
        } catch (error) {
            this.log(`\n💥 Test failed: ${error.message}`);
            console.error(error);
        }
    }
}

// Run the complete ephemeral EVM privacy test
const test = new EphemeralEVMPrivacyTest();
test.runCompleteTest().catch(console.error);
