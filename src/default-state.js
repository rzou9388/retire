export const UNIFORM_LIFETIME_TABLE = [
  [72, 27.4],
  [73, 26.5],
  [74, 25.5],
  [75, 24.6],
  [76, 23.7],
  [77, 22.9],
  [78, 22],
  [79, 21.1],
  [80, 20.2],
  [81, 19.4],
  [82, 18.5],
  [83, 17.7],
  [84, 16.8],
  [85, 16],
  [86, 15.2],
  [87, 14.4],
  [88, 13.7],
  [89, 12.9],
  [90, 12.2],
  [91, 11.5],
  [92, 10.8],
  [93, 10.1],
  [94, 9.5],
  [95, 8.9],
  [96, 8.4],
  [97, 7.8],
  [98, 7.3],
  [99, 6.8],
  [100, 6.4],
];

export function createDefaultAppState() {
  return {
    activeSummaryTab: "current",
    summaryTabs: [
      { id: "current", label: "Current Year" },
      { id: "retirement", label: "Retirement Year" },
      { id: "withdraw", label: "Penalty Free Withdraw Year" },
      { id: "rmd", label: "Required Minimum Distribution Year" },
      { id: "end", label: "End of Life Year" },
    ],
    data: {
      columns: {
        age: true,
        year: true,
        salary: true,
        contrib: true,
        contribRoth: false,
        rmd: true,
        spending: true,
        conversionAmount: true,
        pretax: true,
        roth: true,
        investment: true,
        ss: true,
        medicare: true,
        tax: true,
        netWorth: true,
      },
      yearlyData: [],
      spending: {
        beforeRetirement: 80000,
        afterRetirement: 70000,
        insurance: 20000,
      },
      annualReturn: { beforeRetirement: 12, afterRetirement: 6 },
      rothConversion: { age: 60, amount: 0, bracket: 12, offset: 0 },
      rothConversion2: {
        age: 70,
        amount: 0,
        bracket: 12,
        offset: 0,
      },
      noPenaltyWithdraw: { age: 60 },
      inflation: 2.8,
      meritIncrease: 2,
      medicare: { age: 65, premiums: [] },
      rmd: {
        age: 75,
        pretaxBalance: 0,
        year: 0,
        lifetimeTable: UNIFORM_LIFETIME_TABLE,
      },
      contrib: {
        employeePercent: 6,
        employerPercent: 50,
        totalPercent: 0,
        roth401kPercent: 0,
        rothTotalPercent: 0,
        employerMatchUpTo: 6,
      },
      person: {
        age: 50,
        pretaxBalance: 500000,
        salary: 150000,
        retirement: {
          age: 60,
          year: 0,
          salary: 0,
          pretaxBalance: 0,
        },
        deceased: {
          age: 88,
        },
        investment: 100000,
        roth: 100000,
        ss: { age: 62, perMonth: 3000 },
      },
      tax: {
        brackets: [],
        state: { beforeRetirement: 5, afterRetirement: 0 },
      },
    },
  };
}

export function loadInitialAppState() {
  const savedData = JSON.parse(localStorage.getItem("data"));
  if (savedData) {
    savedData.tax.brackets = [];
    savedData.medicare.premiums = [];
    savedData.yearlyData = [];
    return { data: savedData };
  }
  return createDefaultAppState();
}
