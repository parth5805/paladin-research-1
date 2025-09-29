// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract RealLendingContract {
    address public lender;
    address public borrower;
    uint256 public loanAmount;
    uint256 public interestRate;
    uint256 public creationTime;
    bool public loanFunded;
    uint256 public totalPaid;
    bool public initialized;
    
    event LoanCreated(uint256 amount, uint256 rate, uint256 timestamp);
    event LoanFunded(uint256 timestamp);
    event PaymentMade(uint256 amount, uint256 timestamp);
    
    constructor() {
        // Simple constructor without parameters
        creationTime = block.timestamp;
        loanFunded = false;
        totalPaid = 0;
        initialized = false;
    }
    
    function initializeLoan(
        address _lender,
        address _borrower,
        uint256 _loanAmount,
        uint256 _interestRate
    ) external {
        require(!initialized, "Already initialized");
        lender = _lender;
        borrower = _borrower;
        loanAmount = _loanAmount;
        interestRate = _interestRate;
        initialized = true;
        
        emit LoanCreated(_loanAmount, _interestRate, block.timestamp);
    }
    
    function fundLoan() external {
        require(initialized, "Not initialized");
        require(msg.sender == lender, "Only lender can fund");
        require(!loanFunded, "Already funded");
        loanFunded = true;
        emit LoanFunded(block.timestamp);
    }
    
    function makePayment(uint256 amount) external {
        require(initialized, "Not initialized");
        require(msg.sender == borrower, "Only borrower can pay");
        require(loanFunded, "Loan not funded yet");
        totalPaid += amount;
        emit PaymentMade(amount, block.timestamp);
    }
    
    function getLoanDetails() external view returns (
        uint256, uint256, bool, uint256, uint256, bool
    ) {
        return (loanAmount, interestRate, loanFunded, creationTime, totalPaid, initialized);
    }
    
    function getCurrentTimestamp() external view returns (uint256) {
        return block.timestamp;
    }
}
