const fetch = require('node-fetch');

async function makeRPCCall(endpoint, method, params) {
    const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: method,
            params: params,
            id: Date.now()
        })
    });
    
    const result = await response.json();
    return result;
}

async function deploySimpleContractNow() {
    console.log('\n🚨 LIVE DEPLOYMENT TEST - HAPPENING RIGHT NOW');
    console.log('===============================================');
    console.log(`⏰ Started at: ${new Date().toISOString()}`);
    
    try {
        // Use the exact same format as the working transactions
        const salt = '0x' + Date.now().toString(16).padStart(64, '0');
        console.log(`\n🔑 Using salt: ${salt}`);
        
        // Create privacy group with exact same format that works
        const result = await makeRPCCall('http://localhost:31548', 'ptx_sendTransaction', [{
            type: 'private',
            domain: 'pente',
            to: 'domains.pente.pgroupinit',
            function: '((bytes32,string[]),string,string,bool)',
            abiReference: '0xd878bfccea3e50ff0b6dd046262e2ddeea50ff7e7d3c39b06ad045ac517d784e',
            from: 'testbank@node1',
            data: {
                endorsementType: 'group_scoped_identities',
                evmVersion: 'shanghai',
                externalCallsEnabled: true,
                group: {
                    members: [
                        'testbank@node1',
                        'testborrower@node2'
                    ],
                    salt: salt
                }
            }
        }]);
        
        if (result.error) {
            console.error('❌ Failed:', result.error);
            return;
        }
        
        console.log(`✅ Transaction submitted: ${result.result}`);
        console.log(`⏰ Submitted at: ${new Date().toISOString()}`);
        
        // Wait and check the receipt
        console.log('\n⏳ Waiting 10 seconds for confirmation...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        
        const receipt = await makeRPCCall('http://localhost:31548', 'ptx_getTransactionReceipt', [result.result]);
        
        if (receipt.result) {
            console.log('\n🎉 CONFIRMED - THIS IS REAL!');
            console.log('============================');
            console.log(`✅ Block Number: ${receipt.result.blockNumber}`);
            console.log(`✅ Transaction Hash: ${receipt.result.transactionHash}`);
            console.log(`✅ Contract Address: ${receipt.result.contractAddress}`);
            console.log(`⏰ Confirmed at: ${new Date().toISOString()}`);
            console.log(`\n🔍 You can verify this in UI at: http://localhost:31548/ui`);
        } else {
            console.log('\n⏳ Still pending, but transaction was submitted successfully');
            console.log(`Transaction ID: ${result.result}`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

deploySimpleContractNow();
