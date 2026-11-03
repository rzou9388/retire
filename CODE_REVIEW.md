# Early Retirement Calculator — Code Review

**Date:** 2026-11-02
**Branch reviewed:** `deepseek-bugchecks` (HEAD `4a4b873`, same tree as `main`)
**Scope:** the JavaScript app loaded by `index.html` — `src/app.js`, `src/calculator.js`, `src/constants.js`, `src/default-state.js`, `src/formatters.js`, and `src/tabs/*`. Legacy `app-module.js` / `scripts.js` / `chart.html` were reviewed but are not loaded by the app and are called out separately.
**Method:** static review plus an executable Node harness that imports the real `src/app.js` (with a minimal Vue stub and DOM/localStorage stubs), runs `calculate()`, and inspects `yearlyData`. 400 randomized scenarios were also fuzzed for exceptions, non-finite values, negative taxes/RMDs/conversions, and balance-sheet integrity.

**Status:** fixes below are applied to the working tree. **Nothing has been committed.** Run `git diff` to review.

---

## 1. Executive summary

The calculator is structurally sound (the yearly loop, federal bracket inflation, Medicare IRMAA table, and savings/withdrawal accounting are all recognizable and mostly correct), but several issues materially distorted results:

- **Required Minimum Distributions were effectively ignored** unless Roth conversion was enabled, and when conversion was on, the RMD was **credited to the Roth account** as if it had been converted (RMDs cannot be converted).
- **Roth conversions overshot the selected bracket** because the conversion was sized before the pre-tax withdrawals that fund spending were known. In the default plan this produced ~$326k of ordinary income when the 12% bracket ended at ~$156k.
- **Social Security taxation used a step function** (0% / 50% / 85% of *all* benefits) instead of the IRS Pub. 915 formula, overstating taxable SS by up to 5× in the middle of the phase-in range.
- **The Medicare IRMAA lookup could throw**, aborting the entire calculation (for example, a user who is already 66 today, because `year - 2` = 2024 has no premium table).
- **The employer match was double-counted** when contributing to both pre-tax and Roth 401(k) plans.
- **Capital gains ignored an unused standard deduction**, overtaxing gains in low-income years.
- **The Medicare premium was multiplied by 24 even for single/HOH filers**, doubling the premium.
- **No 10% early-withdrawal penalty** was applied when pre-tax accounts were tapped before 59½, and the pre-59½ withdrawal order drained pre-tax money before Roth contributions.
- **Surplus Social Security** (benefits above spending) vanished in retirement instead of being saved.
- Several robustness bugs could crash or hang the page from malformed saved data or share URLs.

All of the above (except the documented modeling limitations in §4) were fixed. The fixes were verified numerically and with a 400-scenario fuzz run (0 failures).

---

## 2. Findings at a glance

| # | Severity | Finding | Status |
|---|---|---|---|
| 1 | Critical | RMD ignored when Roth conversion off; RMD treated as a Roth conversion when on | Fixed |
| 2 | Critical | Roth conversion sized without accounting for spending withdrawals, overshooting the chosen bracket | Fixed |
| 3 | High | Social Security taxation uses a 0/50/85% step, not the IRS phase-in formula | Fixed |
| 4 | High | Medicare IRMAA lookup can throw and abort the whole calculation | Fixed |
| 5 | High | Employer match counted twice (pre-tax + Roth) | Fixed |
| 6 | Medium | Capital gains tax ignores unused standard deduction | Fixed |
| 7 | Medium | Medicare premium multiplied by 24 for single/HOH filers | Fixed |
| 8 | Medium | No 10% early-withdrawal penalty; pre-59½ order drains pre-tax before Roth | Fixed |
| 9 | Medium | Surplus Social Security disappears in retirement | Fixed |
| 10 | Medium | Roth 401(k) employer match is deducted from take-home cash as if employee-funded | Fixed |
| 11 | Medium | Stage-2-only Roth conversion impossible; negative conversion amount displayed | Fixed |
| 12 | Medium | Saved/URL data robustness: parse crashes, partial saved data, untrusted derived data, huge-age loops | Fixed |
| 13 | Medium | Brackets generated to `2026 + age at death` (e.g. 2114) instead of the death year | Fixed |
| 14 | Medium | First-year (current-year) proration is internally inconsistent | Documented |
| 15 | Medium | IRMAA uses current-year income against the year-2 threshold table | Documented |
| 16 | Low/Medium | Social Security provisional income excludes capital gains and tax-exempt interest | Documented |
| 17 | Low | Hard-coded 2026 tax/premium constants; app needs annual maintenance | Documented |
| 18 | Low | Contribution limits/catch-up/plan limits not enforced; pro-rata match assumption | Documented |
| 19 | Low | Roth basis / 5-year rule / qualified-distribution rules not modeled | Documented |
| 20 | Low | Spouse/survivor modeling is single-age and single-retirement-date | Documented |
| 21 | Low | Chart re-instantiated on every calculation without destroy; reads localStorage | Documented |
| 22 | Low | Dead/divergent legacy code (`app-module.js` has its own serious bugs) | Documented |
| 23 | Low | Minor HTML/accessibility/maintenance issues in `index.html` | Documented |

