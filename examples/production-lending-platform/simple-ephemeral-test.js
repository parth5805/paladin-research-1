#!/usr/bin/env node

/**
 * 🎯 SIMPLE EPHEMERAL EVM PRIVACY TEST (No Constructor Parameters)
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
 * - Deploy SimpleStorage contract (starts with value 0)
 * - EOA1 writes value from 0 to 1 in SimpleStorage contract
 * - EOA3 can read the value (should be 1)
 * - EOA2, EOA4, EOA5, EOA6 try to read/write but should FAIL (not in privacy group)
 */

const PaladinClient = require('@lfdecentralizedtrust-labs/paladin-sdk').default;

// Load the compiled contract 
const SimpleStorageContract = require('./abis/SimpleStorageNoParams.json');

class SimpleEphemeralEVMTest {
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
                name: `simple-privacy-group-${Date.now()}`,
                members: [this.eoas.eoa1.identity, this.eoas.eoa3.identity],
                description: 'Simple privacy group between EOA1 (NODE1) and EOA3 (NODE2)',
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
                
                // Wait a bit for the privacy group to be ready
                this.log('⏳ Waiting for privacy group to be ready...');
                await new Promise(resolve => setTimeout(resolve, 5000));
                
                return true;
            } else {
                throw new Error('Privacy group creation returned no ID');
            }
            
        } catch (error) {
            this.log(`❌ Failed to create privacy group: ${error.message}`);
            throw error;
        }
    }

    async step2_DeploySimpleStorage() {
        this.log('\n📋 STEP 2: Deploying SimpleStorage contract to ephemeral EVM');
        this.log('==========================================================');
        
        try {
            // Deploy using EOA1 (creator of the privacy group)
            // This follows the exact same pattern as privacy-storage example
            const deployTx = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: this.eoas.eoa1.identity,
                bytecode: SimpleStorageContract.bytecode,
                function: SimpleStorageContract.abi.find(item => item.type === 'constructor'),
                publicTxOptions: {
                    gas: '1000000'
                }
            };
            
            this.log(`Deploying SimpleStorage contract (starts with value 0)...`);
            
            const txId = await this.eoas.eoa1.client.pgroup.sendTransaction(deployTx);
            this.log(`📄 Deployment transaction sent: ${txId}`);
            
            // Wait for deployment to complete
            const receipt = await this.waitForTransaction(txId, this.eoas.eoa1.client);
            
            this.log(`📋 Receipt contents: ${JSON.stringify(receipt, null, 2)}`);
            
            if (receipt && receipt.success) {
                // For Pente deployments, the contract address is in the 'source' field
                if (receipt.source) {
                    this.contractAddress = receipt.source;
                    this.log(`✅ SimpleStorage contract deployed successfully!`);
                    this.log(`   Contract Address: ${this.contractAddress}`);
                    this.log(`   Initial Value: 0 (set by constructor)`);
                    return true;
                } else {
                    throw new Error('Contract deployment completed but no source address found in receipt');
                }
            } else {
                throw new Error('Contract deployment failed - transaction was not successful');
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
                function: SimpleStorageContract.abi.find(item => item.name === 'write'),
                input: [1],  // Write value 1 as array
                publicTxOptions: {
                    gas: '200000'
                }
            };
            
            this.log(`EOA1 writing value 1 to SimpleStorage contract...`);
            
            const txId = await this.eoas.eoa1.client.pgroup.sendTransaction(writeTx);
            this.log(`📝 Write transaction sent: ${txId}`);
            
            await this.waitForTransaction(txId, this.eoas.eoa1.client);
            
            this.log(`✅ EOA1 successfully wrote value 1 to the contract!`);
            
            // Verify the write worked by reading from EOA1 
            this.log('🔍 Verifying write worked by reading from EOA1...');
            const verifyReadCall = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: this.eoas.eoa1.identity,
                to: this.contractAddress,
                function: SimpleStorageContract.abi.find(item => item.name === 'read')
            };
            
            const readResult = await this.eoas.eoa1.client.pgroup.call(verifyReadCall);
            this.log(`📖 EOA1 reads back value: ${readResult}`);
            
            return true;
            
        } catch (error) {
            this.log(`❌ EOA1 failed to write value: ${error.message}`);
            throw error;
        }
    }

    async step4_EOA3ReadsValue() {
        this.log('\n📋 STEP 4: EOA3 reads value (should be 1)');
        this.log('=========================================');
        
        // Wait a bit more for contract to be available across nodes
        this.log('⏳ Waiting for contract to be available on NODE2...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        try {
            const readCall = {
                domain: 'pente',
                group: this.privacyGroupId,
                from: this.eoas.eoa3.identity,
                to: this.contractAddress,
                function: SimpleStorageContract.abi.find(item => item.name === 'read')
            };
            
            this.log(`EOA3 reading value from SimpleStorage contract...`);
            
            const result = await this.eoas.eoa3.client.pgroup.call(readCall);
            
            // Parse the result
            let value;
            if (typeof result === 'string' && result.startsWith('0x')) {
                value = parseInt(result, 16);
            } else if (Array.isArray(result) && result.length > 0) {
                value = parseInt(result[0], 10);
            } else if (typeof result === 'object' && result.value !== undefined) {
                value = parseInt(result.value, 10);
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
                function: SimpleStorageContract.abi.find(item => item.name === 'read')
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
                function: SimpleStorageContract.abi.find(item => item.name === 'write'),
                input: [999],  // Try to write value 999 as array
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
            'privacy group not found',
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
        
        const maxAttempts = 20;
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
        this.log('🚀 SIMPLE EPHEMERAL EVM PRIVACY TEST');
        this.log('====================================');
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

// Run the simple ephemeral EVM privacy test
const test = new SimpleEphemeralEVMTest();
test.runCompleteTest().catch(console.error);
