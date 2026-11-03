import { TAX, CONFIG, getFilingStatus } from "./constants.js";
import { toDollar, toPercent } from "./formatters.js";

export function calculateTotal401kWithMatch(
  employeePercent,
  employerPercent,
  matchUpToPercent,
) {
  employeePercent = Number(employeePercent) || 0;
  employerPercent = Number(employerPercent) || 0;
  matchUpToPercent = Number(matchUpToPercent) || 0;
  const adjustedEmployeePercent =
    employeePercent > matchUpToPercent ? matchUpToPercent : employeePercent;
  return employeePercent + adjustedEmployeePercent * (employerPercent / 100);
}

/**
 * Split an employer match across pre-tax and Roth contributions.
 *
 * The match is earned on the employee's *combined* contribution up to
 * matchUpToPercent. Computing it separately for the pre-tax and Roth plans
 * (the old behavior) double-counts the employer match whenever the employee
 * contributes to both plans.
 */
export function calculateContributionRates(
  pretaxPercent,
  rothPercent,
  employerPercent,
  matchUpToPercent,
) {
  pretaxPercent = Number(pretaxPercent) || 0;
  rothPercent = Number(rothPercent) || 0;
  employerPercent = Number(employerPercent) || 0;
  matchUpToPercent = Number(matchUpToPercent) || 0;

  const employeeTotal = pretaxPercent + rothPercent;
  const matchedPercent = Math.min(employeeTotal, matchUpToPercent);
  const employerMatch = matchedPercent * (employerPercent / 100);
  const pretaxShare =
    employeeTotal > 0 ? pretaxPercent / employeeTotal : 0;

  return {
    totalPercent: pretaxPercent + employerMatch * pretaxShare,
    rothTotalPercent: rothPercent + employerMatch * (1 - pretaxShare),
  };
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

export function calculateSSToTax(otherIncome, ss, state) {
  const provisionalIncome = otherIncome + ss / 2;
  const [lowerThreshold, upperThreshold] =
    getFilingStatus(state).socialSecurityThresholds;

  // IRS Pub. 915 formula:
  //   up to 50% of benefits are taxable in the lower band, plus 85% of the
  //   excess provisional income above the upper threshold, capped at 85% of
  //   total benefits. The old step function (0% / 50% / 85% of all benefits)
  //   substantially overstated the tax just above each threshold.
  const lowerBandIncome = Math.max(
    Math.min(provisionalIncome, upperThreshold) - lowerThreshold,
    0,
  );
  const taxableBenefits =
    Math.min(lowerBandIncome * TAX.SS_RATE_LOWER, ss * TAX.SS_RATE_LOWER) +
    Math.max(provisionalIncome - upperThreshold, 0) * TAX.SS_RATE_UPPER;

  return Math.min(taxableBenefits, ss * TAX.SS_RATE_UPPER);
}

export function getRowTitle(age, state) {
  const currentAge = Number(age);
  const milestones = [
    [state.data.person.retirement.age, "Retirement starts"],
    [state.data.rmd.age, "Required Minimum Distribution starts"],
    [state.data.medicare.age, "Medicare starts"],
    [state.data.person.ss.age, "Social Security benefit starts"],
    [state.data.rothConversion.age, "Roth Conversion starts"],
    [
      state.data.noPenaltyWithdraw.age,
      "Penalty free withdraw from pretax accounts starts, your spendings will be taken from pretax accounts first",
    ],
  ];
  return (
    milestones.find(([milestoneAge]) => Number(milestoneAge) === currentAge)?.[1] ??
    ""
  );
}

export function calculateCapitalGainTax({
  age,
  year,
  taxableIncome,
  investmentWithdrawal,
  state,
}) {
  if (age < state.data.person.retirement.age) return 0;
  if (investmentWithdrawal <= 0) return 0;

  const taxableGain = investmentWithdrawal / 2;
  const adjustedGrossIncome = taxableIncome + taxableGain;
  const standardDeduction =
    getTaxBracketsForYear(state, year).standardDeduction;
  // A standard deduction that is not used up by ordinary income also shelters
  // capital gains. The old code applied the full deduction to ordinary income
  // but ignored any unused part, overtaxing gains in low-income years.
  const unusedStandardDeduction = Math.max(
    standardDeduction - taxableIncome,
    0,
  );
  const taxableGainAfterDeduction = Math.max(
    taxableGain - unusedStandardDeduction,
    0,
  );
  const taxable = Math.max(taxableIncome - standardDeduction, 0) + taxableGainAfterDeduction;
  const noTaxCeiling = getCapitalGain0TaxCeiling(year, state);
  const gainsAboveNoTaxCeiling = Math.min(
    taxableGainAfterDeduction,
    Math.max(taxable - noTaxCeiling, 0),
  );
  const gainsSubjectToMedicareSurtax = Math.min(
    taxableGain,
    Math.max(
      adjustedGrossIncome - getFilingStatus(state).medicareSurtaxThreshold,
      0,
    ),
  );

  return (
    gainsAboveNoTaxCeiling * TAX.CAPITAL_GAIN_RATE +
    gainsSubjectToMedicareSurtax * TAX.MEDICARE_SURTAX_RATE +
    taxableGain * (state.data.tax.state.afterRetirement / 100)
  );
}

export function getCapitalGain0TaxCeiling(year, state) {
  const ceilingIncreaseRate = state.data.inflation / 100;
  let newCeiling = getFilingStatus(state).capitalGain0TaxCeiling2026;
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

/**
 * Additional 10% tax on pre-tax withdrawals taken before the penalty-free
 * age. Applied to the amount actually withdrawn for spending/taxes.
 */
export function calculateEarlyWithdrawalPenalty(
  pretaxWithdrawal,
  age,
  penaltyFreeAge,
) {
  if (age >= penaltyFreeAge) return 0;
  return Math.max(Number(pretaxWithdrawal) || 0, 0) *
    TAX.EARLY_WITHDRAWAL_PENALTY_RATE;
}

export function calculateFica(salary, year, state, spouseSalary = 0) {
  salary = Number(salary) || 0;
  spouseSalary = Number(spouseSalary) || 0;
  const ssRate = TAX.FICA_SS_RATE;
  const medicareRate = TAX.FICA_MEDICARE_RATE;
  const medicareCeiling = getFilingStatus(state).additionalMedicareTaxThreshold;
  const medicareRateOverCeiling = TAX.FICA_MEDICARE_RATE_OVER;
  const ssTaxCeiling = getFicaSSTaxCeiling(year);

  let fica = 0;
  fica +=
    (Math.min(salary, ssTaxCeiling) + Math.min(spouseSalary, ssTaxCeiling)) *
    ssRate;

  const combinedSalary = salary + spouseSalary;
  if (combinedSalary <= medicareCeiling) {
    fica += combinedSalary * medicareRate;
  } else {
    fica += medicareCeiling * medicareRate;
    fica += (combinedSalary - medicareCeiling) * medicareRateOverCeiling;
  }
  return fica;
}

export function getMedicarePremiumsByMagi(magi, year, state) {
  const premiums = getMedicarePremiumsForYear(year, state);
  let premium = premiums.data[0].monthly;
  for (const p of premiums.data.slice(1)) {
    if (magi >= p.ceiling) {
      premium = p.monthly;
    } else {
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
  const premiums = state.data.medicare.premiums;
  const match = premiums.find((y) => y.year === year);
  if (match) return match;
  // IRMAA looks up MAGI two years back. Early in the projection that year can
  // predate 2026 (the first projected premium year), and a plan whose end is
  // beyond the generated range can run past the last year. Fall back to the
  // nearest available table instead of returning undefined (which used to
  // throw and abort the whole calculation).
  return Number(year) < premiums[0].year ? premiums[0] : premiums.at(-1);
}

export function estimateMedicarePremiumsForAllYears(state) {
  state.data.medicare.premiums = [];
  const premiumIncreaseRate = CONFIG.MEDICARE_PREMIUM_INCREASE;
  const ceilingIncreaseRate = CONFIG.MEDICARE_CEILING_INCREASE;
  const irmaaThresholds =
    getFilingStatus(state).medicarePremiumThresholds2026;
  const premium2026 = [
    { ceiling: 0, monthly: 202.9 },
    { ceiling: irmaaThresholds[0], monthly: 284.1 },
    { ceiling: irmaaThresholds[1], monthly: 405.8 },
    { ceiling: irmaaThresholds[2], monthly: 527.5 },
    { ceiling: irmaaThresholds[3], monthly: 649.2 },
    { ceiling: irmaaThresholds[4], monthly: 689.9 },
  ];
  state.data.medicare.premiums.push({ year: 2026, data: premium2026 });

  const currentYear = new Date().getFullYear();
  const personAge = Number(state.data.person.age);
  const deceasedAge = Number(state.data.person.deceased.age);
  const yearsToDeath =
    Number.isFinite(personAge) && Number.isFinite(deceasedAge)
      ? Math.max(Math.min(deceasedAge - personAge, CONFIG.MAX_AGE), 0)
      : CONFIG.MAX_AGE;
  const deceaseYear = currentYear + yearsToDeath;
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
  const filingStatus = state.data.tax.filingStatus ?? "marriedFilingJointly";
  const cacheKey = [
    filingStatus,
    state.data.person.age,
    state.data.person.deceased.age,
  ].join(":");
  if (
    state.data.tax.brackets?.length &&
    state.data.tax.bracketsCacheKey === cacheKey
  ) {
    return;
  }

  const r = CONFIG.TAX_BRACKET_INCREASE;
  const status = getFilingStatus(state);
  const b2026Data = status.taxBrackets2026;

  const b2026 = {
    year: 2026,
    standardDeduction:
      status.standardDeduction2026 +
      (Number(state.data.person.age) + (2026 - new Date().getFullYear()) >= 65
        ? status.additionalStandardDeduction2026
        : 0),
    data: b2026Data,
  };

  state.data.tax.brackets = [b2026];
  const currentYear = new Date().getFullYear();
  const personAge = Number(state.data.person.age);
  const deceasedAge = Number(state.data.person.deceased.age);
  // Generate brackets through the projected year of death. The old formula
  // (2026 + age at death) produced a date ~70 years beyond the simulation.
  const deathYear =
    Number.isFinite(personAge) && Number.isFinite(deceasedAge)
      ? currentYear + Math.max(Math.min(deceasedAge - personAge, CONFIG.MAX_AGE), 0)
      : currentYear + CONFIG.MAX_AGE;
  const lastYear = Math.min(Math.max(deathYear, year), currentYear + CONFIG.MAX_AGE);
  for (let i = 2027; i <= lastYear; i++) {
    const previous = state.data.tax.brackets.at(-1);
    const newdata = previous.data.map((x) => ({
      percent: x.percent,
      income: Number.isFinite(x.income)
        ? Math.round(x.income * (1 + r))
        : x.income,
    }));
    const yearsSince2026 = i - 2026;
    const ageInYear = Number(state.data.person.age) + (i - currentYear);

    state.data.tax.brackets.push({
      year: i,
      standardDeduction:
        (status.standardDeduction2026 +
          (ageInYear >= 65
            ? status.additionalStandardDeduction2026
            : 0)) *
        (1 + r) ** yearsSince2026,
      data: newdata,
    });
  }
  state.data.tax.bracketsCacheKey = cacheKey;
}

export function getTaxBracketsForYear(state, year) {
  calculateTaxBracketsForAllYear(state, year);
  try {
    return (
      state.data.tax.brackets.find((x) => x.year === year) ??
      state.data.tax.brackets.at(-1)
    );
  } catch (ex) {
    console.error("year=", year, "ex=", ex);
  }
}

export function getIncomeForBracketAndYear(state, year, bracketRate) {
  bracketRate = Number(bracketRate);
  if (bracketRate === 0) return 0;

  const taxData = getTaxBracketsForYear(state, year);
  const brackets = taxData.data;
  const bracket = brackets.find((x) => x.percent === bracketRate);
  if (bracket == null) return brackets[brackets.length - 1].income;
  return bracket.income + taxData.standardDeduction;
}

export function calculateOrdinaryIncomeTaxForYear(state, income, year) {
  const taxData = getTaxBracketsForYear(state, year);
  const brackets = taxData.data;
  income = Math.max(income - taxData.standardDeduction, 0);
  let sum = 0;
  let previousThreshold = 0;
  for (let i = 0; i < brackets.length; i++) {
    const bracket = brackets[i];
    const incomeInBracket = Math.max(
      Math.min(income, bracket.income) - previousThreshold,
      0,
    );
    sum += (bracket.percent / 100) * incomeInBracket;
    if (income <= bracket.income) return sum;
    previousThreshold = bracket.income;
  }
  return sum;
}
