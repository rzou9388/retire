import assert from "node:assert/strict";
import test from "node:test";
import * as calculator from "../src/calculator.js";
import {
  createDefaultAppState,
  loadInitialAppState,
  serializeLocalStorageData,
  serializeUserData,
} from "../src/default-state.js";

function stateWithFilingStatus(filingStatus) {
  return { data: { tax: { filingStatus } } };
}

test("Social Security benefits are not taxable at the base threshold", () => {
  assert.equal(
    calculator.calculateSSToTax(13_000, 24_000, stateWithFilingStatus("single")),
    0,
  );
});

test("Social Security benefits are taxed progressively between thresholds", () => {
  assert.equal(
    calculator.calculateSSToTax(
      18_000,
      24_000,
      stateWithFilingStatus("single"),
    ),
    2_500,
  );
});

test("Social Security benefits use the worksheet formula at the upper threshold", () => {
  assert.equal(
    calculator.calculateSSToTax(
      22_000,
      24_000,
      stateWithFilingStatus("single"),
    ),
    4_500,
  );
});

test("taxable Social Security is capped at 85 percent of benefits", () => {
  assert.equal(
    calculator.calculateSSToTax(
      100_000,
      24_000,
      stateWithFilingStatus("single"),
    ),
    20_400,
  );
});

test("joint Social Security benefits use joint provisional-income thresholds", () => {
  assert.equal(
    calculator.calculateSSToTax(
      26_000,
      12_000,
      stateWithFilingStatus("marriedFilingJointly"),
    ),
    0,
  );
});

test("household Social Security combines both spouses' inflation-adjusted benefits", () => {
  assert.equal(
    calculator.calculateHouseholdSSBenefits(
      { ss: { age: 62, perMonth: 2_000 } },
      { ss: { age: 67, perMonth: 1_000 } },
      "marriedFilingJointly",
      0,
      62,
      67,
    ),
    36_000,
  );
});

test("future amounts convert to today's dollars for display", () => {
  assert.ok(
    Math.abs(
      calculator.convertToTodaysDollars(1_210, 2028, 10, 2026) - 1_000,
    ) < 0.0001,
  );
});

test("current-year amounts remain unchanged in today's dollars", () => {
  assert.equal(
    calculator.convertToTodaysDollars(1_000, 2026, 10, 2026),
    1_000,
  );
});

test("Social Security benefit entered as today's dollars is inflated from current age", () => {
  const yearlyBenefit = 2_000 * 12;
  assert.equal(
    calculator.calculateSSBenefits(
      { age: 50, ss: { age: 62, perMonth: 2_000 } },
      2.8,
      62,
    ),
    yearlyBenefit * 1.028 ** 12,
  );
});

test("single-filer Social Security excludes spouse benefits", () => {
  assert.equal(
    calculator.calculateHouseholdSSBenefits(
      { ss: { age: 62, perMonth: 2_000 } },
      { ss: { age: 62, perMonth: 1_000 } },
      "single",
      0,
      62,
      62,
    ),
    24_000,
  );
});

test("joint standard deduction adds the age amount for each qualifying spouse", () => {
  const yearsFrom2026 = new Date().getFullYear() - 2026;
  const state = {
    data: {
      tax: { filingStatus: "marriedFilingJointly", brackets: [] },
      person: {
        age: 64 + yearsFrom2026,
        spouse: { age: 64 + yearsFrom2026 },
        deceased: { age: 90 },
      },
    },
  };
  assert.equal(
    calculator.getTaxBracketsForYear(state, 2026).standardDeduction,
    32_200,
  );
  state.data.person.spouse.age += 1;
  assert.equal(
    calculator.getTaxBracketsForYear(state, 2026).standardDeduction,
    33_850,
  );
});

