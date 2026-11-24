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

const RMD_AGE = 75;

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
      investmentContributions: [],
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
      medicare: {
        age: 65,
        premiums: [],
      },
      rmd: {
        age: RMD_AGE,
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
        spouse: {
          employeePercent: 6,
          employerPercent: 50,
          totalPercent: 0,
          roth401kPercent: 0,
          rothTotalPercent: 0,
          employerMatchUpTo: 6,
        },
      },
      person: {
        age: 50,
        pretaxBalance: 500000,
        salary: 150000,
        meritIncrease: 2,
        spouse: {
          age: 50,
          salary: 0,
          meritIncrease: 2,
          ss: { age: 62, perMonth: 0 },
        },
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
        filingStatus: "marriedFilingJointly",
        brackets: [],
        state: { beforeRetirement: 5, afterRetirement: 0 },
      },
    },
  };
}

export function serializeUserData(data) {
  return {
    investmentContributions: (data.investmentContributions ?? []).map(
      ({ label, type, age, amount }) => ({ label, type, age, amount }),
    ),
    spending: { ...data.spending },
    annualReturn: { ...data.annualReturn },
    rothConversion: pickFields(data.rothConversion, [
      "age",
      "bracket",
      "offset",
    ]),
    rothConversion2: pickFields(data.rothConversion2, [
      "age",
      "bracket",
      "offset",
    ]),
    noPenaltyWithdraw: { age: data.noPenaltyWithdraw.age },
    inflation: data.inflation,
    medicare: {
      age: data.medicare.age,
    },
    rmd: { age: RMD_AGE },
    contrib: {
      employeePercent: data.contrib.employeePercent,
      employerPercent: data.contrib.employerPercent,
      roth401kPercent: data.contrib.roth401kPercent,
      employerMatchUpTo: data.contrib.employerMatchUpTo,
      spouse: {
        employeePercent: data.contrib.spouse.employeePercent,
        employerPercent: data.contrib.spouse.employerPercent,
        roth401kPercent: data.contrib.spouse.roth401kPercent,
        employerMatchUpTo: data.contrib.spouse.employerMatchUpTo,
      },
    },
    person: {
      age: data.person.age,
      pretaxBalance: data.person.pretaxBalance,
      salary: data.person.salary,
      meritIncrease: data.person.meritIncrease,
      spouse: {
        age: data.person.spouse.age,
        salary: data.person.spouse.salary,
        meritIncrease: data.person.spouse.meritIncrease,
        ss: {
          age: data.person.spouse.ss.age,
          perMonth: data.person.spouse.ss.perMonth,
        },
      },
      retirement: { age: data.person.retirement.age },
      deceased: { age: data.person.deceased.age },
      investment: data.person.investment,
      roth: data.person.roth,
      ss: { age: data.person.ss.age, perMonth: data.person.ss.perMonth },
    },
    tax: {
      filingStatus: data.tax.filingStatus ?? "marriedFilingJointly",
      state: { ...data.tax.state },
    },
  };
}

export function serializeLocalStorageData(data) {
  return {
    ...serializeUserData(data),
    columns: { ...data.columns },
  };
}

export function encodeUserDataForUrl(data) {
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function pickFields(value, fields) {
  return Object.fromEntries(fields.map((field) => [field, value[field]]));
}

function mergeWithDefaults(defaultValue, inputValue) {
  if (Array.isArray(defaultValue)) {
    return Array.isArray(inputValue) ? inputValue : defaultValue;
  }
  if (defaultValue && typeof defaultValue === "object") {
    const input =
      inputValue && typeof inputValue === "object" && !Array.isArray(inputValue)
        ? inputValue
        : {};
    return Object.fromEntries(
      Object.entries(defaultValue).map(([key, value]) => [
        key,
        mergeWithDefaults(value, input[key]),
      ]),
    );
  }
  return inputValue ?? defaultValue;
}

function loadQueryData() {
  const payload = new URLSearchParams(window.location.search).get("data");
  if (!payload) return null;

  try {
    const inputData = payload.trimStart().startsWith("{")
      ? JSON.parse(payload)
      : JSON.parse(decodeUserDataFromUrl(payload));
    if (
      !inputData ||
      typeof inputData !== "object" ||
      Array.isArray(inputData)
    ) {
      return null;
    }
    const appState = createDefaultAppState();
    appState.data = mergeWithDefaults(appState.data, inputData);
    appState.data.rmd.age = RMD_AGE;
    if (inputData.person?.spouse?.age == null) {
      appState.data.person.spouse.age = appState.data.person.age;
    }
    const url = new URL(window.location.href);
    url.searchParams.delete("data");
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    );
    return appState;
  } catch (error) {
    console.warn("Unable to load retirement data from the URL.", error);
    return null;
  }
}

function decodeUserDataFromUrl(payload) {
  if (!/^[A-Za-z0-9_-]+$/.test(payload)) {
    throw new Error("Invalid URL data encoding");
  }
  const base64 = payload.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (character) =>
    character.charCodeAt(0),
  );
  return new TextDecoder().decode(bytes);
}

export function loadInitialAppState() {
  const queryState = loadQueryData();
  if (queryState) return queryState;

  const savedData = JSON.parse(localStorage.getItem("data"));
  if (savedData) {
    const savedPerson = savedData.person ?? {};
    const savedSpouse = savedPerson.spouse ?? {};
    const legacyMeritIncrease = savedData.meritIncrease ?? 2;
    const migratedData = {
      ...savedData,
      person: {
        ...savedPerson,
        meritIncrease: savedPerson.meritIncrease ?? legacyMeritIncrease,
        spouse: {
          ...savedSpouse,
          age: savedSpouse.age ?? savedPerson.age,
          meritIncrease:
            savedSpouse.meritIncrease ?? legacyMeritIncrease,
        },
      },
    };
    const appState = createDefaultAppState();
    appState.data = mergeWithDefaults(appState.data, migratedData);
    appState.data.tax.brackets = [];
    appState.data.medicare.premiums = [];
    appState.data.rmd.age = RMD_AGE;
    appState.data.yearlyData = [];
    return appState;
  }
  return createDefaultAppState();
}
