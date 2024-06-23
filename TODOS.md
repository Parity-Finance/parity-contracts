Authorities Model and Check implementation
~~Merkle Tree AllowList~~
~~Withdraw Deposit Funds from Vault~~
~~Refactor to set exchange rate decimals~~
~~Yield Rate can be updated~~
~~Make Staking xSold conversion work~~
~~Check for Max amount in Block~~

Create more helper function for package
-> Helper functions for all the different calculations (Calculations below)


Setup CI/CD Pipeline for testing and deployment

Different Circuit Breaks
Refactor to token2022
(Unstake timelock)
Settings timelock
~~Withdraw timelock~~
Update Owner two step function
Use signed numbers to ensure no overflow or underflow

Different Authority Types
Authorities same as Ethena
~~ Initialization of different authorities works ~~
~~Owner Update function for updating owner/admin/minter~~
~~Admin Update function for allowList/gate_keepers/mint&redeem_limit~~
~~Adjust withdraw and deposit function to be checked for admin~~
~~Adjust yield update function~~
~~Create update pool_manager instruction gated for owner~~
~~Pause functionality check for gatekeeper or admin~~

Tests
- ~~Pause Test~~
- ~~AllowList Test~~
- ~~AllowList update test~~
- ~~Check withdrawing works or doesn't work~~
- ~~Withdraw Deposit Controls~~
- ~~Different exchange_rate tests~~
- ~~Updated Staking Tests~~
- Authority Tests
- Extensive yield rate tests
- Test for Max amount per block
- Test for update metadata

---

Analytics necessary: (management reporting)

So that we see the business overview and some critical stats in real time.
The critical stats to have:
- Total supply of stablecoin (amount issued)
- Total stables staked
- % of stables staked
- The exchange rate of the staked Solana Dollar vs. Unstaked.
- Yield accrued, not paid.
- Total liabilities = stablecoins issued + yield accrued not paid.
- Current protocol yield offered to users (our protocol mode).
- Actual protocol yield last 24 hours, 7 days, 1month. (Which is change in the reserves).
- Total assets (i.e. reserves).
- Equity buffer as assets - liabilities.
- Solana Dollar secondary market exchange rate. 


- "Yield accrued, not paid."
-> This would be SOLD staked in pool x current sold-xsold exchange rate?


The yield accrued not paid is:

Staked SOLD x exchange rate - SOLD backing the xSold (we are locking it right; so minus the locked SOLD), so that we are left with just the yield component.


On the other 2:
Protocol yield and equity. 

Assuming all fees and other bits directly fall to the reserves, which I think they should for both operational and commercial reasons, then:

Protocol yield = change in reserves per unit of time

Equity = reserves - liabilities

Where 

Liabilities = total SOLD issued + yield accrued but not paid

---

Critical Bug:
Depositing 0 tokens or less than the other 