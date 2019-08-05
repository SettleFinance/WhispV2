const Multisend = artifacts.require("Multisend");
const TestToken = artifacts.require("TestToken");


const fees = 5;

contract('Multisend', (accounts) => {
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000"
  let multisend;
  let token1, token2, token3, token4;
  let owner = accounts[9];
  let employer = accounts[0];
  let employee1 = accounts[1];
  let employee2 = accounts[2];
  let employee3 = accounts[3];
  let employee4 = accounts[4];

  beforeEach(async() => {
    multisend = await Multisend.new(fees, {from: owner});
    token1 = await TestToken.new(web3.utils.toWei("1000"))
    token2 = await TestToken.new(web3.utils.toWei("1000"))
    token3 = await TestToken.new(web3.utils.toWei("1000"))
    token4 = await TestToken.new(web3.utils.toWei("1000"))

    await token1.approve(multisend.address, web3.utils.toWei("1000"))
    await token2.approve(multisend.address, web3.utils.toWei("1000"))
    await token3.approve(multisend.address, web3.utils.toWei("1000"))
    await token4.approve(multisend.address, web3.utils.toWei("1000"))
    await multisend.whitelistAddress(token1.address, {from: owner});
    await multisend.whitelistAddress(token2.address, {from: owner});
    await multisend.whitelistAddress(token3.address, {from: owner});
    await multisend.whitelistAddress(token4.address, {from: owner});
  });

  it("should have an owner", async() => {
    let _owner = await multisend.owner();
    assert.equal(owner, _owner);
  });

  it("should be able to transfer ownership", async() => {
    let _owner = await multisend.owner();
    assert.equal(_owner, owner);
    await multisend.transferOwnership(employee1, {from: owner});
    _owner = await multisend.owner();
    assert.equal(_owner, employee1);
  });

  it("should not allow non-owner to transfer ownership", async() => {
    let _owner = await multisend.owner();
    assert.equal(owner, owner);
    try {
      await multisend.transferOwnership(employee1, {from: employee1});
    } catch(e) {
      //noop
    }
    _owner = await multisend.owner();
    assert.equal(_owner, owner);
  });

  it("should not be able to transfer non-whitelisted address", async() => {
    let nonApprovedToken = await TestToken.new(web3.utils.toWei("1000"))
    await nonApprovedToken.approve(multisend.address, web3.utils.toWei("1000"))

    try {
      await multisend.depositAndSendPayment(
      [nonApprovedToken.address],
      [web3.utils.toWei("52")],
      [nonApprovedToken.address],
      [employee1],
      [web3.utils.toWei("50")], {from: employer});
      assert.equal(true, false);
    } catch(e) {
      assert.equal(true, true);
    }
  });

  it("should transfer one token to one person", async() =>  {
    let beginning_balance = await token1.balanceOf(employer);
    let allowance = await token1.allowance(employer, multisend.address);
    assert.deepEqual(allowance.toString(), web3.utils.toWei("1000"));
    assert.deepEqual(beginning_balance.toString(), web3.utils.toWei("1000"));

    await multisend.depositAndSendPayment(
          [token1.address],
          [web3.utils.toWei("52")],
          [token1.address],
          [employee1],
          [web3.utils.toWei("50")], {from: employer});

    let employer_balance = await token1.balanceOf(employer);
    let employee_balance = await token1.balanceOf(employee1);

    let contract_fee_balance = await multisend.getBalance(multisend.address, token1.address);
    assert.equal(+contract_fee_balance, +web3.utils.toWei((52/10000*fees).toString()));
    assert.deepEqual(+employer_balance, +web3.utils.toWei("948"));
    assert.deepEqual(+employee_balance, +web3.utils.toWei("50"));
  });

  it("should transfer ether to one person", async() =>  {
    let beginning_employee_balance = await web3.eth.getBalance(employee1);

    await multisend.depositAndSendPayment(
      [],
      [],
      [ZERO_ADDRESS],
      [employee1],
      [web3.utils.toWei(".5")], {from: employer, value: web3.utils.toWei("1")});

    let employee_balance = await web3.eth.getBalance(employee1);

    assert.notDeepEqual(beginning_employee_balance, employee_balance);
    assert.equal(employee_balance, +beginning_employee_balance + +web3.utils.toWei(".5"));
  });

  it("should not be able to transfer more ether than has been sent", async() => {
    await multisend.deposit([], [], {value: 1000, from: employee1});
    try {
      await multisend.depositAndSendPayment([],[],[ZERO_ADDRESS],[employee1], ["50"], {from: employer, value: 20});
      throw null;
    } catch (e) {
      if (e == null) assert.equal(0, 1, "Transaction did not error");
      assert.isNotNull(e.message.match(/revert/), "Transaction did not revert");
    }
  });

  it("should transfer one token and ether to one person", async() =>  {
    let beginning_balance = await token1.balanceOf(employer);
    let beginning_ether_balance = await web3.eth.getBalance(employee1);

    assert.equal(+beginning_balance, web3.utils.toWei("1000"));

    await multisend.depositAndSendPayment(
        [token1.address],
        [web3.utils.toWei("51")],
        [token1.address, ZERO_ADDRESS],
        [employee1, employee1],
        [web3.utils.toWei("50"), web3.utils.toWei("1")],
        {from: employer, value: web3.utils.toWei("1.1")});

    let employer_balance = await token1.balanceOf(employer);
    let employee_balance = await token1.balanceOf(employee1)
    let employee_ether_balance = await web3.eth.getBalance(employee1);

    assert.deepEqual(employer_balance, web3.utils.toBN(web3.utils.toWei("949")));
    assert.deepEqual(employee_balance, web3.utils.toBN(web3.utils.toWei("50")));
    assert.equal(employee_ether_balance, +beginning_ether_balance + +web3.utils.toWei("1"));
  });

  it("should transfer two tokens to one person", async() =>  {
    let beginning_token_balance = await token1.balanceOf(employer);
    let beginning_token2_balance = await web3.eth.getBalance(employee1);

    await multisend.depositAndSendPayment(
        [token1.address, token2.address],
        [web3.utils.toWei("51"), web3.utils.toWei("51")],
        [token1.address, token2.address],
        [employee1, employee1],
        [web3.utils.toWei("50"), web3.utils.toWei("50")], {from: employer});

    let employer_token1_balance = await token1.balanceOf(employer);
    let employee_token1_balance = await token1.balanceOf(employee1);
    let employer_token2_balance = await token2.balanceOf(employer);
    let employee_token2_balance = await token2.balanceOf(employee1);

    assert.equal(+employer_token1_balance, web3.utils.toWei("949"));
    assert.equal(+employer_token2_balance, web3.utils.toWei("949"));
    assert.equal(+employee_token1_balance, web3.utils.toWei("50"));
    assert.equal(+employee_token2_balance, web3.utils.toWei("50"));
  });

  it("should transfer one tokens to multiple people", async() =>  {
    let beginning_token_balance = await token1.balanceOf(employer);
    let beginning_token2_balance = await web3.eth.getBalance(employee1);

    await multisend.depositAndSendPayment(
      [token1.address],
      [web3.utils.toWei("151")],
      [token1.address, token1.address, token1.address],
      [employee1, employee2, employee3],
      [web3.utils.toWei("50"), web3.utils.toWei("50"), web3.utils.toWei("50")], {from: employer});

    let employer_token1_balance = await token1.balanceOf(employer);
    let employee1_token1_balance = await token1.balanceOf(employee1);
    let employee2_token1_balance = await token1.balanceOf(employee2);
    let employee3_token1_balance = await token1.balanceOf(employee3);

    assert.equal(+employer_token1_balance, web3.utils.toWei("849"));
    assert.equal(+employee1_token1_balance, web3.utils.toWei("50"));
    assert.equal(+employee2_token1_balance, web3.utils.toWei("50"));
    assert.equal(+employee3_token1_balance, web3.utils.toWei("50"));
  });

  it("should transfer two tokens to multiple people", async() =>  {
    let beginning_token_balance = await token1.balanceOf(employer);
    let beginning_token2_balance = await web3.eth.getBalance(employee1);

    await multisend.depositAndSendPayment(
      [token1.address, token2.address],
      [web3.utils.toWei("101"), web3.utils.toWei("51")],
      [token1.address, token2.address, token1.address],
      [employee1, employee2, employee3],
      [web3.utils.toWei("50"), web3.utils.toWei("50"), web3.utils.toWei("50")],
      {from: employer});

    let employer_token1_balance = await token1.balanceOf(employer);
    let employer_token2_balance = await token2.balanceOf(employer);
    let employee1_token1_balance = await token1.balanceOf(employee1);
    let employee2_token2_balance = await token2.balanceOf(employee2);
    let employee3_token1_balance = await token1.balanceOf(employee3);

    assert.deepEqual(employer_token1_balance, web3.utils.toBN(web3.utils.toWei("899")));
    assert.deepEqual(employer_token2_balance, web3.utils.toBN(web3.utils.toWei("949")));
    assert.deepEqual(employee1_token1_balance, web3.utils.toBN(web3.utils.toWei("50")));
    assert.equal(+employee2_token2_balance, web3.utils.toWei("50"));
    assert.equal(+employee3_token1_balance, web3.utils.toWei("50"));
  });

  it("should transfer two tokens and ether to multiple people", async() =>  {
    let beginning_token_balance = await token1.balanceOf(employer);
    let beginning_token2_balance = await web3.eth.getBalance(employee1);

    await multisend.depositAndSendPayment(
            [token1.address],
            [web3.utils.toWei("151")],
            [token1.address, token1.address, token1.address],
            [employee1, employee2, employee3],
            [web3.utils.toWei("50"), web3.utils.toWei("50"), web3.utils.toWei("50")], {from: employer});

    let employer_token1_balance = await token1.balanceOf(employer);
    let employee1_token1_balance = await token1.balanceOf(employee1);
    let employee2_token2_balance = await token1.balanceOf(employee2);
    let employee3_token3_balance = await token1.balanceOf(employee3);;

    assert.equal(+employer_token1_balance, web3.utils.toWei("849"));
    assert.equal(+employee1_token1_balance, web3.utils.toWei("50"));
    assert.equal(+employee2_token2_balance, web3.utils.toWei("50"));
    assert.equal(+employee3_token3_balance, web3.utils.toWei("50"));
  });

  it("should be able to withdraw ether", async() => {
    let beginning_ether_balance = await web3.eth.getBalance(owner);

    let amount = web3.utils.toWei("10");
    await multisend.deposit([], [], {value: amount});
    let fees = getFee(10);
    let contract_balance = await multisend.getBalance(multisend.address, ZERO_ADDRESS);
    assert.deepEqual(+contract_balance, +web3.utils.toBN(fees));
    await multisend.ownerWithdrawEther({from: owner});

    contract_balance = await multisend.getBalance(multisend.address, ZERO_ADDRESS);
    assert.deepEqual(+contract_balance, +web3.utils.toBN(0));

    let owner_balance = await web3.eth.getBalance(owner);

    assert.isTrue(+owner_balance > +beginning_ether_balance);

  });

  it("should be able to withdraw token", async() => {
    let amount = web3.utils.toWei("10");
    await multisend.deposit([token1.address], [amount]);
    let fees = getFee(10);
    let contract_balance = await multisend.getBalance(multisend.address, token1.address);
    assert.deepEqual(+contract_balance, +web3.utils.toBN(fees));
    await multisend.ownerWithdrawTokens([token1.address], {from: owner});
    let owner_balance = await token1.balanceOf(owner);
    assert.deepEqual(owner_balance, web3.utils.toBN(fees));
  });

  it("should be able to sending multiple tokens", async() => {
    await multisend.depositAndSendPayment(
                                [token1.address],
                                [web3.utils.toWei("61")],
                                new Array(30).fill(token1.address),
                                new Array(30).fill(employee1),
                                new Array(30).fill(web3.utils.toWei("2")),
                                {from: employer});
  });

  async function depositToken(token, amount) {
    await multisend.deposit([token], [amount]);
  }

  function getFee(amount) {
    return web3.utils.toWei((amount/10000*fees).toString());
  }
});

