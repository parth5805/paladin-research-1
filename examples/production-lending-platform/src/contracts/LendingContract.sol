// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title LendingContract
 * @dev Production-ready lending contract for ephemeral privacy groups
 * 
 * This contract implements the Paladin CEO's vision:
 * "Each deal gets its own ephemeral EVM - like AWS Lambda"
 * 
 * Features:
 * - Complete 1:1 privacy between lender and borrower
 * - Automatic interest calculation
 * - Collateral management
 * - Repayment tracking
 * - Default handling
 */
contract LendingContract {
    
    struct LoanTerms {
        address lender;
        address borrower;
        uint256 principal;           // Loan amount in wei
        uint256 interestRate;        // Annual interest rate (basis points: 500 = 5%)
        uint256 duration;            // Loan duration in seconds
        uint256 collateralAmount;    // Required collateral in wei
        bool collateralRequired;     // Whether collateral is required
    }
    
    struct LoanState {
        uint256 startTime;
        uint256 amountPaid;
        uint256 collateralDeposited;
        bool isActive;
        bool isDefaulted;
        bool isCompleted;
    }
    
    // Storage
    LoanTerms public loanTerms;
    LoanState public loanState;
    
    // Events for tracking (visible only within this ephemeral EVM)
    event LoanCreated(address indexed lender, address indexed borrower, uint256 principal);
    event CollateralDeposited(address indexed borrower, uint256 amount);
    event PaymentMade(address indexed borrower, uint256 amount, uint256 remaining);
    event LoanCompleted(address indexed borrower, uint256 totalPaid);
    event LoanDefaulted(address indexed borrower, uint256 amountOwed);
    event CollateralClaimed(address indexed lender, uint256 amount);
    
    modifier onlyLender() {
        require(msg.sender == loanTerms.lender, "Only lender can call this");
        _;
    }
    
    modifier onlyBorrower() {
        require(msg.sender == loanTerms.borrower, "Only borrower can call this");
        _;
    }
    
    modifier loanActive() {
        require(loanState.isActive, "Loan is not active");
        require(!loanState.isDefaulted, "Loan is defaulted");
        require(!loanState.isCompleted, "Loan is completed");
        _;
    }
    
    /**
     * @dev Initialize the loan with terms
     * This happens when the ephemeral EVM is created for this specific deal
     */
    function initializeLoan(
        address _lender,
        address _borrower,
        uint256 _principal,
        uint256 _interestRate,
        uint256 _duration,
        uint256 _collateralAmount,
        bool _collateralRequired
    ) external {
        require(loanTerms.lender == address(0), "Loan already initialized");
        require(_lender != address(0) && _borrower != address(0), "Invalid addresses");
        require(_principal > 0, "Principal must be greater than 0");
        require(_interestRate <= 10000, "Interest rate too high"); // Max 100%
        require(_duration > 0, "Duration must be greater than 0");
        
        loanTerms = LoanTerms({
            lender: _lender,
            borrower: _borrower,
            principal: _principal,
            interestRate: _interestRate,
            duration: _duration,
            collateralAmount: _collateralAmount,
            collateralRequired: _collateralRequired
        });
        
        loanState = LoanState({
            startTime: 0,
            amountPaid: 0,
            collateralDeposited: 0,
            isActive: false,
            isDefaulted: false,
            isCompleted: false
        });
        
        emit LoanCreated(_lender, _borrower, _principal);
    }
    
    /**
     * @dev Borrower deposits collateral if required
     */
    function depositCollateral() external payable onlyBorrower {
        require(loanTerms.collateralRequired, "Collateral not required");
        require(!loanState.isActive, "Loan already active");
        require(msg.value >= loanTerms.collateralAmount, "Insufficient collateral");
        
        loanState.collateralDeposited = msg.value;
        emit CollateralDeposited(msg.sender, msg.value);
    }
    
    /**
     * @dev Lender funds the loan to activate it
     */
    function fundLoan() external payable onlyLender {
        require(!loanState.isActive, "Loan already active");
        require(msg.value >= loanTerms.principal, "Insufficient funding");
        
        if (loanTerms.collateralRequired) {
            require(loanState.collateralDeposited >= loanTerms.collateralAmount, "Collateral not deposited");
        }
        
        loanState.isActive = true;
        loanState.startTime = block.timestamp;
        
        // Transfer principal to borrower
        payable(loanTerms.borrower).transfer(loanTerms.principal);
        
        // Return excess funding to lender
        if (msg.value > loanTerms.principal) {
            payable(loanTerms.lender).transfer(msg.value - loanTerms.principal);
        }
    }
    
    /**
     * @dev Calculate total amount owed including interest
     */
    function calculateAmountOwed() public view returns (uint256) {
        if (!loanState.isActive) return 0;
        
        uint256 timeElapsed = block.timestamp - loanState.startTime;
        uint256 annualInterest = (loanTerms.principal * loanTerms.interestRate) / 10000;
        uint256 interestAccrued = (annualInterest * timeElapsed) / (365 days);
        
        return loanTerms.principal + interestAccrued - loanState.amountPaid;
    }
    
    /**
     * @dev Borrower makes a payment
     */
    function makePayment() external payable onlyBorrower loanActive {
        require(msg.value > 0, "Payment must be greater than 0");
        
        loanState.amountPaid += msg.value;
        uint256 amountOwed = calculateAmountOwed();
        
        // Transfer payment to lender
        payable(loanTerms.lender).transfer(msg.value);
        
        emit PaymentMade(msg.sender, msg.value, amountOwed);
        
        // Check if loan is fully paid
        if (amountOwed == 0) {
            loanState.isCompleted = true;
            loanState.isActive = false;
            
            // Return collateral if applicable
            if (loanState.collateralDeposited > 0) {
                payable(loanTerms.borrower).transfer(loanState.collateralDeposited);
                loanState.collateralDeposited = 0;
            }
            
            emit LoanCompleted(msg.sender, loanState.amountPaid);
        }
    }
    
    /**
     * @dev Check if loan is in default
     */
    function isInDefault() public view returns (bool) {
        if (!loanState.isActive) return false;
        return block.timestamp > (loanState.startTime + loanTerms.duration);
    }
    
    /**
     * @dev Lender claims collateral if loan defaults
     */
    function claimCollateral() external onlyLender {
        require(isInDefault(), "Loan not in default");
        require(loanState.collateralDeposited > 0, "No collateral to claim");
        require(!loanState.isDefaulted, "Collateral already claimed");
        
        loanState.isDefaulted = true;
        loanState.isActive = false;
        
        uint256 collateralAmount = loanState.collateralDeposited;
        loanState.collateralDeposited = 0;
        
        payable(loanTerms.lender).transfer(collateralAmount);
        
        emit LoanDefaulted(loanTerms.borrower, calculateAmountOwed());
        emit CollateralClaimed(loanTerms.lender, collateralAmount);
    }
    
    /**
     * @dev Get loan details (read-only)
     */
    function getLoanDetails() external view returns (
        LoanTerms memory terms,
        LoanState memory state,
        uint256 amountOwed,
        bool inDefault
    ) {
        return (loanTerms, loanState, calculateAmountOwed(), isInDefault());
    }
    
    /**
     * @dev Emergency function to get contract balance
     */
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
