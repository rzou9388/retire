import { TAX, CONFIG } from "./constants.js";
import { toDollar, toPercent } from "./formatters.js";

export function calculateTotal401kWithMatch(
  employeePercent,
  employerPercent,
  matchUpToPercent,
) {
  const adjustedEmployeePercent =
    employeePercent > matchUpToPercent ? matchUpToPercent : employeePercent;
  return employeePercent + adjustedEmployeePercent * (employerPercent / 100);
}

export function calculatePercentOfMonthsLeftInYear(year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (Number(year) !== currentYear) return 1;
  const currentMonthIndex = now.getMonth();
  const monthsLeftIncludingCurrent = 12 - currentMonthIndex;
  return Math.round((monthsLeftIncludingCurrent / 12) * 100) / 100;
}

export function calculateGain(ignoreRate, amount, rate) {
  if (ignoreRate) return amount;
  if (amount < 0) return amount;
  return amount * (1 + rate / 100);
}

export function calculateInsuranceSpendingForYear(spending, inflation, year) {
  let ins = spending.insurance;
  for (let y = new Date().getFullYear() + 1; y <= year; y++) {
    ins = ins * (1 + inflation / 100);
  }
  return ins;
}

export function calculateSSBenefits(person, inflation, age) {
  if (age < person.ss.age) return 0;

  let yearlySs = person.ss.perMonth * 12;
  for (let i = person.ss.age + 1; i <= age; i++) {
    yearlySs = yearlySs * (1 + inflation / 100);
  }
  return yearlySs;
}

export function calculateSSToTax(otherIncome, ss) {
  const provisionalIncome = otherIncome + ss / 2;
  if (provisionalIncome < TAX.SS_LOWER) return 0;
  if (provisionalIncome < TAX.SS_UPPER) return ss * TAX.SS_RATE_LOWER;
  return ss * TAX.SS_RATE_UPPER;
}

export function getRowTitle(age, state) {
  let title = "";
  switch (age) {
    case state.data.person.retirement.age:
      title = "Retirement starts";
      break;
    case state.data.rmd.age:
      title = "Required Minimum Distribution starts";
      break;
    case state.data.medicare.age:
      title = "Medicare starts";
      break;
    case state.data.person.ss.age:
      title = "Social Security benefit starts";
      break;
    case state.data.rothConversion.age:
      title = "Roth Conversion starts";
      break;
    case state.data.noPenaltyWithdraw.age:
      title =
        "Penalty free withdraw from pretax accounts starts, your spendings will be taken from pretax accounts first";
      break;
  }
  return title;
}

export function calculateCapitalGainTax({
  age,
  year,
  tax,
  k401kWithdraw,
  spendingAmount,
  investment,
  state,
}) {
  if (age < state.data.person.retirement.age) return 0;
  if (age >= state.data.noPenaltyWithdraw.age) return 0;

  const investmentWithdraws =
    (spendingAmount + tax + spendingAmount * 0.15) / 2;
  const taxable = k401kWithdraw + investmentWithdraws;

  if (investment < investmentWithdraws) return 0;

  let newTax = 0;
  const noTaxCeiling = getCapitalGain0TaxCeiling(year, state.data.inflation);
  if (taxable > noTaxCeiling) {
    newTax += investmentWithdraws * 0.15;
  }
  if (taxable > 250000) {
    if (k401kWithdraw >= 250000) {
      newTax += (investmentWithdraws - 250000) * 0.038;
    } else {
      newTax += (250000 - k401kWithdraw + investmentWithdraws) * 0.038;
    }
  }
  newTax += investmentWithdraws * (state.data.tax.state.afterRetirement / 100);
  return newTax;
}

export function getCapitalGain0TaxCeiling(year, inflation) {
  const ceilingIncreaseRate = inflation / 100;
  let newCeiling = CONFIG.CAPITAL_GAIN_CEILING_2026;
  for (let i = 0; i < year - 2026; i++) {
    newCeiling = newCeiling * (1 + ceilingIncreaseRate);
  }
  return newCeiling;
}

export function getFicaSSTaxCeiling(year) {
  const ssrCeiling2026 = CONFIG.FICA_SS_CEILING_2026;
  const ssrCeilingIncreaseRate = CONFIG.FICA_SS_CEILING_INCREASE;

  let sum = ssrCeiling2026;
  for (let i = 0; i < year - 2026; i++) {
    sum = sum * (1 + ssrCeilingIncreaseRate);
  }
  return sum;
}

export function calculateFica(salary, year) {
  const ssRate = TAX.FICA_SS_RATE;
  const medicareRate = TAX.FICA_MEDICARE_RATE;
  const medicareCeiling = TAX.FICA_MEDICARE_CEILING;
  const medicareRateOverCeiling = TAX.FICA_MEDICARE_RATE_OVER;
  const ssTaxCeiling = getFicaSSTaxCeiling(year);

  let fica = 0;
  if (salary > ssTaxCeiling) {
    fica += ssTaxCeiling * ssRate;
  } else {
    fica += salary * ssRate;
  }

  if (salary <= medicareCeiling) {
    fica += salary * medicareRate;
  } else {
    fica += medicareCeiling * medicareRate;
    fica += (salary - medicareCeiling) * medicareRateOverCeiling;
  }
  return fica;
}

