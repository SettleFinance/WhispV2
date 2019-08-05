pragma solidity ^0.5.0;

import "./IERC20.sol";
import "./math/SafeMath.sol";

/**
* @title Multisend contract
* @dev Provides ability to send multiple ERC20 tokens and ether within one transaction
**/
contract Multisend {
  using SafeMath for uint256;

  address payable private _owner; // owner of the contract
  mapping(address => bool) public whitelist; //whitelisted contract address to transfer to
  uint private _fee; // amount in basis points to take from each deposit
  mapping(address => mapping(address => uint256)) public balances; // deposited token/ether balances


  /**
  * @param initialFee amount of fees taken per transaction in basis points
  **/
  constructor(uint256 initialFee) public {
    _owner = msg.sender;
    _fee = initialFee;
  }

  /**
  * @dev Deposit token into this contract to use for sending
  * @param tokenDepositAddress token contract addresses to deposit tokens from
  * @param tokenDepositAmount amount of tokens to deposit
  * @dev for ether transactions use address(0) as token contract address
  **/
  function deposit(address[] memory tokenDepositAddress, uint256[] memory tokenDepositAmount) public payable {
    require(tokenDepositAddress.length == tokenDepositAmount.length);
    // if any ether was sent
    if(msg.value != 0) {
      uint256 etherFee = msg.value.div(10000).mul(_fee); //calculate fee
      balances[msg.sender][address(0)] = balances[msg.sender][address(0)].add(msg.value.sub(etherFee));
      balances[address(this)][address(0)] = balances[address(this)][address(0)].add(etherFee);
    }
    for (uint i=0;i<tokenDepositAddress.length;i++) {
      require(whitelist[tokenDepositAddress[i]] == true, "token not whitelisted");
      uint256 tokenFee = tokenDepositAmount[i].div(10000).mul(_fee);
      IERC20(tokenDepositAddress[i]).transferFrom(msg.sender, address(this), tokenDepositAmount[i]);
      balances[msg.sender][tokenDepositAddress[i]] = balances[msg.sender][tokenDepositAddress[i]].add(tokenDepositAmount[i].sub(tokenFee));
      balances[address(this)][tokenDepositAddress[i]] = balances[address(this)][tokenDepositAddress[i]].add(tokenFee);
    }
  }

  /**
  * Send payment from the funds initially depositted
  * @param tokens token contract address to send payment
  * @param recipients addresses to send tokens to
  * @param amounts token amount being sent
  * @dev for ether payments use address(0)
  **/
  function sendPayment(address[] memory tokens, address payable[] memory recipients, uint256[] memory amounts) public payable returns (bool) {
    require(tokens.length == recipients.length);
    require(tokens.length == amounts.length);
    uint256 total_ether_amount = 0;
    for (uint i=0; i < recipients.length; i++) {
      if(tokens[i] != address(0)) {
        balances[msg.sender][tokens[i]] = balances[msg.sender][tokens[i]].sub(amounts[i]);
        IERC20(tokens[i]).transfer(recipients[i], amounts[i]);
      }
      else {
        total_ether_amount = total_ether_amount.add(amounts[i]);
        balances[msg.sender][address(0)] = balances[msg.sender][address(0)].sub(amounts[i]);
        recipients[i].transfer(amounts[i]);
      }
    }
  }

  /**
  * @dev calls deposit and send methods in one transaction
  **/
  function depositAndSendPayment(address[] calldata tokenDepositAddress, uint256[] calldata tokenDepositAmount, address[] calldata tokens, address payable[] calldata recipients, uint256[] calldata amounts) external payable returns (bool) {
      deposit(tokenDepositAddress, tokenDepositAmount);
      sendPayment(tokens, recipients, amounts);
  }

  /**
  * @dev Withdraw method to return tokens to original owner
  * @param tokenAddresses token contract address to withdraw from
  **/
  function withdrawTokens(address payable[] calldata tokenAddresses) external {
    for(uint i=0; i<tokenAddresses.length;i++) {
      uint balance = balances[msg.sender][tokenAddresses[i]];
      balances[msg.sender][tokenAddresses[i]] = 0;
      IERC20 ERC20 = IERC20(tokenAddresses[i]);
      ERC20.transfer(msg.sender, balance);
    }
  }

  // @dev Withdraw method to return ether to original owner
  function withdrawEther() external {
    uint balance = balances[msg.sender][address(0)];
    balances[msg.sender][address(0)] = 0;
    msg.sender.transfer(balance);
  }

  /*** CONSTANT METHODS **/

  /**
  * @param owner address to query balance of
  * @param token contract address to query
  * @return a uint256 balance of the given users token amount
  **/
  function getBalance(address owner, address token) external view returns (uint256) {
    return balances[owner][token];
  }

  /**
  * @dev returns the owner of the contract
  * @return address of this contracts owner
  **/
  function owner() external view returns (address) {
    return _owner;
  }

  /*** OWNER METHODS **/

  /**
  * @dev function that returns the token fees collected by the contract to the owner
  * @param tokenAddresses token contract addresses to withdraw from
  **/
  function ownerWithdrawTokens(address payable[] calldata tokenAddresses) external onlyOwner {
    for(uint i=0; i<tokenAddresses.length;i++) {
      uint balance = balances[address(this)][tokenAddresses[i]];
      balances[address(this)][tokenAddresses[i]] = 0;
      IERC20 ERC20 = IERC20(tokenAddresses[i]);
      ERC20.transfer(_owner, balance);
    }
  }

  // @dev function that returns the ether fees collected by the contract to the owner
  function ownerWithdrawEther() external onlyOwner {
    uint balance = balances[address(this)][address(0)];
    balances[address(this)][address(0)] = 0;
    _owner.transfer(balance);
  }

  /**
  * @dev whitelist a token address
  * @param contractAddress the address to be whitelisted
  */
  function whitelistAddress(address contractAddress) external onlyOwner {
    whitelist[contractAddress] = true;
  }

  /**
  * @dev method to transfer ownership to a new address
  * @param newOwner address of the new owner
  **/
  function transferOwnership(address payable newOwner) external onlyOwner {
    require(newOwner != address(0), "Owner address may not be set to zero address");
    _owner = newOwner;
  }

  modifier onlyOwner {
    require(msg.sender == _owner, "Sender is not owner of the contract");
    _;
  }
}
