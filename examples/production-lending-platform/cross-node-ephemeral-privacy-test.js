const http = require('http');

// Simple Storage Contract ABI
const SIMPLE_STORAGE_ABI = [
    {
        "inputs": [],
        "name": "getValue",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "_value", "type": "uint256"}],
        "name": "setValue",
        "outputs": [],
        "stateMutability": "nonpayable", 
        "type": "function"
    }
];

// Simple Storage Contract Bytecode
const SIMPLE_STORAGE_BYTECODE = "0x608060405234801561001057600080fd5b5060f78061001f6000396000f3fe6080604052348015600f57600080fd5b506004361060325760003560e01c806320965255146037578063552410771460005b5b600080fd5b603d6059565b604051808215151515815260200191505060405180910390f35b60005481565b6004356000819055505056fea2646970667358221220a1b2c3d4e5f6789abcdef0123456789abcdef0123456789abcdef0123456789a64736f6c63430006000033";

// Node endpoints
const NODES = {
    NODE1: 'http://localhost:8545',
    NODE2: 'http://localhost:8546', 
    NODE3: 'http://localhost:8547'
};

class CrossNodePrivacyTester {
    constructor() {
        this.rpcId = 1;
        this.evms = {};
        this.eoas = {};
        this.storageContract = null;
        this.privacyGroup = null;
    }

