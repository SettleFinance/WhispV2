pragma solidity ^0.5.0;

import "./ERC20.sol";

contract TestToken is ERC20 {
  constructor(uint256 initialAmount) public ERC20() {
    _balances[msg.sender] = initialAmount;
  }
}
