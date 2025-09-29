/**
 * @file ContractABIs.ts
 * @description Contract ABIs and bytecode for deployment
 */

// This would typically be generated from the compiled Solidity contract
// For demo purposes, using a simplified version
export const LendingContractABI = {
  abi: [
    {
      "inputs": [
        {"name": "_lender", "type": "address"},
        {"name": "_borrower", "type": "address"},
        {"name": "_principal", "type": "uint256"},
        {"name": "_interestRate", "type": "uint256"},
        {"name": "_duration", "type": "uint256"},
        {"name": "_collateralAmount", "type": "uint256"},
        {"name": "_collateralRequired", "type": "bool"}
      ],
      "name": "initializeLoan",
      "outputs": [],
      "stateMutability": "nonpayable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "getLoanDetails",
      "outputs": [
        {"name": "terms", "type": "tuple"},
        {"name": "state", "type": "tuple"},
        {"name": "amountOwed", "type": "uint256"},
        {"name": "inDefault", "type": "bool"}
      ],
      "stateMutability": "view",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "makePayment",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "fundLoan",
      "outputs": [],
      "stateMutability": "payable",
      "type": "function"
    },
    {
      "inputs": [],
      "name": "calculateAmountOwed",
      "outputs": [{"name": "", "type": "uint256"}],
      "stateMutability": "view",
      "type": "function"
    }
  ],
  bytecode: "0x608060405234801561001057600080fd5b50..." // Truncated for brevity
};
