# Retirement Calculator Review

**Review date:** 2026-11-24
**Scope:** Active browser app loaded by `index.html`, with emphasis on retirement projections, tax calculations, and tax-related UI assumptions.  
**Result:** Added regression tests and fixed the major calculation defects listed as resolved below. The calculator remains an estimate, not tax or financial advice.

## Status update

The following original findings have been addressed: RMD timing and separation from Roth conversions; prior-year-end RMD basis; progressive Social Security taxation and spouse benefits; employer-match calculation; Medicare coverage-year schedules, projected MAGI lookback with a closest-year fallback, eligible people and partial coverage; and spouse-specific age-based standard deductions.

A second pass also fixed working-year cash-flow errors: Medicare premiums were not deducted from investment cash flow, and RMD cash could be omitted or counted inconsistently when salary cash flow already covered spending. Regression tests now cover these cases, FICA, ordinary income tax, and capital-gains bracket assumptions.

Still open or partial: brokerage gains/tax assumptions; the temporary senior deduction; early-distribution penalties; and RMD rules for users whose applicable starting age is not 75. The calculator intentionally fixes RMD age at 75. The first projection year's RMD uses the current entered balance because the prior December 31 balance is not collected. Current-year taxes remain approximate because year-to-date income and withholding are not entered.

The automated regression suite is run with `npm test`.

## Findings and current status

The descriptions under resolved findings record the original issue; the current behavior is summarized immediately below each heading.

### 1. High — RMDs are conditional on Roth conversion and are added to Roth — RESOLVED

**Locations:** `src/app.js:548-577`, `src/app.js:752-755`

RMDs are now modeled independently from Roth conversions, included in taxable income, and routed to spending or taxable investments rather than Roth.

The code calculates an RMD, but only applies it to distributions and taxable income inside `if (shouldConvert)`. If conversions are disabled (conversion bracket `0`) or have not started yet, the computed RMD is not distributed or taxed at all. If an RMD is larger than the planned conversion, the entire larger amount is added to `dist`, then added to the Roth balance. The UI itself says RMD money cannot be directly converted to Roth.

**Impact:** A plan with no conversions can show no RMD cash flow or tax; a plan with conversions can incorrectly inflate its Roth balance by treating mandatory cash distributions as Roth conversions.

**Suggested correction:** Model RMD as a distinct taxable distribution, independent of conversion settings. Satisfy the RMD before calculating any eligible conversion, and route the RMD amount to cash/investments or spending rather than to Roth.

### 2. High — RMD amount uses the current year's projected growth — RESOLVED WITH FIRST-YEAR LIMITATION

**Locations:** `src/app.js:475-486`, `src/app.js:548-552`

RMDs now use the prior projected year-end pretax balance. The first projection year uses the entered balance as a proxy because prior Dec. 31 balance is not collected.

The pretax balance is increased by the current year's return before the RMD is calculated. The Uniform Lifetime Table calculation should generally use the account balance on December 31 of the preceding year, divided by the applicable factor. Using a balance after the current-year return makes the modeled RMD too large (or too small for negative returns).

**Suggested correction:** Preserve the prior December 31 balance for the RMD calculation and keep current-year investment returns/distribution timing as a separate projection assumption.

### 3. High — Taxable Social Security is calculated as a flat percentage of all benefits — RESOLVED; INPUT LIMITATIONS REMAIN

**Locations:** `src/calculator.js:47-53`, called from `src/app.js:626-630`

The taxable-benefit helper now follows the progressive worksheet structure and caps the result at 85%. Joint households can enter each spouse's claim age and benefit. Tax-exempt interest is still not an input.

The implementation returns either 0%, 50%, or 85% of the entire benefit based on provisional-income cutoffs. The actual worksheet is progressive within the bands and limits the taxable amount to at most 85% of benefits. For example, with $24,000 of annual benefits and single provisional income of exactly $34,000, the code taxes $20,400 (85% of all benefits); the IRS worksheet yields $4,500 at that point.

The income passed into this calculation also omits modeled investment gains and any tax-exempt interest, both of which can affect provisional income.

**Impact:** Taxable Social Security and federal tax can be materially overstated near/above the thresholds, while omitted income can also cause underestimation in other cases.

**Suggested correction:** Implement the applicable IRS Publication 915 worksheet formula, with the right filing-status inputs and all modeled components of provisional income.

### 4. High — Employer matching can be counted twice and assigned to Roth — RESOLVED

**Locations:** `src/calculator.js:4-12`, `src/app.js:340-355`, `src/app.js:530-541`