---

## 3. Detailed findings and fixes

### 3.1 RMD ignored or converted to Roth — **Critical**

**Where:** `src/app.js`, RMD/conversion block (`calculateYearly`, now around lines 576–620); balance update around line 878.

**What was wrong (before):**

```js
let rmd = 0;
if (age >= this.data.rmd.age) { rmd = pretaxBalance / divisor; }

let dist = 0;
let shouldConvert = pretaxBalance > 0 && this.data.rothConversion.bracket > 0 && ...;
if (shouldConvert) {
  ...
  dist = Math.max(rmd, dist);
  taxableOrdinaryIncome += dist;
}
...
roth = roth + dist + roth401k - rothWithdrawal;
pretaxBalance = pretaxBalance + k401 - dist - pretaxWithdrawal;
```

Two failures:

1. **If Roth conversion was off (`bracket = 0`), `rmd` was computed, displayed in the table, but never subtracted from the pre-tax balance and never added to taxable income.** The account kept compounding on money that legally must have been distributed and taxed.
2. **If a conversion was on, `dist = Math.max(rmd, dist)` meant the RMD amount was included in `dist` and then added to Roth.** The RMD was therefore treated as a conversion even though the IRS requires the RMD to be taken *before* the conversion and prohibits converting the RMD itself. The displayed `conversionAmount` did not include the RMD, so the table was also inconsistent.

**Impact:** Net worth could be overstated (pre-tax balance never reduced), taxable income and tax understated (RMD never taxed), and the Roth balance could be inflated by amounts that should be in a taxable account.

**Fix applied:**

- RMD is computed as before, capped at the pre-tax balance.
- `taxableOrdinaryIncomeBeforeConversion = taxableEarnedIncome + rmd` — RMD is always ordinary income, whether or not a conversion is active.
- `conversionAmount` is conversion-only and is capped at `pretaxBalance - rmd`; the RMD is never part of it.
- The RMD is distributed: the portion needed for spending/taxes is used first (`rmdUsed`), and the remainder is reinvested in the taxable investment account (`rmdReinvested`). While still working, salary funds spending, so the whole RMD is reinvested.
- Balance update is now `pretaxBalance + k401 - rmd - conversionAmount - pretaxWithdrawal`, and Roth receives only `conversionAmount`.
- Tooltips/tables show the RMD and the reinvested remainder.

**Verification (no-conversion case):** $1M pre-tax, no spending, no SS, RMD at 75.

| | Before | After |
|---|---|---|
| RMD at 75 | $290,412 (current-year post-growth basis, never distributed) | $273,973 (prior year-end basis, per IRS rules) |
| Tax on RMD | $0 (RMD not in income) | $32,932 |
| Pre-tax balance at 75 → next year start | $7,144,128 → $7,127,444 (only Medicare premium removed) | $7,144,128 → $6,870,155 (full RMD removed) |
| RMD reinvested in taxable | not tracked | $224,357 |

**Verification (conversion case):** RMD > 12% bracket at 75.

- Before: `dist = rmd = $1,236,566`, and the Roth balance increased by exactly that amount.
- After: `conversionAmount = $0` at 75 (RMD alone exceeds the bracket), RMD of $1,207,772 distributed/reinvested, and the Roth balance is unchanged by the RMD.

---

### 3.2 Roth conversion overshoots the selected bracket — **Critical**

**Where:** `src/app.js`, `calculateYearly` conversion sizing and fixed-point loop (now lines ~592–800).

**What was wrong (before):** The conversion amount was computed from `taxableOrdinaryIncome` *before* the pre-tax withdrawals used to pay spending and taxes were determined:

```js
const totalDistAllowed = getIncomeForBracketAndYear(year, bracket)
  - taxableOrdinaryIncome + conversionConfig.offset;
dist = min(pretaxBalance, totalDistAllowed);
...
// later: allocateWithdrawals() pulls more pre-tax money for spending
```

The spending withdrawal is *also* ordinary income (after 59½ the withdrawal order is pre-tax first). Adding it after the conversion means the conversion fills the bracket and then spending pushes income far past it.

**Evidence (default plan, age 60):**

| | Before | After |
|---|---|---|
| Conversion | $155,879 | $23,659 |
| Pre-tax spending withdrawal | $170,562 | $132,220 |
| Total ordinary income | **$326,441** | **$155,879** |
| 12% bracket upper limit (gross) | $155,879 | $155,879 |
| Federal ordinary income tax | $51,938 (tax field also included other items) | $13,595 |

The same check at ages 61 and 62 in the default plan now lands exactly on the bracket ceiling (within $1).

**Fix applied:**

- Introduced `taxableOrdinaryIncomeBeforeConversion` (salary − employee 401k + RMD).
- The conversion is sized as `min(pretaxBalance − rmd − pretaxWithdrawal, bracketCeiling − (base + pretaxWithdrawal) + offset)`.
- An outer fixed-point loop recomputes the conversion after the spending-withdrawal/tax loop converges, with half-step damping to prevent oscillation; a final convergence pass guarantees the recorded withdrawals match the final conversion. This handles the circular dependency conversion → tax → withdrawal → bracket room.
- The conversion now also uses the active stage's bracket (see 3.11).

