// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title RealLendingContract
 * @dev Production-ready lending contract for ephemeral EVMs
 * @notice Implements CEO's vision of "mini private blockchains on-demand"
 */
contract RealLendingContract {
    
    // ============ STATE VARIABLES ============
    
    struct LoanTerms {
        uint256 principal;           // Loan amount in wei
        uint256 interestRate;        // Annual interest rate (basis points, e.g., 750 = 7.5%)
        uint256 duration;            // Loan duration in seconds
        uint256 startTime;           // When loan becomes active
        uint256 collateralAmount;    // Required collateral in wei
        address lender;              // Lender's address
        address borrower;            // Borrower's address
    }
    
    struct LoanState {
        bool isActive;               // Whether loan is currently active
        bool isFunded;               // Whether lender has funded the loan
        uint256 amountPaid;          // Total amount paid by borrower
        uint256 lastPaymentTime;     // Timestamp of last payment
        bool isDefaulted;            // Whether loan is in default
        bool isCompleted;            // Whether loan is fully paid
    }
    
    // ============ STORAGE ============
    
    LoanTerms public loanTerms;
    LoanState public loanState;
    
    // ============ EVENTS ============
    
    event LoanCreated(
        address indexed lender,
        address indexed borrower, 
        uint256 principal,
        uint256 interestRate,
        uint256 duration
    );
    
    event LoanFunded(address indexed lender, uint256 amount);
    event PaymentMade(address indexed borrower, uint256 amount);
    event LoanCompleted(address indexed borrower, uint256 totalPaid);
    event LoanDefaulted(address indexed borrower, uint256 unpaidAmount);
    event CollateralSeized(address indexed lender, uint256 amount);
    
    // ============ MODIFIERS ============
    
    modifier onlyLender() {
        require(msg.sender == loanTerms.lender, "Only lender can call this");
        _;
    }
    
    modifier onlyBorrower() {
        require(msg.sender == loanTerms.borrower, "Only borrower can call this");
        _;
    }
    
    modifier onlyParticipants() {
        require(
            msg.sender == loanTerms.lender || msg.sender == loanTerms.borrower,
            "Only loan participants can call this"
        );
        _;
    }
    
    modifier loanActive() {
        require(loanState.isActive && loanState.isFunded, "Loan is not active");
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    constructor(
        address _lender,
        address _borrower,
        uint256 _principal,
        uint256 _interestRate,
        uint256 _duration,
        uint256 _collateralAmount
    ) {
        require(_lender != address(0), "Invalid lender address");
        require(_borrower != address(0), "Invalid borrower address");
        require(_principal > 0, "Principal must be positive");
        require(_interestRate > 0, "Interest rate must be positive");
        require(_duration > 0, "Duration must be positive");
        
        loanTerms = LoanTerms({
            principal: _principal,
            interestRate: _interestRate,
            duration: _duration,
            startTime: 0, // Set when funded
            collateralAmount: _collateralAmount,
            lender: _lender,
            borrower: _borrower
        });
        
        loanState = LoanState({
            isActive: true,
            isFunded: false,
            amountPaid: 0,
            lastPaymentTime: 0,
            isDefaulted: false,
            isCompleted: false
        });
        
        emit LoanCreated(_lender, _borrower, _principal, _interestRate, _duration);
    }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @dev Lender funds the loan
     */
    function fundLoan() external payable onlyLender {
        require(!loanState.isFunded, "Loan already funded");
        require(msg.value == loanTerms.principal, "Must send exact principal amount");
        
        loanState.isFunded = true;
        loanTerms.startTime = block.timestamp;
        
        emit LoanFunded(msg.sender, msg.value);
    }
    
    /**
     * @dev Borrower provides collateral
     */
    function provideCollateral() external payable onlyBorrower {
        require(loanState.isFunded, "Loan must be funded first");
        require(msg.value >= loanTerms.collateralAmount, "Insufficient collateral");
    }
    
    /**
     * @dev Borrower withdraws loan principal
     */
    function withdrawPrincipal() external onlyBorrower loanActive {
        require(address(this).balance >= loanTerms.principal, "Insufficient contract balance");
        
        payable(loanTerms.borrower).transfer(loanTerms.principal);
    }
    
    /**
     * @dev Borrower makes a payment
     */
    function makePayment() external payable onlyBorrower loanActive {
        require(msg.value > 0, "Payment must be positive");
        require(!loanState.isCompleted, "Loan already completed");
        
        loanState.amountPaid += msg.value;
        loanState.lastPaymentTime = block.timestamp;
        
        uint256 totalOwed = calculateTotalOwed();
        
        if (loanState.amountPaid >= totalOwed) {
            loanState.isCompleted = true;
            loanState.isActive = false;
            
            // Return any overpayment
            if (loanState.amountPaid > totalOwed) {
                uint256 overpayment = loanState.amountPaid - totalOwed;
                payable(loanTerms.borrower).transfer(overpayment);
            }
            
            // Transfer final payment to lender
            payable(loanTerms.lender).transfer(totalOwed);
            
            // Return collateral to borrower
            if (address(this).balance > 0) {
                payable(loanTerms.borrower).transfer(address(this).balance);
            }
            
            emit LoanCompleted(loanTerms.borrower, totalOwed);
        } else {
            // Transfer payment to lender
            payable(loanTerms.lender).transfer(msg.value);
        }
        
        emit PaymentMade(msg.sender, msg.value);
    }
    
    /**
     * @dev Mark loan as defaulted (can be called by lender if borrower misses payments)
     */
    function markDefault() external onlyLender loanActive {
        require(block.timestamp > loanTerms.startTime + loanTerms.duration, "Loan not yet due");
        require(!loanState.isCompleted, "Loan already completed");
        
        loanState.isDefaulted = true;
        loanState.isActive = false;
        
        uint256 unpaidAmount = calculateTotalOwed() - loanState.amountPaid;
        
        // Seize collateral
        if (address(this).balance > 0) {
            payable(loanTerms.lender).transfer(address(this).balance);
            emit CollateralSeized(loanTerms.lender, address(this).balance);
        }
        
        emit LoanDefaulted(loanTerms.borrower, unpaidAmount);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @dev Calculate total amount owed (principal + interest)
     */
    function calculateTotalOwed() public view returns (uint256) {
        if (!loanState.isFunded) return 0;
        
        uint256 interest = (loanTerms.principal * loanTerms.interestRate) / 10000;
        return loanTerms.principal + interest;
    }
    
    /**
     * @dev Get remaining balance owed
     */
    function getRemainingBalance() external view returns (uint256) {
        uint256 totalOwed = calculateTotalOwed();
        if (loanState.amountPaid >= totalOwed) return 0;
        return totalOwed - loanState.amountPaid;
    }
    
    /**
     * @dev Check if loan is overdue
     */
    function isOverdue() external view returns (bool) {
        if (!loanState.isFunded || loanState.isCompleted) return false;
        return block.timestamp > loanTerms.startTime + loanTerms.duration;
    }
    
    /**
     * @dev Get loan details
     */
    function getLoanDetails() external view returns (
        LoanTerms memory terms,
        LoanState memory state,
        uint256 totalOwed,
        uint256 remainingBalance,
        bool overdue
    ) {
        terms = loanTerms;
        state = loanState;
        totalOwed = calculateTotalOwed();
        remainingBalance = totalOwed > loanState.amountPaid ? totalOwed - loanState.amountPaid : 0;
        overdue = this.isOverdue();
    }
    
    /**
     * @dev Emergency function for loan participants only
     */
    function emergencyWithdraw() external onlyParticipants {
        require(loanState.isDefaulted || loanState.isCompleted, "Loan still active");
        
        if (address(this).balance > 0) {
            payable(msg.sender).transfer(address(this).balance);
        }
    }
    
    // ============ RECEIVE FUNCTION ============
    
    receive() external payable {
        // Allow contract to receive ETH
    }
}