Matching is calculated once against combined eligible traditional and Roth deferrals, then allocated between tax-deferred and Roth savings in proportion to each deferral type. Roth employer matching is included in taxable income.

The calculator independently computes an employer match for traditional and Roth employee deferrals. If someone contributes 6% to each account with a 50%-up-to-6% match, it models a 9% traditional contribution plus a 9% Roth contribution: 18% total, although the combined employee deferral is 12% and a 3% match would make 15% total under that example. The Roth contribution calculation also credits its match to the Roth balance, without an input for a plan that permits Roth employer contributions.

**Impact:** Contributions, balances, and cash flows can be overstated, especially when both traditional and Roth 401(k) deferrals are entered.

**Suggested correction:** Calculate matching against combined eligible employee deferrals and allocate employer contributions according to the plan's tax treatment rather than assuming a second match for Roth deferrals.

### 5. High — Medicare premium lookup uses the lookback year as the coverage year — RESOLVED

**Locations:** `src/app.js:647-653`, `src/calculator.js:159-180`, `src/calculator.js:182-202`

The coverage-year schedule is selected separately from projected MAGI two years earlier. If that projected year is unavailable, the closest projected MAGI is used; if no projection exists, the base premium applies. Unsupported schedules fail explicitly.

The app calls the premium lookup with `year - 2`, but that lookup selects both the premium amount and the IRMAA thresholds for that supplied year. The two-year rule uses prior-year MAGI to determine the IRMAA tier for a coverage year; it does not mean the coverage-year premium schedule should also be two years old. In addition, the code passes current projected income rather than income from two years earlier, and it omits modeled investment gains from the MAGI passed to the lookup.

There is also a projection failure near the present: premium schedules begin in 2026. A person already 65 in 2026 causes the 2026 row to request 2024; a person turning 65 in 2027 requests 2025. `getMedicarePremiumsForYear` returns `undefined` for those years, after which `getMedicarePremiumsByMagi` dereferences `.data`. The app's `beforeMount` catches the resulting error, so the projection may remain empty.

**Impact:** IRMAA tiers and nominal premiums are applied to the wrong years, and certain current/near-term users cannot calculate a projection at all.

**Suggested correction:** Look up the coverage-year premium schedule and thresholds, use the relevant two-year-prior MAGI for tier selection, and handle years outside the schedule with an explicit supported estimate rather than dereferencing a missing row.

### 6. Medium — Medicare Part B cost is always doubled — RESOLVED

**Location:** `src/app.js:647-653`

Premiums now use the coverage year's rate, the number of eligible household members, and covered months. Each spouse's age is modeled.

The monthly premium is multiplied by 24 months, which assumes two people are enrolled for all 12 months. A single filer is consequently charged twice the modeled Part B premium. For a joint household, the code has no spouse age or Medicare eligibility input, so it cannot represent a spouse enrolling at a different time.

**Suggested correction:** Model the number and eligibility dates of covered people, or make the single-person/two-person assumption explicit and selectable.

### 7. Medium — Capital-gains tax assumes half of every brokerage withdrawal is gain and uses a flat 15% rate — OPEN

**Locations:** `src/calculator.js:82-112`; related description in `src/tabs/taxes-tab.js`

The calculation sets taxable gain to exactly 50% of each investment withdrawal. The app has no cost-basis, holding-period, realized-loss, or dividend/interest inputs, so actual taxable gains can differ substantially from this assumption. It then taxes gains above the 0% threshold at 15%, with no 20% long-term capital-gains tier. The calculation also returns zero before retirement, even though realized gains do not become taxable only after retirement.

**Impact:** Brokerage withdrawal tax can be substantially over- or understated, particularly for high-income taxpayers, portfolios with a different cost basis, or pre-retirement sales.

**Suggested correction:** Either clearly label the 50%-basis/retirement-only assumptions as a rough estimate, or model taxable realized gains and apply the 0%/15%/20% brackets using taxable income. Apply the 3.8% NIIT to the lesser of net investment income or MAGI above the filing-status threshold, as required.

### 8. Medium — The 2025–2028 additional deduction for seniors is absent — PARTIALLY RESOLVED

**Locations:** `src/constants.js:22-23`, `src/constants.js:41-42`, `src/constants.js:60-61`; federal tax calculation in `src/calculator.js:255-279`

The model still does not include the separate temporary senior deduction available for tax years 2025–2028 (up to $6,000 per eligible person age 65 or older, subject to income-based phaseout). Projected federal taxable income and tax may therefore be overstated for eligible users during those years.

The regular age-based standard deduction now accounts for each spouse's age, but this does not implement the temporary deduction or its phaseout.

