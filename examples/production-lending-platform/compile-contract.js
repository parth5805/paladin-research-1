const solc = require('solc');
const fs = require('fs');
const path = require('path');

function compileContract() {
    // Read the Solidity source code
    const contractPath = path.join(__dirname, 'src', 'contracts', 'RealLendingContract.sol');
    const source = fs.readFileSync(contractPath, 'utf8');

    // Solidity compiler input
    const input = {
        language: 'Solidity',
        sources: {
            'RealLendingContract.sol': {
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
        output.errors.forEach((error) => {
            if (error.severity === 'error') {
                console.error('Compilation error:', error.formattedMessage);
                process.exit(1);
            } else {
                console.warn('Warning:', error.formattedMessage);
            }
        });
    }

    // Extract the compiled contract
    const contract = output.contracts['RealLendingContract.sol']['RealLendingContract'];
    
    // Create the ABI and bytecode JSON
    const compiledContract = {
        abi: contract.abi,
        bytecode: '0x' + contract.evm.bytecode.object
    };

    // Save to file
    const outputPath = path.join(__dirname, 'abis', 'RealLendingContract.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(compiledContract, null, 2));

    console.log('✅ Contract compiled successfully!');
    console.log(`📄 ABI and bytecode saved to: ${outputPath}`);
    
    return compiledContract;
}

// Run compilation
compileContract();
