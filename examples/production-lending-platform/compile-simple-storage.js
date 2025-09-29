const solc = require('solc');
const fs = require('fs');
const path = require('path');

function compileSimpleStorage() {
    // Read the Solidity source code
    const contractPath = path.join(__dirname, 'contracts', 'SimpleStorageNoParams.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    // Solidity compiler input
    const input = {
        language: 'Solidity',
        sources: {
            'SimpleStorageNoParams.sol': {
                content: source,
            },
        },
        settings: {
            outputSelection: {
                '*': {
                    '*': ['*'],
                },
            },
        },
    };

    // Compile the contract
    const output = JSON.parse(solc.compile(JSON.stringify(input)));

    // Check for compilation errors
    if (output.errors) {
        output.errors.forEach(err => {
            if (err.severity === 'error') {
                console.error('Compilation error:', err.formattedMessage);
            }
        });
    }

    // Extract the compiled contract
    const contract = output.contracts['SimpleStorageNoParams.sol']['SimpleStorage'];
    
    if (!contract) {
        console.error('Contract compilation failed');
        return;
    }
    
    // Create the ABI and bytecode JSON
    const compiledContract = {
        abi: contract.abi,
        bytecode: '0x' + contract.evm.bytecode.object
    };

    console.log('SimpleStorage ABI:');
    console.log(JSON.stringify(contract.abi, null, 2));
    
    console.log('\nSimpleStorage Bytecode:');
    console.log(compiledContract.bytecode);

    // Save to file
    const outputPath = path.join(__dirname, 'abis', 'SimpleStorageNoParams.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(compiledContract, null, 2));
    
    console.log(`\nContract saved to: ${outputPath}`);
}

// Run compilation
compileSimpleStorage();