**Suggested correction:** Model the temporary senior deduction and eligibility/phaseout, and track each spouse's age for age-dependent deductions.

### 9. Medium — Pretax withdrawals before the configured age have no early-distribution penalty — OPEN

**Locations:** `src/app.js:590-618`, `src/app.js:621-645`; default age in `src/default-state.js:76`

When retirement spending exceeds available investment funds before the configured no-penalty age, `allocateWithdrawals` still takes money from pretax accounts. No 10% additional tax is calculated. Similar qualification and five-year rules for Roth distributions are not represented. The model also cannot distinguish an IRA from a former-employer 401(k), which matters because exceptions differ.

**Impact:** Early-retirement projections can overstate spendable funds when they rely on nonqualified pretax or Roth distributions.

**Suggested correction:** Model account type, distribution qualification/exception assumptions, and applicable additional taxes; otherwise flag such withdrawals as an unmodeled tax/penalty risk.

### 10. Medium — Married-filing-jointly projections include only one Social Security benefit — RESOLVED

**Locations:** `src/default-state.js:101-118`, `src/default-state.js:162-175`; input in `src/tabs/income-tab.js:110-119`

Joint-filer UI and state now include separate Social Security claim ages and monthly benefits for both spouses.

The app supports joint filing and a spouse's salary, but the state and UI provide only one age and amount for Social Security. A household with two benefit recipients will have its benefits and cash flow understated, and the taxable-benefit computation cannot reflect the actual combined benefits.

**Suggested correction:** Add separate benefit age/amount inputs for each spouse, and combine benefits and income according to the joint-return rules.

### 11. Medium — RMD start age is fixed at 75 for every user — FIXED ASSUMPTION; OTHER COHORTS UNSUPPORTED

**Locations:** `src/default-state.js`, fixed control in `src/tabs/age-tab.js`

The RMD age is fixed at 75 in the UI and is normalized to 75 when loading saved or shared data.

Age 75 is appropriate for people born in 1960 or later, including the default age-50 user in 2026. Some older birth cohorts have an earlier applicable starting age. Those rules and inherited-account RMD rules are not modeled.

**Impact:** Users whose applicable RMD age is earlier than 75 may have RMDs start too late in the projection.

## Other modeling limitations to keep in mind

- The federal tax engine is a projection, not a full return calculation: it does not model credits, itemized deductions, AMT, capital-loss carryovers, or all income types.
- State tax is modeled as a user-entered flat percentage rather than state-specific tax law.
- Future tax brackets, Social Security wage bases, Medicare premiums, and IRMAA thresholds are estimates. The UI discloses a 1.6% federal bracket increase and Medicare projection assumptions, but those are not known future statutory values.
- 401(k) contributions are not capped at annual IRS elective-deferral limits, and age-based catch-up limits are not modeled.
- Current-year income, contributions, spending, returns, and annualized taxes use the exact fraction of calendar months remaining, including the current month. Partial-year returns use simple proration rather than fractional compounding; without year-to-date income/withholding inputs, taxes remain approximate.
- Social Security base thresholds are not inflation-adjusted in the code; that matches the current statutory thresholds and is not itself a finding.

## References

- IRS, [Tax year 2026 inflation adjustments](https://www.irs.gov/newsroom/irs-releases-tax-inflation-adjustments-for-tax-year-2026-including-amendments-from-the-one-big-beautiful-bill) — confirms the 2026 standard deductions and ordinary-income brackets used in the constants.
- IRS, [Publication 915: Social Security and Equivalent Railroad Retirement Benefits](https://www.irs.gov/publications/p915) and [Tax Topic 423](https://www.irs.gov/taxtopics/tc423) — taxable-benefit worksheet and filing-status thresholds.
- IRS, [Publication 590-B: Distributions from Individual Retirement Arrangements](https://www.irs.gov/publications/p590b) — RMD distribution rules and tables.
- IRS, [Tax Topic 409: Capital Gains and Losses](https://www.irs.gov/taxtopics/tc409) — cost basis, holding period, and 0%/15%/20% long-term capital-gains rates.
- IRS, [Tax Topic 559: Net Investment Income Tax](https://www.irs.gov/taxtopics/tc559) — NIIT applies to the lesser of net investment income or MAGI above the applicable threshold.
- IRS, [Tax Topic 558: Additional Tax on Early Distributions](https://www.irs.gov/taxtopics/tc558) — early-distribution tax and exceptions.
- Medicare.gov, [Medicare costs](https://www.medicare.gov/basics/costs/medicare-costs) — coverage-year premiums and income-related adjustments.
