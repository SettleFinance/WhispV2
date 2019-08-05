# Whisp Smart Contract Audit
Audit prepared by Alex Towle [Github](https://github.com/jalextowle)

## Audit Report

### Scope

The `Multisend` contract in the `contracts/Multisend.sol` file. Additionally, the
`IERC20` contract and the `SafeMath` library, found in the `contracts/IERC20.sol`
and the `contracts/math/SafeMath.sol` files, were reviewed because the `Multisend`
contract uses both of these other contracts.

### Preliminary Checks

- [x] `truffle compile`
- [x] `truffle test`

### Findings

#### Fee Manipulation

There are several ways in which fee payment can be avoided.

1. Since deposits are batched, a user can break up a deposit into chunks of tokens
such that the amount is less than 10000. This will ensure that the amount of fees
needed to be paid are zero. This exploit works in general; however, the gas complexity
of exploiting this exploit scales in O(n), where n is the amount of tokens to deposit.

2. A special purpose "fee avoidance" contract can be created. This contract will meet
the standard ERC20 interface, and it will be a fairly normal token in most respects.
This contract will need to have some special functionality that will give it ownership
of another ERC20 contract. Then, the "fee avoidance" contract will represent each X
tokens of the other ERC20 contract by 1 token. A good "fee avoidance" contract will
set X to the value that a user would like to deposit into the multisend without paying
fees. Then the user will deposit 1 "fee avoidance" token instead of X of the ERC20 contract
that they actually want to send. Since 1 / 10000 == 0 in integer arithemtic, the owner
will pay no fees; however, the recipient will still be able to trustlessly receive their
X of the ERC20 token by using a special purpose "unwrapping" function in the "fee avoidance"
token.

### Optimizations

##### Calldata

One of the biggest costs that can be mitigated in using the `Multisend` contract
are calldata costs. Calldata costs are calculated as 4 gas for each clean byte of
calldata and 68 gas for each dirty byte of calldata. For each address that is sent
in uncompressed calldata, 12 bytes will be made up of cleaned calldata. This costs
48 gas to send. A technique that could be used to decrease the cost of calldata is
to send a compressed version of calldata that looks as follows:

\[ n + 1 \]\[ address_0 trimmed to 20 bytes \]\[ ... \]\[ address_n trimmed to 20 bytes \]

This calldata would replace any address segment of normal calldata, and then a function
(likely using inline-assembly) would be used to load the addresses onto the stack when
they need to be used.

Another optimization to be considered is the use of vanity addresses for recipients.
Vanity addresses are created when a user picks a string of L, L <= 20, bytes and then
generates a private key that will generate this ethereum address. Vanity addresses
with several leading zeros have the advantage of being cheaper to send in calldata
because of the difference in price for clean and dirty bytes of calldata.

##### Assembly

Implementing the functions that will be used a lot in inline-assembly will ensure that
they are as efficient as possible. Some of the function dispatch can also be done
in calldata, and can be a way to improve gas costs.

#### Amortized Optimizations

The following optimizations work well for contracts that will see a lot of use and
only need to be deployed once. These optimizations will increase the cost of deploying
the contract, but they will decrease the cost of transactions -- sometimes by a large
amount.

##### Loop Unrolling

Loop unrolling is the practice of replacing a loop with the indices that the loop would
have transversed. For example, the loop:

```
for (uint i = 0; i < 10; i++) {
    arr[i] += 10;
}
```

can be replaced with:

```
arr[0] += 10;
arr[1] += 10;
arr[2] += 10;
arr[3] += 10;
arr[4] += 10;
arr[5] += 10;
arr[6] += 10;
arr[7] += 10;
arr[8] += 10;
arr[9] += 10;
```

Despite the fact that these programs look equivalent, the second program will be more
efficient because it will not have branch instructions in the bytecode. This strategy
can be applied to all of the loops in the `Multisend` contract to make them more efficient,
so long as the loops will be used enough to make up for the deployment cost increase.

##### Function Inlining

Placing the code of a function inside of a calling function is an optimization that can
impactful because it cuts down on jump and stack manipulation opcodes that will be placed
in the bytecode. The more times the function is called (as is sometimes the case with
internal function calls), the more impactful this optimization becomes. This said, it will
always produce the better bytecode when done appropriately.