**Note:** The conversion target still uses ordinary income only; taxable Social Security is added later and can push the *effective* marginal rate slightly above the target bracket (see §4).

---

### 3.3 Social Security taxation formula — **High**

**Where:** `src/calculator.js`, `calculateSSToTax` (line 81).

**What was wrong (before):**

```js
if (provisionalIncome < lower) return 0;
if (provisionalIncome < upper) return ss * 0.5;
return ss * 0.85;
```

This is a step function on **all** benefits. The IRS formula taxes up to 50% of benefits in the lower band and 85% of provisional income above the upper threshold, with a total cap of 85% of benefits.

**Evidence (MFJ thresholds $32k/$44k):**

| Other income | SS benefits | Provisional income | Old result | IRS result |
|---|---|---|---|---|
| $20,000 | $40,000 | $40,000 | **$20,000** | **$4,000** |
| $32,999 | $40,000 | $52,999 | **$34,000** | **$13,649** |
| $44,001 | $60,000 | $74,001 | **$51,000** | **$31,501** |
| $104,000 | $60,000 | $134,000 | $51,000 | $51,000 |

**Impact:** Large overstatement of federal tax for retirees whose provisional income sits in or just above the phase-in range — precisely the early-retirement years the tool targets.

**Fix applied:** Implemented the Pub. 915 formula:

```js
const lowerBandIncome = max(min(provisional, upper) - lower, 0);
const taxable = min(lowerBandIncome * 0.5, ss * 0.5)
             + max(provisional - upper, 0) * 0.85;
return min(taxable, ss * 0.85);
```

All four cases above now match the IRS result.

---

### 3.4 Medicare IRMAA lookup crash — **High**

**Where:** `src/calculator.js`, `getMedicarePremiumsForYear` (line 238); `src/app.js` premium lookup.

**What was wrong (before):**

```js
return state.data.medicare.premiums.find((y) => y.year === year);
```

The premium tables were generated from 2026, but IRMAA intentionally looks up income/premiums two years earlier:

```js
getMedicarePremiumsByMagi(..., year - 2, ...)
```

For a user aged 63–66 at the start, `year - 2` is 2024/2025, which is not in the array. `.find()` returned `undefined`, and `getMedicarePremiumsByMagi` then threw `TypeError: Cannot read properties of undefined (reading 'data')`. In the app, only `beforeMount`'s outer `try/catch` catches it, so the whole yearly table silently ends up empty.

**Reproduction:** current age 66, retirement age 70 → `THREW: TypeError - Cannot read properties of undefined (reading 'data')`.

**Fix applied:**

- `getMedicarePremiumsForYear` now falls back to the nearest available table: the first (2026) table for years before the projection starts, and the last table for years beyond it.
- `estimateMedicarePremiumsForAllYears` now bounds the generation loop by age (`CONFIG.MAX_AGE = 120`) and coerces ages to numbers, so malformed data cannot create an effectively infinite loop.
- The single-year table generation itself was already correct; only lookup/generation bounds changed.

**Verification:** the age-66 scenario now runs and produces 23 rows.

---

### 3.5 Employer match double-counted — **High**

**Where:** `src/app.js` `calculate()` (line ~345); new helper `calculateContributionRates` in `src/calculator.js` (line 25).

**What was wrong (before):**

```js
totalPercent    = calculateTotal401kWithMatch(employeePercent, employerPercent, matchUpTo);
rothTotalPercent = calculateTotal401kWithMatch(roth401kPercent, employerPercent, matchUpTo);
```

The employer match was computed separately for the pre-tax and Roth plans. With 6% pre-tax + 6% Roth, a 50% match up to 6% produced 3% match on each plan (6% total) even though the plan’s match cap is 6% of the employee’s *combined* contribution (max 3%).

**Evidence (default salary $150,000, 6% + 6%, 50% up to 6%):**

| | Before | After |
|---|---|---|
| Pre-tax total % (incl. match) | 9% | 7.5% |
| Roth total % (incl. match) | 9% | 7.5% |
| Combined modeled contribution (employee 12% + match) | 18% of salary | **15% of salary** (12% employee + 3% match) |
| Max employer match in dollars | $4,500 | $4,500 |

**Fix applied:** `calculateContributionRates(pretaxPct, rothPct, employerPct, matchUpTo)` applies the match to `min(pretaxPct + rothPct, matchUpTo)` and splits it pro rata between the two accounts. The old `calculateTotal401kWithMatch` remains exported for compatibility but is no longer used by the app.

**Assumption:** the pro-rata split assumes the employer match deposited into a Roth 401(k) is itself Roth. Many plans deposit the match pre-tax regardless of the employee’s election; if that matters, change the split to put 100% of the match in pre-tax.

---

### 3.6 Capital gains tax ignores the unused standard deduction — **Medium**

**Where:** `src/calculator.js`, `calculateCapitalGainTax` (line 121).

**What was wrong (before):**

```js
const taxable = max(taxableIncome - standardDeduction, 0) + taxableGain;
```