test("RMD age remains fixed at 75 in saved and shared state", () => {
  const state = createDefaultAppState();
  state.data.rmd.age = 72;
  assert.equal(serializeUserData(state.data).rmd.age, 75);

  const windowDescriptor = Object.getOwnPropertyDescriptor(globalThis, "window");
  const storageDescriptor = Object.getOwnPropertyDescriptor(
    globalThis,
    "localStorage",
  );
  let storedData = JSON.stringify(state.data);
  try {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: { location: { search: "" } },
    });
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: () => storedData,
      },
    });
    assert.equal(loadInitialAppState().data.rmd.age, 75);

    state.data.columns.contribRoth = true;
    storedData = JSON.stringify(serializeLocalStorageData(state.data));
    const loadedState = loadInitialAppState();
    assert.equal(loadedState.data.columns.contribRoth, true);
    assert.deepEqual(loadedState.data.yearlyData, []);
    assert.equal(loadedState.data.rmd.lifetimeTable.length, 29);
  } finally {
    if (windowDescriptor) {
      Object.defineProperty(globalThis, "window", windowDescriptor);
    } else {
      delete globalThis.window;
    }
    if (storageDescriptor) {
      Object.defineProperty(globalThis, "localStorage", storageDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("local storage serialization keeps inputs and columns, not calculated projections", () => {
  const state = createDefaultAppState();
  state.data.columns.contribRoth = true;
  state.data.yearlyData = [{ year: 2026 }];
  state.data.person.retirement.year = 2026;
  state.data.tax.brackets = [{ threshold: 1 }];

  const savedData = serializeLocalStorageData(state.data);

  assert.equal(savedData.columns.contribRoth, true);
  assert.equal("yearlyData" in savedData, false);
  assert.deepEqual(savedData.person.retirement, { age: 60 });
  assert.equal("brackets" in savedData.tax, false);
});

test("FICA applies the wage cap and additional Medicare rate", () => {
  assert.equal(
    calculator.calculateFica(
      250_000,
      2026,
      stateWithFilingStatus("single"),
    ),
    15_514,
  );
});

test("ordinary income tax applies the standard deduction and progressive brackets", () => {
  const state = {
    data: {
      tax: {
        filingStatus: "single",
        brackets: [],
      },
      person: {
        age: 50 + (new Date().getFullYear() - 2026),
        deceased: { age: 90 },
      },
    },
  };
  assert.equal(calculator.calculateOrdinaryIncomeTaxForYear(state, 50_000, 2026), 3_820);
});

test("capital gains use ordinary income to determine the zero-rate space", () => {
  const state = {
    data: {
      inflation: 2,
      tax: {
        filingStatus: "single",
        brackets: [],
        state: { afterRetirement: 0 },
      },
      person: {
        age: 70 + (new Date().getFullYear() - 2026),
        retirement: { age: 65 + (new Date().getFullYear() - 2026) },
        deceased: { age: 90 },
      },
    },
  };
  assert.equal(
    calculator.calculateCapitalGainTax({
      age: state.data.person.age,
      year: 2026,
      taxableIncome: 30_000,
      investmentWithdrawal: 20_000,
      state,
    }),
    0,
  );
  assert.equal(
    calculator.calculateCapitalGainTax({
      age: state.data.person.age,
      year: 2026,
      taxableIncome: 100_000,
      investmentWithdrawal: 20_000,
      state,
    }),
    1_500,
  );
});

test("employer match is calculated once across traditional and Roth deferrals", () => {
  assert.equal(calculator.calculateEmployerMatch(6, 6, 50, 6), 3);
});

test("shared employer match is allocated by traditional and Roth deferrals", () => {
  const rothOnlyMatch = calculator.calculateEmployerMatchAllocation(0, 8, 50, 6);
  const traditionalOnlyMatch = calculator.calculateEmployerMatchAllocation(
    8,
    0,
    50,
    6,
  );
  assert.deepEqual(
    calculator.calculateEmployerMatchAllocation(8, 8, 50, 6),
    { traditional: 1.5, roth: 1.5 },
  );
  assert.deepEqual(
    rothOnlyMatch,
    { traditional: 0, roth: 3 },
  );
  assert.deepEqual(traditionalOnlyMatch, { traditional: 3, roth: 0 });
  assert.equal(8 + rothOnlyMatch.roth, 8 + traditionalOnlyMatch.traditional);
});

test("employer match is zero when there are no eligible employee deferrals", () => {
  assert.equal(calculator.calculateEmployerMatch(0, 0, 50, 6), 0);
});

test("RMD is based on the prior year-end balance and applicable divisor", () => {
  assert.equal(
    calculator.calculateRequiredMinimumDistribution(255_000, 25.5),
    10_000,
  );
});

test("RMD cannot exceed a negative balance or divide by an invalid divisor", () => {
  assert.equal(calculator.calculateRequiredMinimumDistribution(-1, 25.5), 0);
  assert.equal(calculator.calculateRequiredMinimumDistribution(10_000, 0), 0);
});

test("RMD cash first funds current expenses and any excess remains an asset", () => {
  assert.deepEqual(
    calculator.allocateRequiredDistribution(6_000, 4_000),
    {
      rmdUsedForSpending: 4_000,
      surplusRmd: 2_000,
      remainingCashNeeded: 0,
    },
  );
});

test("RMD above spending is retained as taxable investment assets", () => {
  assert.deepEqual(
    calculator.allocateRequiredDistribution(4_000, 6_000),
    {
      rmdUsedForSpending: 4_000,
      surplusRmd: 0,
      remainingCashNeeded: 2_000,
    },
  );
});

test("remaining-year cash flow prorates annual amounts only once", () => {
  assert.equal(
    calculator.calculateCashFlowForPeriod({
      annualSalary: 100_000,
      annualPretaxEmployeeContribution: 6_000,
      annualRothEmployeeContribution: 4_000,
      annualSpending: 40_000,
      annualSocialSecurity: 0,
      annualTaxes: 20_000,
      monthsLeft: 0.5,
      additionalPeriodExpenses: 1_000,
    }),
    14_000,
  );
});

test("working-year investment flow receives the full RMD after salary cash flow", () => {
  assert.equal(
    calculator.calculateInvestmentYearEndChange({
      isWorking: true,
      investmentCashFlow: 15_000,
      rmd: 10_000,
      rmdSurplus: 0,
      cashNeeded: 20_000,
    }),
    25_000,
  );
});

test("retirement investment flow includes RMD surplus and excess Social Security", () => {
  assert.equal(
    calculator.calculateInvestmentYearEndChange({
      isWorking: false,
      investmentCashFlow: 0,
      rmd: 10_000,
      rmdSurplus: 2_000,
      cashNeeded: -3_000,
    }),
    5_000,
  );
});

test("remaining-year fraction preserves the exact number of months", () => {
  const now = new Date();
  assert.equal(
    calculator.calculatePercentOfMonthsLeftInYear(now.getFullYear()),
    (12 - now.getMonth()) / 12,
  );
  assert.equal(
    calculator.calculatePercentOfMonthsLeftInYear(now.getFullYear() + 1),
    1,
  );
});

test("Medicare annual premiums use the selected coverage year's schedule and eligible count", () => {
  const state = {
    data: {
      tax: { filingStatus: "single" },
      medicare: { premiums: [] },
      person: { age: 65, deceased: { age: 90 } },
    },
  };
  assert.equal(
    calculator.calculateMedicareAnnualPremium(0, 2026, 1, state),
    202.9 * 12,
  );
});

test("Medicare IRMAA uses the coverage-year tier thresholds", () => {
  const state = {
    data: {
      tax: { filingStatus: "single" },
      medicare: { premiums: [] },
      person: { age: 65, deceased: { age: 90 } },
    },
  };
  assert.equal(
    calculator.calculateMedicareAnnualPremium(110_000, 2026, 1, state),
    284.1 * 12,
  );
});

test("Medicare annual premiums account for two eligible people and a partial year", () => {
  const state = {
    data: {
      tax: { filingStatus: "marriedFilingJointly" },
      medicare: { premiums: [] },
      person: { age: 65, deceased: { age: 90 } },
    },
  };
  assert.equal(
    calculator.calculateMedicareAnnualPremium(0, 2026, 2, state, 6),
    202.9 * 2 * 6,
  );
});

test("Medicare uses modeled MAGI from two years before when it is available", () => {
  assert.equal(
    calculator.getMedicareLookbackMagi(
      2030,
      [{ year: 2028, magi: 91_000 }],
    ),
    91_000,
  );
});

test("Medicare falls back to the closest projected MAGI when the lookback year is missing", () => {
  assert.equal(
    calculator.getMedicareLookbackMagi(2026, [
      { year: 2022, magi: 52_000 },
      { year: 2026, magi: 91_000 },
    ]),
    52_000,
  );
});

test("Medicare uses the base-premium fallback when no projected MAGI exists", () => {
  assert.equal(calculator.getMedicareLookbackMagi(2026, []), null);
});