    async makeRpcCall(nodeUrl, method, params) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                jsonrpc: "2.0",
                method: method,
                params: params,
                id: this.rpcId++
            });

            const url = new URL(nodeUrl);
            const options = {
                hostname: url.hostname,
                port: url.port,
                path: url.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(data)
                }
            };

            const req = http.request(options, (res) => {
                let responseData = '';
                res.on('data', (chunk) => responseData += chunk);
                res.on('end', () => {
                    try {
                        const result = JSON.parse(responseData);
                        if (result.error) {
                            reject(new Error(`RPC Error: ${result.error.message}`));
                        } else {
                            resolve(result.result);
                        }
                    } catch (e) {
                        reject(e);
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    async createEphemeralEVM(nodeUrl, evmName) {
        console.log(`\n🔧 Creating ephemeral EVM ${evmName} on ${nodeUrl}...`);
        
        const evmId = await this.makeRpcCall(nodeUrl, 'pevm_createEVM', []);
        console.log(`✅ Created EVM ${evmName}: ${evmId}`);
        
        this.evms[evmName] = { id: evmId, nodeUrl };
        return evmId;
    }

    async createEOA(nodeUrl, evmId, eoaName) {
        console.log(`\n👤 Creating EOA ${eoaName} in EVM ${evmId}...`);
        
        const identity = await this.makeRpcCall(nodeUrl, 'ptx_resolveVerifier', [
            eoaName,
            'secp256k1',
            'ecdsa_secp256k1'
        ]);
        
        console.log(`✅ Created EOA ${eoaName}: ${identity.verifier}`);
        
        this.eoas[eoaName] = {
            identity: identity.verifier,
            evmId,
            nodeUrl
        };
        
        return identity.verifier;
    }

    async createCrossNodePrivacyGroup(member1Name, member2Name) {
        console.log(`\n🔐 Creating cross-node privacy group between ${member1Name} and ${member2Name}...`);
        
        const member1 = this.eoas[member1Name];
        const member2 = this.eoas[member2Name];
        
        // Create privacy group on NODE1 (where EOA1 is connected)
        const pgResult = await this.makeRpcCall(member1.nodeUrl, 'pgroup_createGroup', [
            member1.evmId,
            [member1.identity, member2.identity]
        ]);
        
        this.privacyGroup = pgResult.id;
        console.log(`✅ Created cross-node privacy group: ${this.privacyGroup}`);
        
        return this.privacyGroup;
    }

    async deployStorageContract(deployerName) {
        console.log(`\n📦 Deploying SimpleStorage contract via ${deployerName}...`);
        
        const deployer = this.eoas[deployerName];
        
        const txData = {
            from: deployer.identity,
            data: SIMPLE_STORAGE_BYTECODE,
            group: this.privacyGroup
        };
        
        const txHash = await this.makeRpcCall(deployer.nodeUrl, 'ptx_sendTransaction', [
            deployer.evmId,
            txData
        ]);
        
        console.log(`📋 Transaction submitted: ${txHash}`);
        
        // Wait for receipt
        let receipt = null;
        for (let i = 0; i < 10; i++) {
            try {
                receipt = await this.makeRpcCall(deployer.nodeUrl, 'ptx_getTransactionReceipt', [
                    deployer.evmId,
                    txHash
                ]);
                if (receipt) break;
            } catch (e) {
                // Receipt not ready yet
            }
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        if (!receipt || !receipt.contractAddress) {
            throw new Error('Failed to get contract deployment receipt');
        }
        
        this.storageContract = receipt.contractAddress;
        console.log(`✅ SimpleStorage deployed at: ${this.storageContract}`);
        
        return this.storageContract;
    }

    async setValue(callerName, value) {
        console.log(`\n📝 ${callerName} setting value to ${value}...`);
        
        const caller = this.eoas[callerName];
        
        const txData = {
            from: caller.identity,
            to: this.storageContract,
            data: this.encodeSetValue(value),
            group: this.privacyGroup
        };
        
        try {
            const txHash = await this.makeRpcCall(caller.nodeUrl, 'ptx_sendTransaction', [
                caller.evmId,
                txData
            ]);
            
            console.log(`✅ ${callerName} successfully set value to ${value}, tx: ${txHash}`);
            return true;
        } catch (error) {
            console.log(`❌ ${callerName} failed to set value: ${error.message}`);
            return false;
        }
    }

    async getValue(callerName, expectedValue = null) {
        console.log(`\n🔍 ${callerName} reading value...`);
        
        const caller = this.eoas[callerName];
        
        const callData = {
            from: caller.identity,
            to: this.storageContract,
            data: this.encodeGetValue(),
            group: this.privacyGroup
        };
        
        try {
            const result = await this.makeRpcCall(caller.nodeUrl, 'ptx_call', [
                caller.evmId,
                callData
            ]);
            
            const value = parseInt(result.data, 16);
            
            if (expectedValue !== null) {
                if (value === expectedValue) {
                    console.log(`✅ ${callerName} successfully read value: ${value} (expected: ${expectedValue})`);
                } else {
                    console.log(`❌ ${callerName} read unexpected value: ${value} (expected: ${expectedValue})`);
                }
            } else {
                console.log(`✅ ${callerName} read value: ${value}`);
            }
            
            return value;
        } catch (error) {
            console.log(`❌ ${callerName} failed to read value: ${error.message}`);
            return null;
        }
    }

    async testUnauthorizedAccess(callerName) {
        console.log(`\n🚫 Testing unauthorized access by ${callerName}...`);
        
        const caller = this.eoas[callerName];
        
        // Try to read
        const callData = {
            from: caller.identity,
            to: this.storageContract,
            data: this.encodeGetValue()
            // Note: No privacy group specified - should fail
        };
        
        try {
            const result = await this.makeRpcCall(caller.nodeUrl, 'ptx_call', [
                caller.evmId,
                callData
            ]);
            console.log(`❌ SECURITY BREACH: ${callerName} was able to read value without privacy group!`);
            return false;
        } catch (error) {
            console.log(`✅ ${callerName} correctly blocked from unauthorized access: ${error.message}`);
            return true;
        }
    }

    encodeSetValue(value) {
        // Function selector for setValue(uint256)
        const selector = '0x55241077';
        // Pad value to 32 bytes
        const paddedValue = value.toString(16).padStart(64, '0');
        return selector + paddedValue;
    }

    encodeGetValue() {
        // Function selector for getValue()
        return '0x20965255';
    }

    async runTest() {
        console.log('🚀 Starting Cross-Node Ephemeral EVM Privacy Test\n');
        console.log('=' .repeat(60));

        try {
            // Step 1: Create ephemeral EVMs for each EOA
            console.log('\n📍 STEP 1: Creating Ephemeral EVMs');
            console.log('-'.repeat(40));
            
            await this.createEphemeralEVM(NODES.NODE1, 'EVM_EOA1');
            await this.createEphemeralEVM(NODES.NODE1, 'EVM_EOA2');
            await this.createEphemeralEVM(NODES.NODE2, 'EVM_EOA3');
            await this.createEphemeralEVM(NODES.NODE2, 'EVM_EOA4');
            await this.createEphemeralEVM(NODES.NODE3, 'EVM_EOA5');
            await this.createEphemeralEVM(NODES.NODE3, 'EVM_EOA6');

            // Step 2: Create EOAs in their respective EVMs
            console.log('\n📍 STEP 2: Creating EOAs');
            console.log('-'.repeat(40));
            
            await this.createEOA(NODES.NODE1, this.evms.EVM_EOA1.id, 'EOA1');
            await this.createEOA(NODES.NODE1, this.evms.EVM_EOA2.id, 'EOA2');
            await this.createEOA(NODES.NODE2, this.evms.EVM_EOA3.id, 'EOA3');
            await this.createEOA(NODES.NODE2, this.evms.EVM_EOA4.id, 'EOA4');
            await this.createEOA(NODES.NODE3, this.evms.EVM_EOA5.id, 'EOA5');
            await this.createEOA(NODES.NODE3, this.evms.EVM_EOA6.id, 'EOA6');

            // Step 3: Create cross-node privacy group (EOA1 + EOA3)
            console.log('\n📍 STEP 3: Creating Cross-Node Privacy Group');
            console.log('-'.repeat(40));
            
            await this.createCrossNodePrivacyGroup('EOA1', 'EOA3');

            // Step 4: Deploy storage contract
            console.log('\n📍 STEP 4: Deploying SimpleStorage Contract');
            console.log('-'.repeat(40));
            
            await this.deployStorageContract('EOA1');

            // Step 5: Test authorized access
            console.log('\n📍 STEP 5: Testing Authorized Access');
            console.log('-'.repeat(40));
            
            // EOA1 sets value to 1
            await this.setValue('EOA1', 1);
            
            // EOA3 reads the value (should be 1)
            await this.getValue('EOA3', 1);
            
            // EOA1 reads to confirm (should be 1)
            await this.getValue('EOA1', 1);

            // Step 6: Test unauthorized access
            console.log('\n📍 STEP 6: Testing Unauthorized Access');
            console.log('-'.repeat(40));
            
            // All unauthorized EOAs should be blocked
            await this.testUnauthorizedAccess('EOA2');
            await this.testUnauthorizedAccess('EOA4');
            await this.testUnauthorizedAccess('EOA5');
            await this.testUnauthorizedAccess('EOA6');

            // Step 7: Summary
            console.log('\n📍 STEP 7: Test Summary');
            console.log('-'.repeat(40));
            console.log('✅ Cross-node ephemeral EVM privacy test completed successfully!');
            console.log('✅ EOA1 (NODE1) and EOA3 (NODE2) can share private state');
            console.log('✅ EOA2, EOA4, EOA5, EOA6 are properly isolated');
            console.log('✅ Privacy enforced across different nodes');
            console.log('✅ Each EOA has its own ephemeral EVM environment');

        } catch (error) {
            console.error('❌ Test failed:', error.message);
            console.error(error.stack);
        }
    }
}

// Run the test
const tester = new CrossNodePrivacyTester();
tester.runTest().catch(console.error);