If ordinary income is below the standard deduction, the unused deduction should shelter part of the capital gain. The old code dropped that unused portion and taxed more of the gain than the law allows.

**Evidence:** $300,000 investment withdrawal (assumed 50% gain = $150,000), $0 ordinary income, MFJ standard deduction $32,200, 0% ceiling $98,900:

- Old tax: `max(150,000 − 98,900, 0) × 15% = $7,665`
- Correct: `max(150,000 − 32,200 − 98,900, 0) × 15% = $2,835`

**Fix applied:** compute `unusedStandardDeduction = max(deduction − taxableIncome, 0)`, reduce gains by it, and use the reduced gain both in the taxable-income calculation and in the gains-above-ceiling cap. Result now $2,835.

**Remaining assumptions:** 50% of every withdrawal is gain (no cost-basis tracking), 15% flat federal rate (the 20% bracket is not modeled; the UI discloses the fixed 15%), the 3.8% NIIT is applied as `min(gain, max(AGI − threshold, 0))`, and state tax is applied at the after-retirement rate.

---

### 3.7 Medicare premium multiplied by 24 for single/HOH — **Medium**

**Where:** `src/app.js`, `calculateTaxesForWithdrawals` (line ~715).

**What was wrong (before):**

```js
getMedicarePremiumsByMagi(..., year - 2, this) * 24
```

`24` was hard-coded. The monthly figure is per person; ×24 is only correct for a married couple where both spouses are on Medicare. A single filer had their Part B/IRMAA premium doubled.

**Evidence (single filer, age 65, 2029 table base monthly $214.06):**

| | Before | After |
|---|---|---|
| Annual Medicare premium | $5,137 (×24) | **$2,569 (×12)** |

**Fix applied:** `medicarePeople = filingStatus === "marriedFilingJointly" ? 2 : 1`, then `monthly × 12 × medicarePeople`.

**Assumption:** in MFJ both spouses are 65+ and on Medicare; the model still has only one age per household. If the spouse is younger, the ×2 overstates the premium for the years before the spouse is 65.

---

### 3.8 No early-withdrawal penalty; pre-59½ order drains pre-tax first — **Medium**

**Where:** `src/app.js` `allocateWithdrawals` and `calculateTaxesForWithdrawals` (lines ~635–745); helper `calculateEarlyWithdrawalPenalty` in `src/calculator.js` (line 191).

**What was wrong (before):**

- The withdrawal order between retirement and the penalty-free age was **investment → pre-tax → Roth**, with no 10% penalty. Tapping pre-tax before 59½ incurs a 10% additional tax (absent an exception), and Roth contributions could have been used without a penalty.
- The table’s “penalty free withdraw” milestone consequently had no effect on the numbers.

**Evidence (retire at 55, $1M pre-tax, no Roth/investment, no conversion, $70k spending):**

| Age | Before tax | After tax (penalty included) |
|---|---|---|
| 56 | $3,437 | $3,437 (investment funded spending) |
| 59 | $9,353 | $26,099 (includes $14,149 penalty) |
| 60 | $10,369 | $10,369 (penalty-free age reached) |

With a Roth balance available, the pre-59½ order is now investment → **Roth** → pre-tax, so no penalty is paid when Roth funds are available (the app already treats Roth withdrawals as qualified).

**Fix applied:**

- 10% penalty on pre-tax withdrawals before `noPenaltyWithdraw.age`, added to `tax`, included in the fixed-point loop, recorded as `earlyWithdrawalPenalty`, and shown in the tax tooltip.
- Pre-59½ order is investment → Roth → pre-tax; post-59½ order remains pre-tax → investment → Roth.
- The retirement summary text was updated to describe the order and the penalty.

**Remaining assumption:** the penalty-free threshold is the integer `noPenaltyWithdraw.age` (default 60, labelled 59.5). The model does not track Roth contribution basis or the 5-year rules, so it treats all Roth withdrawals as qualified and penalty-free.

---

### 3.9 Surplus Social Security disappears — **Medium**

**Where:** `src/app.js` after the withdrawal loop (lines ~811–818).

**What was wrong:** `spendingAfterSS = spendingAmount - ss` could be negative when benefits exceed spending. `allocateWithdrawals` clamps the cash need to zero, so the surplus SS was simply lost — no withdrawal, no deposit, no increase to the investment balance. The “Post-tax Balance” then grew only by the return on its starting balance.

**Evidence:** $60,000 SS, $41,787 spending, $100,000 investment, retirement years:

| | Before | After |
|---|---|---|
| Investment at 62 → 63 | $885,592 → $938,728 (exactly ×1.06; surplus lost) | $885,592 → $958,034 (+$18,213 surplus saved) |

**Fix applied:** after the final tax calculation, if retirement-year cash need is negative, the surplus is added to the taxable investment account (`surplusCash`) and is included in the investment tooltip/bridge. In working years the surplus is already captured by the salary cash-flow formula, so it is not added twice.

---

### 3.10 Roth 401(k) employer match deducted from take-home pay — **Medium**

**Where:** `src/app.js` working-year cash-flow update (lines ~880–893).

