/* eslint-disable no-undef */ // Avoid the linter considering truffle elements as undef.
const { BN, expectRevert } = require('openzeppelin-test-helpers')

const ERC20Seller = artifacts.require('ERC20Seller.sol')
const Token = artifacts.require('ERC20Mintable')

contract('ERC20Seller', function(accounts) {
  const seller = accounts[0]
  const buyer1 = accounts[1]
  const buyer2 = accounts[2]
  const other = accounts[3]
  const divisor = 1
  const supply = 1000000000 // 1e9.
  const MAX_ORDERS = 100

  const gasPrice = 5000000000

  let token
  let erc20Seller
  beforeEach('initialize the contract', async function() {
    token = await Token.new()

    erc20Seller = await ERC20Seller.new(token.address, divisor)

    await token.mint(seller, supply)
    // Only approve half of minted tokens to check that it's not possible to transfer more than approved amount.
    await token.approve(erc20Seller.address, supply / 2, { from: seller })
  })

  it('Should set the correct values in constructor', async () => {
    assert.equal(await erc20Seller.token(), token.address)
    assert.equal((await erc20Seller.divisor()).toNumber(), 1)
    assert.equal((await erc20Seller.MAX_ORDERS()).toNumber(), 100)
    assert.equal((await token.balanceOf(seller)).toNumber(), supply)
    assert.equal(
      (await token.allowance(seller, erc20Seller.address)).toNumber(),
      500000000
    )
  })

  it('Should set the correct values in the newly created order', async () => {
    await expectRevert(
      erc20Seller.addOrder(13242, 121, { from: other }),
      'Only the seller can perform this action.'
    )
    // Check that it's not possible to add more tokens than allowed.
    await expectRevert.unspecified(
      erc20Seller.addOrder(100, 500000001, { from: seller })
    )

    await erc20Seller.addOrder(100, 2000, { from: seller })
    let order = await erc20Seller.orders(0)
    assert.equal(
      order[0].toNumber(),
      100,
      'The first order has incorrect price'
    )
    assert.equal(
      order[1].toNumber(),
      2000,
      'The first order has incorrect amount'
    )

    let balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      999998000,
      'The seller has incorrect token balance after creating the first order'
    )
    let balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      2000,
      'The erc20Seller contract has incorrect token balance after creating the first order'
    )

    // Create and check the 2nd order for correct values just in case.
    await erc20Seller.addOrder(251, 800000, { from: seller })

    order = await erc20Seller.orders(1)
    assert.equal(
      order[0].toNumber(),
      251,
      'The second order has incorrect price'
    )
    assert.equal(
      order[1].toNumber(),
      800000,
      'The second order has incorrect amount'
    )

    balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      999198000,
      'The seller has incorrect token balance after creating the second order'
    )
    balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      802000,
      'The erc20Seller contract has incorrect token balance after creating the second order'
    )
  })

  it('Should correctly increase the amount of the order and update balances', async () => {
    await erc20Seller.addOrder(100, 2000, { from: seller })
    await expectRevert(
      erc20Seller.increaseAmount(0, 121, { from: other }),
      'Only the seller can perform this action.'
    )
    // Check that it's not possible to add more tokens than allowed.
    await expectRevert.unspecified(
      erc20Seller.increaseAmount(0, 499998001, { from: seller })
    )

    await erc20Seller.increaseAmount(0, 3000, { from: seller })
    const order = await erc20Seller.orders(0)
    assert.equal(
      order[0].toNumber(),
      100,
      'The price of the order should not change'
    )
    assert.equal(
      order[1].toNumber(),
      5000,
      'The order has incorrect amount after increase'
    )

    const balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      999995000,
      'The seller has incorrect token balance after increase'
    )
    const balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      5000,
      'The erc20Seller contract has incorrect token balance after increase'
    )
  })

  it('Should correctly decrease the amount of the order and update balances', async () => {
    await erc20Seller.addOrder(100, 2000, { from: seller })
    await expectRevert(
      erc20Seller.decreaseAmount(0, 3000, { from: other }),
      'Only the seller can perform this action.'
    )

    // Check with the amount that is higher than the amount in the order.
    await erc20Seller.decreaseAmount(0, 3000, { from: seller })
    let order = await erc20Seller.orders(0)
    assert.equal(
      order[0].toNumber(),
      100,
      'The price of the order should not change'
    )
    assert.equal(order[1].toNumber(), 0, 'The order should have 0 amount')

    let balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      supply,
      'The seller should have the full supply'
    )
    let balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      0,
      'The erc20Seller contract should have 0 amount'
    )

    await erc20Seller.increaseAmount(0, 1000, { from: seller })
    await erc20Seller.decreaseAmount(0, 100, { from: seller })

    order = await erc20Seller.orders(0)
    assert.equal(
      order[1].toNumber(),
      900,
      'Incorrect order amount after partial decrease'
    )

    balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      999999100,
      'Incorrect token balance of the seller after partial decrease'
    )
    balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      900,
      'Incorrect token balance of the contract after partial decrease'
    )
  })

  it('Should correctly remove the order', async () => {
    await erc20Seller.addOrder(100, 2000, { from: seller })
    await erc20Seller.addOrder(200, 4000, { from: seller })
    await erc20Seller.addOrder(300, 6000, { from: seller })

    await expectRevert(
      erc20Seller.removeOrder(1, { from: other }),
      'Only the seller can perform this action.'
    )

    await erc20Seller.removeOrder(1, { from: seller })
    // Check that the index swap is correct and the deleted order is replaced with the last one.
    const order = await erc20Seller.orders(1)
    assert.equal(order[0].toNumber(), 300, 'Incorrect price of the order')
    assert.equal(order[1].toNumber(), 6000, 'Incorrect amount of the order')

    let balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      999992000,
      'The seller shoud be reimbursed the amount of the first removed order'
    )
    let balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      8000,
      'Incorrect token balance of the contract after the first removal'
    )

    await erc20Seller.removeOrder(0, { from: seller })
    balanceSeller = await token.balanceOf(seller)
    assert.equal(
      balanceSeller.toNumber(),
      999994000,
      'The seller shoud be reimbursed the amount of the second removed order'
    )
    balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      6000,
      'Incorrect token balance of the contract after the second removal'
    )
  })

  it('Should correctly determine the cheapest order', async () => {
    await erc20Seller.addOrder(100, 2000, { from: seller })
    await erc20Seller.addOrder(9999, 4000, { from: seller })
    await erc20Seller.addOrder(10011, 10, { from: seller })
    await erc20Seller.addOrder(20, 300, { from: seller })
    await erc20Seller.addOrder(100, 4000, { from: seller })

    let orderID = (await erc20Seller.findCheapestOrder()).toNumber()
    assert.equal(
      orderID,
      3,
      'The cheapest order is determined incorrectly in the 1st round'
    )
    let order = await erc20Seller.orders(orderID)
    assert.equal(
      order[0].toNumber(),
      20,
      'Incorrect price of the cheapest order in the 1st round'
    )

    await erc20Seller.removeOrder(orderID, { from: seller })
    orderID = (await erc20Seller.findCheapestOrder()).toNumber()
    assert.equal(
      orderID,
      0,
      'The cheapest order is determined incorrectly in the 2nd round'
    )
    order = await erc20Seller.orders(orderID)
    assert.equal(
      order[0].toNumber(),
      100,
      'Incorrect price of the cheapest order in the 2nd round'
    )

    await erc20Seller.removeOrder(orderID, { from: seller })
    orderID = (await erc20Seller.findCheapestOrder()).toNumber()
    assert.equal(
      orderID,
      0,
      'The cheapest order is determined incorrectly in the 3rd round'
    )
    order = await erc20Seller.orders(orderID)
    assert.equal(
      order[0].toNumber(),
      100,
      'Incorrect price of the cheapest order in the 3rd round'
    )

    await erc20Seller.removeOrder(orderID, { from: seller })
    orderID = (await erc20Seller.findCheapestOrder()).toNumber()
    assert.equal(
      orderID,
      1,
      'The cheapest order is determined incorrectly in the 4th round'
    )
    order = await erc20Seller.orders(orderID)
    assert.equal(
      order[0].toNumber(),
      9999,
      'Incorrect price of the cheapest order in the 4th round'
    )

    await erc20Seller.removeOrder(orderID, { from: seller })
    orderID = (await erc20Seller.findCheapestOrder()).toNumber()
    assert.equal(
      orderID,
      0,
      'The cheapest order is determined incorrectly in the 5th round'
    )
    order = await erc20Seller.orders(orderID)
    assert.equal(
      order[0].toNumber(),
      10011,
      'Incorrect price of the cheapest order in the 5th round'
    )
  })

  it('Should correctly distribute funds and tokens when tokens are bought', async () => {
    await erc20Seller.addOrder(3000, 2000000, { from: seller })
    await erc20Seller.addOrder(1000, 1000000, { from: seller })
    await erc20Seller.addOrder(2000, 1000000, { from: seller })

    const oldETHBalanceSeller1 = await web3.eth.getBalance(seller)
    const oldETHBalanceBuyer1 = await web3.eth.getBalance(buyer1)

    let txBuy = await erc20Seller.sendTransaction({
      from: buyer1,
      gasPrice: gasPrice,
      value: 2e9
    })
    let txFee = txBuy.receipt.gasUsed * gasPrice

    // First check that the distribution is correct if there is not enough ETH to buy all tokens.
    const order2 = await erc20Seller.orders(1)
    assert.equal(order2[1].toNumber(), 0, 'The 2nd order should have 0 amount')
    let order3 = await erc20Seller.orders(2)
    assert.equal(
      order3[1].toNumber(),
      500000,
      'The 3rd order should have half of initial amount left'
    )
    const newETHBalanceSeller1 = await web3.eth.getBalance(seller)
    const newETHBalanceBuyer1 = await web3.eth.getBalance(buyer1)
    assert(
      new BN(newETHBalanceSeller1).eq(
        new BN(oldETHBalanceSeller1).add(new BN(2e9))
      ),
      'The seller was not paid correctly after the first buyer'
    )
    assert(
      new BN(newETHBalanceBuyer1).eq(
        new BN(oldETHBalanceBuyer1).sub(new BN(2e9)).sub(new BN(txFee))
      ),
      'The first buyer has incorrect ETH balance'
    )

    const tokenBalanceBuyer1 = await token.balanceOf(buyer1)
    assert.equal(
      tokenBalanceBuyer1.toNumber(),
      1500000,
      'The first buyer has incorrect token balance'
    )
    let tokenBalanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      tokenBalanceContract.toNumber(),
      2500000,
      'Incorrect token balance of the contract after the first buyer'
    )

    // Now check the distribution in the case where all tokens are bought.
    const oldETHBalanceBuyer2 = await web3.eth.getBalance(buyer2)

    // Deliberately overpay to check that reimbursement is correct.
    txBuy = await erc20Seller.sendTransaction({
      from: buyer2,
      gasPrice: gasPrice,
      value: 1e18
    })
    txFee = txBuy.receipt.gasUsed * gasPrice

    const order1 = await erc20Seller.orders(0)
    assert.equal(order1[1].toNumber(), 0, 'The 1st order should have 0 amount')
    order3 = await erc20Seller.orders(2)
    assert.equal(order3[1].toNumber(), 0, 'The 3rd order should have 0 amount')

    const newETHBalanceSeller2 = await web3.eth.getBalance(seller)
    const newETHBalanceBuyer2 = await web3.eth.getBalance(buyer2)
    assert(
      new BN(newETHBalanceSeller2).eq(
        new BN(newETHBalanceSeller1).add(new BN(7e9)) // The increase should be 3000 * 2000000 + 2000 * 500000 = 6e9 + 1e9 = 7e9.
      ),
      'The seller was not paid correctly after the second buyer'
    )
    assert(
      new BN(newETHBalanceBuyer2).eq(
        new BN(oldETHBalanceBuyer2).sub(new BN(7e9)).sub(new BN(txFee))
      ),
      'The second buyer has incorrect ETH balance'
    )

    const tokenBalanceBuyer2 = await token.balanceOf(buyer2)
    assert.equal(
      tokenBalanceBuyer2.toNumber(),
      2500000,
      'The second buyer has incorrect token balance'
    )
    tokenBalanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      tokenBalanceContract.toNumber(),
      0,
      'The token balance of the contract should be depleted'
    )
  })

  it('Should not buy tokens from orders with high max price', async () => {
    await erc20Seller.addOrder(3000, 2000000, { from: seller })
    await erc20Seller.addOrder(1000, 1000000, { from: seller })
    await erc20Seller.addOrder(2000, 1000000, { from: seller })

    await erc20Seller.buy(1999, { from: buyer1, value: 1e18 })

    const balanceBuyer = await token.balanceOf(buyer1)
    assert.equal(
      balanceBuyer.toNumber(),
      1000000,
      'The buyer has incorrect token balance'
    )
    const balanceContract = await token.balanceOf(erc20Seller.address)
    assert.equal(
      balanceContract.toNumber(),
      3000000,
      'Incorrect token balance of the contract'
    )

    const order1 = await erc20Seller.orders(0)
    assert.equal(
      order1[1].toNumber(),
      2000000,
      'The amount of the 1st order should stay the same'
    )
    const order2 = await erc20Seller.orders(1)
    assert.equal(order2[1].toNumber(), 0, 'The 2nd order should have 0 amount')
    const order3 = await erc20Seller.orders(2)
    assert.equal(
      order3[1].toNumber(),
      1000000,
      'The amount of the 3rd order should stay the same'
    )
  })

  it('Check that buying the max number of orders does not exceed the gas limit', async () => {
    for (let i = 0; i < MAX_ORDERS; i++)
      // Make all the prices differ though it's not crucal for the test.
      await erc20Seller.addOrder(1000 + i, 1, { from: seller })

    await expectRevert(
      erc20Seller.addOrder(100, 2000, { from: seller }),
      'The maximum number of orders should not have already been reached.'
    )

    await erc20Seller.sendTransaction({ from: buyer1, value: 1e18 })

    const balanceBuyer = await token.balanceOf(buyer1)
    assert.equal(
      balanceBuyer.toNumber(),
      100,
      'The buyer has incorrect token balance after buying all the orders'
    )
  })
})
