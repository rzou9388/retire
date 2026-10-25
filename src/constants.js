export const TAX = {
  SS_RATE_LOWER: 0.5,
  SS_RATE_UPPER: 0.85,
  FICA_SS_RATE: 0.062,
  FICA_MEDICARE_RATE: 0.0145,
  FICA_MEDICARE_RATE_OVER: 0.0235,
  CAPITAL_GAIN_RATE: 0.15,
  MEDICARE_SURTAX_RATE: 0.038,
};

export const CONFIG = {
  MEDICARE_PREMIUM_INCREASE: 0.055,
  MEDICARE_CEILING_INCREASE: 0.042,
  FICA_SS_CEILING_2026: 184500,
  FICA_SS_CEILING_INCREASE: 0.0492,
  TAX_BRACKET_INCREASE: 0.016,
};

export const FILING_STATUSES = {
  marriedFilingJointly: {
    label: "Married filing jointly",
    standardDeduction2026: 32200,
    additionalStandardDeduction2026: 3300,
    socialSecurityThresholds: [32000, 44000],
    capitalGain0TaxCeiling2026: 98900,
    medicareSurtaxThreshold: 250000,
    medicarePremiumThresholds2026: [218000, 274000, 342000, 410000, 750000],
    additionalMedicareTaxThreshold: 250000,
    taxBrackets2026: [
      { percent: 10, income: 24800 },
      { percent: 12, income: 100800 },
      { percent: 22, income: 211400 },
      { percent: 24, income: 403550 },
      { percent: 32, income: 512450 },
      { percent: 35, income: 768700 },
      { percent: 37, income: Number.POSITIVE_INFINITY },
    ],
  },
  single: {
    label: "Single",
    standardDeduction2026: 16100,
    additionalStandardDeduction2026: 2050,
    socialSecurityThresholds: [25000, 34000],
    capitalGain0TaxCeiling2026: 49450,
    medicareSurtaxThreshold: 200000,
    medicarePremiumThresholds2026: [109000, 137000, 171000, 205000, 500000],
    additionalMedicareTaxThreshold: 200000,
    taxBrackets2026: [
      { percent: 10, income: 12400 },
      { percent: 12, income: 50400 },
      { percent: 22, income: 105700 },
      { percent: 24, income: 201775 },
      { percent: 32, income: 256225 },
      { percent: 35, income: 640600 },
      { percent: 37, income: Number.POSITIVE_INFINITY },
    ],
  },
  headOfHousehold: {
    label: "Head of household",
    standardDeduction2026: 24150,
    additionalStandardDeduction2026: 2050,
    socialSecurityThresholds: [25000, 34000],
    capitalGain0TaxCeiling2026: 66200,
    medicareSurtaxThreshold: 200000,
    medicarePremiumThresholds2026: [109000, 137000, 171000, 205000, 500000],
    additionalMedicareTaxThreshold: 200000,
    taxBrackets2026: [
      { percent: 10, income: 17700 },
      { percent: 12, income: 67450 },
      { percent: 22, income: 105700 },
      { percent: 24, income: 201775 },
      { percent: 32, income: 256225 },
      { percent: 35, income: 640600 },
      { percent: 37, income: Number.POSITIVE_INFINITY },
    ],
  },
};

export function getFilingStatus(state) {
  return (
    FILING_STATUSES[state.data.tax.filingStatus] ??
    FILING_STATUSES.marriedFilingJointly
  );
}