**What was wrong:** `roth401k` includes the employer match (via `rothTotalPercent`), but the working-year cash flow subtracted the full `roth401k` from salary:

```js
investmentCashFlow = (taxableEarnedIncome - roth401k - (spendingAfterSS - additionalExpense) - tax) * monthsLeft;
```

Only the employee’s own Roth deferral reduces take-home pay; the employer match does not. This understated the investment account by the match each working year.

**Fix applied:** added `roth401kEmployee`, computed from `roth401kPercent` (not the match-inclusive total), and used it in the cash-flow calculation. The match still flows into the Roth balance.

---

### 3.11 Stage-2-only conversion impossible; negative conversion amount — **Medium**

**Where:** `src/app.js` conversion block (lines ~592–620).

**What was wrong:**

- `shouldConvert` was gated on **stage 1’s** bracket: `this.data.rothConversion.bracket > 0`. If a user set stage 1 to 0% and stage 2 to 12%, conversions never happened, because the gate had already failed before the stage-2 config was selected.
- When the conversion was enabled while still working and salary already exceeded the target bracket, `totalDistAllowed` went negative and `conversionAmount` was assigned a negative number (even though the actual distribution was clamped to zero by `Math.max(rmd, dist)`). The Roth Conversion column displayed a negative conversion.

**Fix applied:**

- The active stage is selected first (`age >= stage2.age ? stage2 : stage1`), then the gate uses that stage’s bracket.
- `conversionAmount` is clamped to `[0, pretaxBalance − rmd − pretaxWithdrawal]`; negative targets display as 0.

**Verification:** stage 1 = 0%, stage 2 = 12% at age 65 now produces a ~$74k conversion at 65; the working-year negative case now shows 0.

---

### 3.12 Saved-state and share-URL robustness — **Medium**

**Where:** `src/default-state.js` `loadInitialAppState` / `loadQueryData` (lines 219–300); `src/app.js` `saveState` / `updateChart` (lines ~31, ~394).

**Issues found:**

1. `JSON.parse(localStorage.getItem("data"))` was unguarded. Corrupt or partially written localStorage threw before the app rendered.
2. The saved-data migration assumed `savedData.tax`, `.person`, `.contrib`, `.medicare`, and `.person.spouse` all existed. A partially saved/older payload threw a `TypeError`.
3. `loadQueryData` accepted derived data from the URL. A crafted share link could inject `medicare.premiums` (which were trusted and never regenerated after load) and stale `yearlyData`. Tax brackets happened to be regenerated because the cache key is not a default key and is dropped by the merge, but relying on that was fragile.
4. An absurd `person.deceased.age` in a share URL caused `calculateYearly` and the bracket/premium generators to loop for a huge number of iterations (a self-inflicted DoS/freeze).
5. `saveState` could throw on quota/private-mode errors and abort the post-calculation steps.
6. `updateChart` parsed localStorage without a guard.

**Fix applied:**

- `loadInitialAppState` now uses `mergeWithDefaults(createDefaultAppState().data, savedData)` — filling every missing key recursively — with legacy `meritIncrease` migration preserved, a guarded `JSON.parse`, and type checks.
- Derived arrays (`tax.brackets`, `medicare.premiums`, `yearlyData`) are always reset for both saved and URL data; `investmentContributions` is forced to an array.
- `calculateYearly`, `calculateTaxBracketsForAllYear`, and `estimateMedicarePremiumsForAllYears` cap ages at `CONFIG.MAX_AGE` (120) and coerce numeric inputs, so malformed ages cannot hang the page.
- `saveState` is wrapped in `try/catch` with a console warning.
- `updateChart` guards its `JSON.parse` and checks `yearlyData` is an array.
- One-time contribution objects are skipped if they are not objects.

**Verification:** corrupt JSON, partial saved objects, and a URL with `deceased.age = 1,000,000` all now load/calculate cleanly (the huge-age case finished in ~4 ms with 121 rows).

---

### 3.13 Tax brackets generated far past the projection — **Medium (cleanup/perf)**

**Where:** `src/calculator.js`, `calculateTaxBracketsForAllYear` (line 292).

**What was wrong:**

```js
const lastYear = Math.max(2026 + state.data.person.deceased.age, year);
```

For the default 88-year-old life expectancy this generated brackets through **2114** (2026 + 88), ~50 years beyond the simulation’s end (2064), on every recalculation.

**Fix applied:** generate through the actual death year:

```js
deathYear = currentYear + max(min(deceasedAge - personAge, MAX_AGE), 0)
lastYear  = min(max(deathYear, year), currentYear + MAX_AGE)
```

Also removed an unused `ageDeduction` calculation and added `Number()` coercion around the age used to apply the 65+ additional standard deduction.

---

### 3.14 Remaining modeling limitation: first-year proration is inconsistent — **Documented (not changed)**

**Where:** `src/app.js` `calculateYearly`, `calculatePercentOfMonthsLeftInYear`.

**The issue:** The current year is treated as a partial year for some items and a full year for others:

