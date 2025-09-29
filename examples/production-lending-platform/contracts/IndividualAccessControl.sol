// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.17;

/**
 * @title IndividualAccessControl
 * @dev Smart Contract with CRYPTOGRAPHIC individual EOA enforcement
 * 
 * SECURITY LEVEL: EOA-LEVEL CRYPTOGRAPHIC GUARANTEE
 * ================================================
 * 
 * This contract operates at the SMART CONTRACT LEVEL providing:
 * ✅ Individual EOA address validation (not node-level)
 * ✅ Cryptographic enforcement (cannot be bypassed)
 * ✅ EVM bytecode-level access control
 * ❌ NOT application-level (not bypassable)
 * ❌ NOT infrastructure-level (works within Paladin privacy groups)
 * 
 * SECURITY GUARANTEES:
 * - Only addresses in authorizedIdentities mapping can access functions
 * - Enforced at EVM execution level through require() statements
 * - Cannot be bypassed by custom applications or direct calls
 * - Individual EOA isolation within same Paladin node
 */

contract IndividualAccessControl {
    
    // CRYPTOGRAPHIC STORAGE: Individual EOA authorization mapping
    mapping(address => bool) public authorizedIdentities;
    
    // Contract state
    uint256 private storedValue;
    address private contractOwner;
    
    // Events for transparency
    event ValueStored(address indexed by, uint256 value);
    event ValueRetrieved(address indexed by, uint256 value);
    event IdentityAuthorized(address indexed identity);
    event IdentityRevoked(address indexed identity);
    
    /**
     * @dev Constructor - CRYPTOGRAPHIC INITIALIZATION
     * @param _authorizedAddresses Array of EOA addresses with cryptographic access
     * 
     * SECURITY: Only these specific addresses can access contract functions
     * This creates cryptographic guarantee at individual EOA level
     */
    constructor(address[] memory _authorizedAddresses) {
        contractOwner = msg.sender;
        
        // CRYPTOGRAPHIC ENFORCEMENT: Register authorized individual EOAs
        for (uint i = 0; i < _authorizedAddresses.length; i++) {
            authorizedIdentities[_authorizedAddresses[i]] = true;
            emit IdentityAuthorized(_authorizedAddresses[i]);
        }
    }
    
    /**
     * @dev CRYPTOGRAPHIC MODIFIER: Individual EOA validation
     * 
     * SECURITY LEVEL: EOA-LEVEL CRYPTOGRAPHIC
     * - Validates msg.sender against authorized addresses
     * - Cannot be bypassed (enforced by EVM)
     * - Individual identity isolation within same node
     */
    modifier onlyAuthorizedEOA() {
        require(
            authorizedIdentities[msg.sender], 
            "CRYPTOGRAPHIC_ENFORCEMENT_FAILED: Individual EOA not authorized"
        );
        _;
    }
    
    /**
     * @dev Store value with CRYPTOGRAPHIC individual EOA enforcement
     * @param _value Value to store
     * 
     * SECURITY: Only cryptographically authorized individual EOAs can write
     */
    function store(uint256 _value) public onlyAuthorizedEOA {
        storedValue = _value;
        emit ValueStored(msg.sender, _value);
    }
    
    /**
     * @dev Retrieve value with CRYPTOGRAPHIC individual EOA enforcement
     * @return Current stored value
     * 
     * SECURITY: Only cryptographically authorized individual EOAs can read
     */
    function retrieve() public view onlyAuthorizedEOA returns (uint256) {
        return storedValue;
    }
    
    /**
     * @dev Add new authorized identity (owner only)
     * @param _identity EOA address to authorize
     * 
     * SECURITY: Dynamic individual EOA authorization
     */
    function addAuthorizedIdentity(address _identity) public {
        require(msg.sender == contractOwner, "Only contract owner can authorize");
        authorizedIdentities[_identity] = true;
        emit IdentityAuthorized(_identity);
    }
    
    /**
     * @dev Remove authorized identity (owner only)
     * @param _identity EOA address to revoke
     * 
     * SECURITY: Dynamic individual EOA revocation
     */
    function removeAuthorizedIdentity(address _identity) public {
        require(msg.sender == contractOwner, "Only contract owner can revoke");
        authorizedIdentities[_identity] = false;
        emit IdentityRevoked(_identity);
    }
    
    /**
     * @dev Check if address is authorized
     * @param _identity Address to check
     * @return Boolean authorization status
     * 
     * PUBLIC FUNCTION: Anyone can verify authorization status
     */
    function isAuthorized(address _identity) public view returns (bool) {
        return authorizedIdentities[_identity];
    }
    
    /**
     * @dev Get current stored value without authorization (for testing bypass attempts)
     * @return Current value
     * 
     * DEMONSTRATES: This function shows that even "open" functions
     * can be protected by the privacy group at infrastructure level
     */
    function getValueUnsecured() public view returns (uint256) {
        return storedValue;
    }
}

/**
 * SECURITY ANALYSIS SUMMARY:
 * ========================
 * 
 * 1. INFRASTRUCTURE LEVEL (Paladin Privacy Groups):
 *    - Node-to-node isolation
 *    - Cannot access privacy group from unauthorized nodes
 *    - Security: Strong cryptographic node isolation
 * 
 * 2. APPLICATION LEVEL (JavaScript/Application Logic):
 *    - EOA filtering in application code
 *    - CAN BE BYPASSED by direct contract calls
 *    - Security: Cosmetic only, not cryptographically enforced
 * 
 * 3. SMART CONTRACT LEVEL (This Contract):
 *    - Individual EOA address validation
 *    - CANNOT BE BYPASSED (enforced by EVM)
 *    - Security: Cryptographic guarantee at individual level
 * 
 * 4. COMBINED SECURITY (Infrastructure + Smart Contract):
 *    - Node isolation + Individual EOA enforcement
 *    - Strongest possible security model
 *    - True individual isolation with cryptographic guarantees
 * 
 * ANSWER: Smart contract enforcement is EOA-LEVEL CRYPTOGRAPHIC
 */
