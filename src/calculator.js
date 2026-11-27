import { TAX, CONFIG, getFilingStatus } from "./constants.js";
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

export function calculateEmployerMatch(
  employeePercent,
  rothEmployeePercent,
  employerPercent,
  matchUpToPercent,
) {
  const eligibleDeferrals =
    Math.max(Number(employeePercent) || 0, 0) +
    Math.max(Number(rothEmployeePercent) || 0, 0);
  const matchRate = Math.max(Number(employerPercent) || 0, 0) / 100;
  const matchLimit = Math.max(Number(matchUpToPercent) || 0, 0);
  return Math.min(eligibleDeferrals, matchLimit) * matchRate;
}

export function calculateEmployerMatchAllocation(
  employeePercent,
  rothEmployeePercent,
  employerPercent,
  matchUpToPercent,
) {
  const traditionalDeferrals = Math.max(Number(employeePercent) || 0, 0);
  const rothDeferrals = Math.max(Number(rothEmployeePercent) || 0, 0);
  const totalDeferrals = traditionalDeferrals + rothDeferrals;
  const totalMatch = calculateEmployerMatch(
    traditionalDeferrals,
    rothDeferrals,
    employerPercent,
    matchUpToPercent,
  );

  if (totalDeferrals === 0) {
    return { traditional: 0, roth: 0 };
  }

  return {
    traditional: (totalMatch * traditionalDeferrals) / totalDeferrals,
    roth: (totalMatch * rothDeferrals) / totalDeferrals,
  };
}

export function calculateRequiredMinimumDistribution(balance, divisor) {
  const normalizedBalance = Math.max(Number(balance) || 0, 0);
  const normalizedDivisor = Number(divisor);
  return normalizedDivisor > 0
    ? normalizedBalance / normalizedDivisor
    : 0;
}

export function allocateRequiredDistribution(rmd, cashNeeded) {
  const distribution = Math.max(Number(rmd) || 0, 0);
  const cashRequirement = Math.max(Number(cashNeeded) || 0, 0);
  const rmdUsedForSpending = Math.min(distribution, cashRequirement);
  return {
    rmdUsedForSpending,
    surplusRmd: distribution - rmdUsedForSpending,
    remainingCashNeeded: cashRequirement - rmdUsedForSpending,
  };
}

export function calculateCashFlowForPeriod({
  annualSalary,
  annualPretaxEmployeeContribution,
  annualRothEmployeeContribution,
  annualSpending,
  annualSocialSecurity,
  annualTaxes,
  monthsLeft,
  additionalPeriodExpenses,
}) {
  const fraction = Math.min(Math.max(Number(monthsLeft) || 0, 0), 1);
  return (
    (Number(annualSalary) || 0) -
    (Number(annualPretaxEmployeeContribution) || 0) -
    (Number(annualRothEmployeeContribution) || 0) -
    (Number(annualSpending) || 0) +
    (Number(annualSocialSecurity) || 0) -
    (Number(annualTaxes) || 0)
  ) * fraction - Math.max(Number(additionalPeriodExpenses) || 0, 0);
}

export function calculateInvestmentYearEndChange({
  isWorking,
  investmentCashFlow,
  rmd,
  rmdSurplus,
  cashNeeded,
}) {
  if (isWorking) {
    return (Number(investmentCashFlow) || 0) + (Number(rmd) || 0);
  }
  return (
    (Number(rmdSurplus) || 0) +
    Math.max(-(Number(cashNeeded) || 0), 0)
  );
}

export function calculatePercentOfMonthsLeftInYear(year) {
  const now = new Date();
  const currentYear = now.getFullYear();
  if (Number(year) !== currentYear) return 1;
  const currentMonthIndex = now.getMonth();
  const monthsLeftIncludingCurrent = 12 - currentMonthIndex;
  return monthsLeftIncludingCurrent / 12;
}

export function calculateGain(ignoreRate, amount, rate) {
  if (ignoreRate) return amount;
  if (amount < 0) return amount;
  return amount * (1 + rate / 100);
}

export function convertToTodaysDollars(
  amount,
  year,
  inflation,
  currentYear = new Date().getFullYear(),
) {
  const numericAmount = Number(amount);
  const yearsFromToday = Number(year) - Number(currentYear);
  const inflationRate = Number(inflation) / 100;
  if (
    !Number.isFinite(numericAmount) ||
    !Number.isFinite(yearsFromToday) ||
    !Number.isFinite(inflationRate) ||
    yearsFromToday <= 0 ||
    inflationRate <= -1
  ) {
    return numericAmount;
  }
  return numericAmount / (1 + inflationRate) ** yearsFromToday;
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
  const currentAge = Number(person.age);
  if (!Number.isFinite(currentAge) || age <= currentAge) return yearlySs;

  const inflationRate = (Number(inflation) || 0) / 100;
  return yearlySs * (1 + inflationRate) ** (age - currentAge);
}