- Spending, 401(k) contributions, and the year-end savings cash flow are multiplied by `monthsLeft` (17% in November).
- Salary, federal/state tax, FICA, and the employee 401(k) deduction used in the tax base are not prorated consistently.
  - `k401Employee` *is* prorated by `monthsLeft` in the tax base, while salary is full-year. In the default plan this adds ~$7,470 to taxable wages (a full-year $9,000 deferral becomes $1,530), overstating year-0 tax by roughly $2,000.
  - The cash-flow bracket mixes full-year salary with already-prorated spending/contributions and then multiplies the result by `monthsLeft` again, so some components are effectively prorated twice.

**Evidence (default, current age 50, November):**

- Year-0 row shows salary $150,000, spending $13,600, 401(k) $2,295.
- Implied first-year investment saving added: $17,165.
- A full-year convention would give ~$27,098; a pure partial-year convention would give ~$5,600.

**Recommendation:** pick one convention and apply it to all flows. The cleanest is the “remaining-year” convention: prorate salary, contributions, spending, FICA, and tax by `monthsLeft`, and do not multiply the net cash flow a second time; the displayed Salary column can remain the annual salary with a note.

This was left unchanged because it is a product-definition choice, and changing it alters the first row of every projection. It does not affect subsequent years (`monthsLeft = 1`).

---

### 3.15 Remaining modeling limitation: IRMAA uses current income against a two-year-old table — **Documented**

**Where:** `src/app.js` `calculateTaxesForWithdrawals` (lines ~710–723).

IRMAA is based on MAGI from **two years prior**, but the calculator uses the current row’s `withdrawalTaxableIncome + taxableSS` and indexes the premium table with `year - 2`. The threshold values are therefore from the right year, but the income is not.

**Effect:** in years where income changes sharply (retirement, first RMD year, large conversion years), the premium tier can be wrong in either direction. A proper fix is to record each year’s MAGI in `yearlyData` and look up `year - 2` (falling back to current income for the first two simulated years).

**Also:** the MAGI used for IRMAA excludes realized capital gains and tax-exempt interest, so IRMAA is understated for investors who realize large gains.

### 3.16 Remaining modeling limitation: Social Security provisional income is incomplete — **Documented**

`calculateSSToTax(otherIncome, ss)` receives ordinary income (salary − 401(k), RMD, conversions, pre-tax withdrawals) plus ½ of benefits. Provisional income should also include **realized capital gains, dividends/interest, and tax-exempt interest**. The current model therefore understates taxable Social Security for households with meaningful taxable-account income.

### 3.17 Other assumptions worth knowing — **Documented**

- All federal constants are **2026** values: brackets, standard deductions, capital-gain 0% ceilings, Social Security provisional-income thresholds (correctly not indexed), IRMAA thresholds, Part B premiums, and the FICA wage base. Bracket ceilings are projected at **1.6%/year**, the FICA wage base at **4.92%/year**, IRMAA ceilings at **4.2%/year**, and premiums at **5.5%/year**.
- The capital-gain 0% ceiling is inflated using the user’s **inflation** assumption, while brackets use 1.6% — the two indexation assumptions are inconsistent.
- Standard deduction projection adds the 65+ additional deduction based on **one** age; for MFJ it adds the full $3,300, implicitly assuming both spouses are 65+.
- **No 401(k)/IRA contribution limits, catch-up contributions, compensation limits, or plan-level match limits.** An employee can model a 50% deferral on any salary.
- **RMD age is fixed at 75** (the field is disabled). The Uniform Lifetime Table starts at 72 and is correct for post-2022 RMD rules; users born before 1960 should use 73, which the UI does not expose. No QCDs or withholding. The RMD is also divided into the **current-year, post-growth** pre-tax balance rather than the prior December 31 balance required by the IRS, which slightly overstates the RMD.
- **Roth:** conversions are taxed as ordinary income (correct) but there is no 5-year rule, basis tracking, or distinction between contributions and earnings on withdrawal. Every Roth withdrawal is assumed qualified and penalty-free.
- **Spouse/survivor:** one age for both spouses, both retire on the same date, both reach Medicare together, and there is no survivor filing status, spousal Social Security, or survivor benefit after the first death. The MFJ model also assumes both are 65+ for Medicare.
- **FICA:** the additional 0.9% Medicare tax threshold is applied to combined MFJ wages rather than per individual; Social Security’s wage base is correctly applied per person. No self-employment tax.
- **Capital gains:** 50% of each taxable-account withdrawal is assumed to be gain. There is no basis tracking, no loss harvesting, no dividends/interest taxation, and the 20% federal rate is not modeled (the UI says 15% is used).
- **State taxes:** a flat rate on ordinary income plus a separate flat rate on realized gains; no state standard deduction, exemptions, retirement-income exclusions, or state SS treatment (`index.html` already lists this as a TODO).
- **Returns:** deterministic single rate before/after retirement; no sequence-of-returns risk, asset allocation, or volatility. The current year gets **no** return at all (`i === 0` short-circuit in `calculateGain`), rather than a partial-year return. Negative balances earn no return and withdrawal helpers clamp at zero, so negative investment balances persist.
- **One-time incomes** are added to investments without tax; **one-time expenses** are nominal (not inflated) and can make the working-year investment balance negative. The income tab discloses that proceeds taxes are not estimated.
- **Pre-retirement shortfalls** are not funded from pre-tax/Roth accounts; the model instead allows the taxable investment balance to go negative via the salary cash flow. The “Retirement year” warning checks `investment < 0`; the new `shortfall` field is surfaced in the investment tooltip for retirement years where all accounts are exhausted.

