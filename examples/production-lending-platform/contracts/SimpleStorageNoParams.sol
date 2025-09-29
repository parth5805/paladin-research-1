// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

/**
 * @title SimpleStorage - No Constructor Parameters
 * @dev A minimal contract for cross-node privacy testing with read/write functions
 */
contract SimpleStorage {
    // Single state variable for testing
    uint256 public storedData;

    // Event emitted when value changes
    event ValueChanged(uint256 newValue);

    /**
     * @dev Constructor with no parameters - initialize to 0
     */
    constructor() {
        storedData = 0;
        emit ValueChanged(0);
    }

    /**
     * @dev Write function - sets the value of the state variable
     * @param _value The new value to set
     */
    function write(uint256 _value) public {
        storedData = _value;
        emit ValueChanged(_value);
    }

    /**
     * @dev Read function - gets the current value of the state variable
     * @return The current stored value
     */
    function read() public view returns (uint256) {
        return storedData;
    }
}