export function calculateHouseholdSSBenefits(
  person,
  spouse,
  filingStatus,
  inflation,
  age,
  spouseAge,
) {
  const personBenefits = calculateSSBenefits(person, inflation, age);
  const spouseBenefits =
    filingStatus === "marriedFilingJointly"
      ? calculateSSBenefits(spouse, inflation, spouseAge)
      : 0;
  return personBenefits + spouseBenefits;
}

export function calculateSSToTax(otherIncome, ss, state) {
  const benefits = Math.max(Number(ss) || 0, 0);
  if (benefits === 0) return 0;
  const provisionalIncome = (Number(otherIncome) || 0) + benefits / 2;
  const [lowerThreshold, upperThreshold] =
    getFilingStatus(state).socialSecurityThresholds;
  if (provisionalIncome <= lowerThreshold) return 0;

  const taxableInFirstBand = Math.min(
    benefits * TAX.SS_RATE_LOWER,
    (provisionalIncome - lowerThreshold) * TAX.SS_RATE_LOWER,
  );
  if (provisionalIncome <= upperThreshold) return taxableInFirstBand;

  const maximumFirstBandAmount = Math.min(
    benefits * TAX.SS_RATE_LOWER,
    (upperThreshold - lowerThreshold) * TAX.SS_RATE_LOWER,
  );
  return Math.min(
    benefits * TAX.SS_RATE_UPPER,
    maximumFirstBandAmount +
      (provisionalIncome - upperThreshold) * TAX.SS_RATE_UPPER,
  );
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
  const taxable = Math.max(taxableIncome - standardDeduction, 0) + taxableGain;
  const noTaxCeiling = getCapitalGain0TaxCeiling(year, state);
  const gainsAboveNoTaxCeiling = Math.min(
    taxableGain,
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

export function calculateFica(salary, year, state, spouseSalary = 0) {
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
  if (!premiums) {
    throw new Error(`No Medicare premium schedule for coverage year ${year}`);
  }
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

export function calculateMedicareAnnualPremium(
  magi,
  coverageYear,
  eligiblePeople,
  state,
  monthsCovered = 12,
) {
  const people = Math.max(Math.floor(Number(eligiblePeople) || 0), 0);
  const months = Math.min(Math.max(Number(monthsCovered) || 0, 0), 12);
  if (people === 0 || months === 0) return 0;
  const monthlyPremium = getMedicarePremiumsByMagi(
    Number.isFinite(Number(magi)) ? Number(magi) : 0,
    coverageYear,
    state,
  );
  return monthlyPremium * people * months;
}

export function getMedicareLookbackMagi(coverageYear, yearlyData) {
  const lookbackYear = coverageYear - 2;
  const projectedYears = yearlyData.filter((yearly) =>
    Number.isFinite(yearly.magi),
  );
  const closestYear = projectedYears.reduce((closest, yearly) => {
    if (!closest) return yearly;
    const candidateDistance = Math.abs(yearly.year - lookbackYear);
    const closestDistance = Math.abs(closest.year - lookbackYear);
    return candidateDistance < closestDistance ||
      (candidateDistance === closestDistance && yearly.year < closest.year)
      ? yearly
      : closest;
  }, null);
  return closestYear?.magi ?? null;
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

  const deceaseYear =
    new Date().getFullYear() +
    (state.data.person.deceased.age - state.data.person.age);
  for (let i = state.data.medicare.premiums[0].year + 1; i <= deceaseYear; i++) {
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
    state.data.person.spouse?.age,
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
  const currentYear = new Date().getFullYear();
  const getAdditionalStandardDeduction = (targetYear) => {
    const yearsFromNow = targetYear - currentYear;
    const primaryAge = state.data.person.age + yearsFromNow;
    const spouseAge = state.data.person.spouse?.age + yearsFromNow;
    const eligiblePeople =
      Number(primaryAge >= 65) +
      Number(
        filingStatus === "marriedFilingJointly" && spouseAge >= 65,
      );
    const amountPerEligiblePerson =
      status.additionalStandardDeduction2026 /
      (filingStatus === "marriedFilingJointly" ? 2 : 1);
    return eligiblePeople * amountPerEligiblePerson;
  };

  const b2026 = {
    year: 2026,
    standardDeduction:
      status.standardDeduction2026 + getAdditionalStandardDeduction(2026),
    data: b2026Data,
  };

  state.data.tax.brackets = [b2026];
  const lastYear = Math.max(2026 + state.data.person.deceased.age, year);
  for (let i = 2027; i <= lastYear; i++) {
    const previous = state.data.tax.brackets.at(-1);
    const newdata = previous.data.map((x) => ({
      percent: x.percent,
      income: Number.isFinite(x.income)
        ? Math.round(x.income * (1 + r))
        : x.income,
    }));
    const yearsSince2026 = i - 2026;

    state.data.tax.brackets.push({
      year: i,
      standardDeduction:
        (status.standardDeduction2026 + getAdditionalStandardDeduction(i)) *
        (1 + r) ** yearsSince2026,
      data: newdata,
    });
  }
  state.data.tax.bracketsCacheKey = cacheKey;
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