---

## 4. Minor / cleanup findings

### 4.1 Dead or divergent code — recommend deletion

- **`app-module.js`** is not loaded by `index.html`. It is an older monolith and contains its own serious bugs: its `calculateOrdinaryIncomeTaxForYear` applies each rate to the bracket's upper-bound amount instead of the income inside that bracket (and subtracts that upper bound from the remaining income), its `getMedicarePremiumsByMagi` breaks on the first ceiling, returning the base premium for every income, and its capital-gains function passes the total tax as taxable income. Leaving it in the repo is a trap for future maintainers.
- **`scripts.js`** is loaded by `index.html` but only defines `updateChart`/`resetDivTab`; `src/app.js` immediately defines and uses its own `updateChart`, so the file is dead.
- **`src/tabs/tab-panel.js`** is not imported anywhere.
- **`retire-utils.js`** is empty.
- **`chart.html`** is a standalone Chart.js demo, not linked from the app.

Recommendation: delete the dead files, or move them to a clearly marked `legacy/` folder. Keep exactly one implementation of each calculation.

### 4.2 Chart lifecycle — low

`updateChart` is called on a 200 ms timeout after **every** recalculation, clears `chartParent.innerHTML`, and creates a new `Chart` instance without calling `.destroy()` on the previous one. Rapid input changes can leave listeners/instances behind and produce console warnings. Also, the chart reads `localStorage` rather than the in-memory `yearlyData`, so it depends on the save succeeding. Recommendation: keep a chart instance reference and destroy it before re-creating; pass `this.data.yearlyData` directly.

### 4.3 `index.html` — low

- No `<meta charset="utf-8">` or `<meta name="viewport" ...>`.
- Chart.js is loaded from an unpinned CDN URL (`.../npm/chart.js`), so a future major release can break the chart.
- The `<details>` TODO block sits after `</body>`; browsers recover, but it is invalid markup.
- The reset button uses inline `onclick` JavaScript.
- Several key assumptions are exposed as disabled inputs (`noPenaltyWithdraw.age`, `medicare.age`, `rmd.age`), which prevents legitimate users (e.g., born before 1960) from correcting them.

### 4.4 `beforeMount` swallows exceptions — low

```js
beforeMount() {
  try { this.calculate(); } catch (ex) { console.error(ex); }
}
```

Any calculation failure leaves the page with an empty/partial table and only a console error. Now that the known crash (3.4) is fixed, consider surfacing `ex.message` in a visible alert/status area, at least in development.

### 4.5 `noPenaltyWithdraw.age` label vs value — low

The age-tab and summary say **59.5**, but the value/default is **60** and the model compares integer ages. Since the simulation is age-integer, `60` is a workable proxy for 59.5, but the label and the actual threshold should be made consistent (either allow 59.5 and compare `age + 0.5`, or relabel it “age 60 (the first full year after 59½)”).

### 4.6 `calculatePercentOfMonthsLeftInYear` documentation — low

The comment says it returns a percent (0–100) and gives the example “returns 17” in November, but the function returns a fraction (`0.17`). The callers correctly treat it as a fraction, so this is documentation only. Also, the function counts the current month in full (`12 - monthIndex`); in the last week of a month it overstates the remaining time. Consider `(12 - monthIndex - dayFraction)/12` if precision matters.

---

## 5. Verification performed

A Node harness imported the real `src/app.js` with a minimal Vue stub (`createApp`/`defineAsyncComponent`), stubbed `window`, `document`, `localStorage`, and `Chart`, and called the component’s `calculate()` method directly. It then inspected `this.data.yearlyData` and the input state. No browser was required.

### 5.1 Scenario checks (after fixes)

- Default plan (age 50, retire 60, $500k pre-tax, $100k Roth, $100k taxable, 12%/6% returns, 2.8% inflation, 5% state tax before retirement, 0% after, SS at 62):
  - Balance-sheet bridges reconcile for every row:
    `next starting = previous balance + contributions − distributions − withdrawals` for pre-tax, Roth, and taxable accounts (plus RMD reinvestment/surplus for the taxable account).
  - No negative taxes, RMDs, or conversions.
- RMD-only plan: RMD fully removed and taxed; remainder reinvested in taxable; bridge reconciles.
- RMD + conversion: conversion is zero when the RMD alone exceeds the bracket, and no RMD is credited to Roth.
- Stage-2-only conversion: conversion begins at age 65 as configured.
- Early retirement with a Roth balance: Roth is used before penalized pre-tax withdrawals.
- Social Security, capital-gain, employer-match, Medicare-single, and conversion-bracket cases match the calculations in §3.
- Corrupt localStorage, partial saved objects, and a URL with `deceased.age = 1,000,000` all load and calculate without throwing or hanging.

### 5.2 Randomized fuzz