export function getMedicarePremiumsByMagi(magi, year, state) {
  const premiums = getMedicarePremiumsForYear(year, state);
  let premium = premiums.data[0].monthly;
  for (let p of premiums.data) {
    if (magi >= p.ceiling) {
      premium = p.monthly;
      break;
    }
  }
  return premium;
}

export function getMedicarePremiumsForYear(year, state) {
  if (
    !state.data.medicare.premiums ||
    state.data.medicare.premiums.length === 0
  ) {
    estimateMedicarePremiumsForAllYears(state);
  }
  return state.data.medicare.premiums.find((y) => y.year === year);
}

export function estimateMedicarePremiumsForAllYears(state) {
  state.data.medicare.premiums = [];
  const premiumIncreaseRate = CONFIG.MEDICARE_PREMIUM_INCREASE;
  const ceilingIncreaseRate = CONFIG.MEDICARE_CEILING_INCREASE;
  const premium2026 = [
    { ceiling: 218000, monthly: 202.9 },
    { ceiling: 274000, monthly: 284.1 },
    { ceiling: 342000, monthly: 405.8 },
    { ceiling: 410000, monthly: 527.5 },
    { ceiling: 749000, monthly: 649.2 },
    { ceiling: 1000000, monthly: 689.9 },
  ];
  state.data.medicare.premiums.push({ year: 2026, data: premium2026 });

  const deceaseYear =
    new Date().getFullYear() +
    (state.data.person.deceased.age - state.data.person.age);
  for (let i = state.data.medicare.premiums[0].year + 1; i < deceaseYear; i++) {
    const previousPremium = state.data.medicare.premiums.find(
      (x) => x.year === i - 1,
    ).data;
    const newPremium = previousPremium.map((x) => ({
      ceiling: x.ceiling * (1 + ceilingIncreaseRate),
      monthly: x.monthly * (1 + premiumIncreaseRate),
    }));
    state.data.medicare.premiums.push({ year: i, data: newPremium });
  }
}

export function calculateTaxBracketsForAllYear(state, year) {
  if (state.data.tax.brackets && state.data.tax.brackets.length !== 0) return;

  const r = CONFIG.TAX_BRACKET_INCREASE;
  const b2026Data = [
    { percent: 12, income: 100800 },
    { percent: 22, income: 211400 },
    { percent: 24, income: 403550 },
    { percent: 32, income: 512450 },
    { percent: 35, income: 768700 },
    { percent: 37, income: 1000000 },
  ];

  const b2026 = {
    year: 2026,
    standardDeduction: 32200,
    data: b2026Data,
  };

  state.data.tax.brackets = [b2026];
  let extra65standardDeduction = 3300;
  for (let i = 2026; i < 2026 + state.data.person.deceased.age; i++) {
    const newdata = state.data.tax.brackets[
      state.data.tax.brackets.length - 1
    ].data.map((x) => ({
      percent: x.percent,
      income: Math.round(x.income * (1 + r)),
    }));
    let standardDeduction =
      state.data.tax.brackets[state.data.tax.brackets.length - 1]
        .standardDeduction *
      (1 + r);

    const age = state.data.person.age + (year - new Date().getFullYear());
    if ((i > 2026) & (age <= 65)) {
      extra65standardDeduction *= 1 + r;
      if (age === 65) {
        standardDeduction += extra65standardDeduction;
      }
    }

    state.data.tax.brackets.push({
      year: i,
      standardDeduction,
      data: newdata,
    });
  }
}

export function getTaxBracketsForYear(state, year) {
  calculateTaxBracketsForAllYear(state, year);
  try {
    return state.data.tax.brackets.find((x) => x.year === year);
  } catch (ex) {
    console.error("year=", year, "ex=", ex);
  }
}

export function getIncomeForBracketAndYear(state, year, bracketRate) {
  bracketRate = Number(bracketRate);
  if (bracketRate === 0) return 0;

  const brackets = getTaxBracketsForYear(state, year).data;
  let bracket = brackets.find((x) => x.percent === bracketRate);
  if (bracket == null) {
    let i = 0;
    for (i = 0; i < brackets.length; i++) {
      if (brackets[i].percent > bracketRate) break;
    }
    bracket = brackets[i + 1];
  }
  return bracket.income;
}

export function calculateOrdinaryIncomeTaxForYear(state, income, year) {
  const taxData = getTaxBracketsForYear(state, year);
  const brackets = taxData.data;
  const standardDeduction =
    taxData.standardDeduction > income ? income : taxData.standardDeduction;

  income = income - standardDeduction;
  let sum = 0;
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    if (income > bracket.income) {
      let tax = (bracket.percent / 100) * bracket.income;
      sum += tax;
      income = income - bracket.income;
    } else {
      let tax = (bracket.percent / 100) * income;
      sum += tax;
      return sum;
    }
  }
  return sum;
}