400 scenarios with random ages (30–75), life expectancy, retirement age, filing status, salaries, balances (including a negative taxable balance), returns, inflation, spending, conversions (every bracket and offsets), SS claiming age/benefits, contributions, match settings, state rates, and one-time events.

- Exceptions: **0**
- Non-finite values: **0**
- Negative taxes/RMDs/conversions: **0**
- Balance-bridge mismatches: **0**
- (Plans that exhaust all assets report a `shortfall` in the tooltip; that is expected and is not a calculation failure.)

### 5.3 Syntax

All modified modules were parse-checked as ES modules (`node --check` with an `.mjs` copy): `app.js`, `calculator.js`, `constants.js`, `default-state.js`, `tabs/roth-tab.js`, `tabs/yearly-tab.js`, `tabs/income-tab.js`.

---

## 6. Files changed in the working tree

| File | Changes |
|---|---|
| `src/app.js` | RMD handling; conversion sizing/fixed-point; active-stage selection; early-withdrawal penalty and order; Medicare ×12/×24; RMD reinvestment and surplus SS; `roth401kEmployee` cash flow; number/loop guards; error-safe save/chart parse; tooltip fields; summary text |
| `src/calculator.js` | Correct SS taxation; unused standard deduction for gains; `calculateContributionRates`; `calculateEarlyWithdrawalPenalty`; Medicare lookup fallback; bracket/premium generation bounds; death-year bracket generation; `getRowTitle` robust matching; input coercion |
| `src/constants.js` | `EARLY_WITHDRAWAL_PENALTY_RATE`; `MAX_AGE` bound |
| `src/default-state.js` | Safe saved-state merge and migration; derived-data reset; guarded URL data; array validation |
| `src/tabs/roth-tab.js` | Bracket-dropdown year fallback when the conversion age is outside the projection |
| `src/tabs/yearly-tab.js` | Early-withdrawal-penalty line in the tax tooltip; RMD-reinvestment/surplus-cash lines and shortfall warning in the investment tooltip |

No files were deleted. No commit was created.

---

## 7. Recommended next steps (in priority order)

1. **Decide the first-year convention** (full-year vs remaining-months) and make salary, tax, FICA, contributions, and spending consistent (finding 3.14).
2. **Implement two-year-lookback IRMAA** by recording each row’s MAGI and using the value from `year − 2` when available (3.15).
3. **Include capital gains and tax-exempt interest in provisional income and IRMAA MAGI** (3.16).
4. **Add cost-basis tracking** for the taxable account instead of assuming 50% gain on every withdrawal; this will also make the capital-gain tax and state tax more realistic.
5. **Expose RMD age and the 59½ threshold** (or derive RMD age from birth year) rather than leaving them as disabled constants.
6. **Delete or quarantine the legacy files** (`app-module.js`, `scripts.js`, `tab-panel.js`, `retire-utils.js`, `chart.html`) to eliminate a second, buggy implementation.
7. **Add a small test suite** (the harness used here is a good start) covering the SS formula, RMD/conversion interaction, employer-match cap, capital-gain deduction, Medicare lookup, and balance bridges, so future changes to the loop are protected.
8. If the app is intended to be used beyond 2026, **move the 2026 constants to a dated tax-year table** and add a new table each year rather than relying on the current hard-coded values.

---

## 8. Appendix — key before/after reproductions

All amounts are annual nominal dollars unless noted.

| Scenario | Before | After |
|---|---|---|
| MFJ, other income $20k, SS $40k → taxable SS | $20,000 | $4,000 (IRS) |
| MFJ, other income $44,001, SS $60k → taxable SS | $51,000 | $31,501 (IRS) |
| $300k withdrawal, $0 ordinary income, MFJ → cap-gain tax | $7,665 | $2,835 |
| 6% pre-tax + 6% Roth + 50% match up to 6% → combined contribution | 18% of salary | 15% of salary |
| Single filer, Medicare at 65 (2029 table) → annual premium | $5,137 | $2,569 |
| Retire 55, no Roth/investment, $70k spending at 59 → tax (incl. penalty) | $9,353 | $26,099 (penalty $14,149) |
| Default plan, age 60 → conversion / spending withdrawal / total ordinary vs 12% ceiling | $155,879 / $170,562 / $326,441 vs $155,879 | $23,659 / $132,220 / **$155,879 vs $155,879** |
| RMD at 75, no conversion, no spending → pre-tax reduction | RMD shown but balance not reduced (only Medicare withdrawal removed) | Full $273,973 removed; $32,932 tax; $224,357 reinvested |
| RMD at 75 with conversion → amount credited to Roth | $1,236,566 RMD added to Roth | $0 added to Roth; RMD $1,207,772 distributed/reinvested |
| SS surplus $60k vs $41.8k spending → investment 62→63 | $885,592 → $938,728 (return only; surplus lost) | $885,592 → $958,034 (+$18,213 saved) |
| Current age 66 → calculation | Throws `TypeError`; empty table | 23 rows, no crash |
| Share URL with `deceased.age=1,000,000` | Unbounded loops/freeze risk | 121 rows, ~4 ms |
