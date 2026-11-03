import { createApp, defineAsyncComponent } from "vue";
import {
  encodeUserDataForUrl,
  loadInitialAppState,
  serializeUserData,
} from "./default-state.js";
import {
  calculateContributionRates,
  calculatePercentOfMonthsLeftInYear,
  calculateGain,
  calculateInsuranceSpendingForYear,
  calculateSSBenefits,
  calculateSSToTax,
  getRowTitle,
  calculateCapitalGainTax,
  calculateEarlyWithdrawalPenalty,
  calculateFica,
  getMedicarePremiumsByMagi,
  estimateMedicarePremiumsForAllYears,
  getTaxBracketsForYear as getTaxBracketsForYearHelper,
  getIncomeForBracketAndYear,
  calculateOrdinaryIncomeTaxForYear as calculateOrdinaryIncomeTaxForYearHelper,
} from "./calculator.js";
import { CONFIG } from "./constants.js";
import { toDollar, toPercent } from "./formatters.js";

function updateChart() {
  const chartParent = document.getElementById("chartParent");
  if (!chartParent) return;
  chartParent.innerHTML = "";
  chartParent.style.display = "none";
  chartParent.innerHTML = '<canvas id="chart1"></canvas>';
  chartParent.style.display = "block";
  const savedData = (() => {
    try {
      return JSON.parse(localStorage.getItem("data"));
    } catch {
      return null;
    }
  })();
  if (!savedData || !Array.isArray(savedData.yearlyData)) return;
  const yearlyData = savedData.yearlyData;
  const labels = yearlyData.map((x) => x.age);
  const data = {
    labels,
    datasets: [
      {
        label: "Post-tax Balance",
        data: yearlyData.map((x) => x.investment),
        borderColor: "#2563eb",
        backgroundColor: "rgba(37, 99, 235, 0.3)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        fill: true,
        stack: "balances",
      },
      {
        label: "Roth Balance",
        data: yearlyData.map((x) => x.roth),
        borderColor: "#0f9f8f",
        backgroundColor: "rgba(15, 159, 143, 0.3)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        fill: true,
        stack: "balances",
      },
      {
        label: "Pretax Balance",
        data: yearlyData.map((x) => x.pretaxBalance),
        borderColor: "#8b5cf6",
        backgroundColor: "rgba(139, 92, 246, 0.3)",
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 4,
        tension: 0.25,
        fill: true,
        stack: "balances",
      },
      {
        label: "Total Balance",
        data: yearlyData.map((x) => x.investment + x.roth + x.pretaxBalance),
        borderColor: "#0f172a",
        backgroundColor: "#0f172a",
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 5,
        tension: 0.25,
        fill: false,
        stack: "total",
      },
    ],
  };
  new Chart(document.getElementById("chart1"), {
    type: "line",
    data,
    options: {
      maintainAspectRatio: false,
      interaction: {
        mode: "index",
        intersect: false,
      },
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            usePointStyle: true,
            pointStyle: "circle",
            padding: 18,
            color: "#475569",
            font: { family: "Manrope", weight: "600" },
          },
        },
        tooltip: {
          backgroundColor: "#0f172a",
          titleFont: { family: "Manrope", weight: "700" },
          bodyFont: { family: "Manrope" },
          padding: 12,
          callbacks: {
            title: (items) => `Age ${items[0].label}`,
            label: (context) =>
              `${context.dataset.label}: ${new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                maximumFractionDigits: 0,
              }).format(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          grid: { display: false },
          ticks: { color: "#64748b" },
          title: {
            display: true,
            text: "Age",
            color: "#64748b",
            font: { family: "Manrope", weight: "600" },
          },
        },
        y: {
          stacked: true,
          beginAtZero: true,
          grid: { color: "rgba(148, 163, 184, 0.2)" },
          ticks: {
            color: "#64748b",
            callback: (value) =>
              new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                notation: "compact",
                maximumFractionDigits: 1,
              }).format(value),
          },
        },
      },
    },
  });
}

const tabComponents = {
  age: defineAsyncComponent(() => import("./tabs/age-tab.js")),
  income: defineAsyncComponent(() => import("./tabs/income-tab.js")),
  savings: defineAsyncComponent(() => import("./tabs/savings-tab.js")),
  spending: defineAsyncComponent(() => import("./tabs/spending-tab.js")),
  roth: defineAsyncComponent(() => import("./tabs/roth-tab.js")),
  taxes: defineAsyncComponent(() => import("./tabs/taxes-tab.js")),
  yearly: defineAsyncComponent(() => import("./tabs/yearly-tab.js")),
  info: defineAsyncComponent(() => import("./tabs/info-tab.js")),
};

const app = createApp({
  data() {
    const state = loadInitialAppState();
    return {
      ...state,
      activeTab: "age",
      activeSummaryTab: "current",
      containerClass: "col-6",
      shareStatus: "",
      tabs: [
        { id: "age", label: "Age" },
        { id: "income", label: "Income" },
        { id: "savings", label: "Savings" },
        { id: "spending", label: "Spending" },
        { id: "roth", label: "Roth Conversion" },
        { id: "taxes", label: "Taxes & Inflation" },
        { id: "yearly", label: "Yearly Data" },
        { id: "info", label: "Info" },
      ],
      tabComponents,
    };
  },
  template: /* html */ `
    <div class="container-fluid">
      <div class="d-flex justify-content-between align-items-center flex-wrap gap-2">
        <h3>Early Retirement Calculator</h3>
        <div class="d-flex align-items-center flex-wrap gap-2">
          <button class="btn btn-outline-secondary btn-sm" type="button" @click="exportUserData">Export JSON</button>
          <button class="btn btn-outline-primary btn-sm" type="button" @click="copyShareUrl">Copy share URL</button>
          <span class="small" role="status">{{ shareStatus }}</span>
        </div>
      </div>
      <div class="app-resource-links" aria-label="Calculator resources">
        <span class="app-resource-item">
          Source code:
          <a href="https://github.com/rzou9388/retire">View on GitHub</a>
        </span>
        <span class="app-resource-item">
          Cross-check your numbers:
          <a href="https://my-after-work-plan.my-after-work-plan.workers.dev/" target="_blank">Open the other calculator</a>
        </span>
      </div>
      <hr />
      <div class="row">
        <div :class="containerClass">
          <nav>
            <div class="nav nav-tabs" role="tablist">
              <button v-for="tab in tabs" :key="tab.id" class="nav-link" :class="{ active: activeTab === tab.id }" type="button" @click="selectTab(tab.id)">{{ tab.label }}</button>
            </div>
          </nav>
          <div class="tab-content mt-3">
            <div v-for="tab in tabs" :key="tab.id" class="tab-pane" :class="{ active: activeTab === tab.id }" v-show="activeTab === tab.id">
              <component :is="tabComponents[tab.id]" :state="appVm" :actions="actions" />
            </div>
          </div>
        </div>
        <div class="col-6 overflow-auto">
          <div id="chartParent" class="chart-panel" style="height:450px;display:none"></div>
          <hr />
          <nav>
            <div class="nav nav-tabs" role="tablist">
              <button class="nav-link" :class="{ active: activeSummaryTab === 'current' }" type="button" @click="activeSummaryTab = 'current'">Current year</button>
              <button class="nav-link" :class="{ active: activeSummaryTab === 'retirement' }" type="button" @click="activeSummaryTab = 'retirement'">Retirement year</button>
              <button class="nav-link" :class="{ active: activeSummaryTab === 'withdraw' }" type="button" @click="activeSummaryTab = 'withdraw'">Penalty free withdraw year</button>
              <button class="nav-link" :class="{ active: activeSummaryTab === 'rmd' }" type="button" @click="activeSummaryTab = 'rmd'">Required Minimum Distribution year</button>
              <button class="nav-link" :class="{ active: activeSummaryTab === 'end' }" type="button" @click="activeSummaryTab = 'end'">End of life year</button>
            </div>
          </nav>
          <div class="tab-content mt-3">
            <div v-show="activeSummaryTab === 'current'" class="tab-pane fade show active" role="tabpanel">
              <h6>Current year <b>{{ new Date().getFullYear() }}</b> (age <b>{{ data.person.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.person.roth + data.person.pretaxBalance + data.person.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.person.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.person.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.person.pretaxBalance) }}</b></pre>
            </div>
            <div v-show="activeSummaryTab === 'retirement'" class="tab-pane fade show active" role="tabpanel">
              <h6>Retirement year <b>{{ data.person.retirement.year }}</b> (age <b>{{ data.person.retirement.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.person.retirement.roth + data.person.retirement.pretaxBalance + data.person.retirement.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.person.retirement.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.person.retirement.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.person.retirement.pretaxBalance) }}</b></pre>
              <div v-if="data.person.retirement.investment < 0" class="alert alert-danger mt-3">
                Your current retirement plan cannot get you to <b>{{ data.person.retirement.age }}</b>, your post-tax balance will be <b>{{ toDollar(data.person.retirement.investment) }}</b>, try adjusting your retirement plan.
              </div>
              <p>After retirement, your spending and taxes are funded from your post-tax investment account first. Once that is exhausted, Roth accounts are used, then pre-tax accounts; pre-tax withdrawals before age <b>{{ data.noPenaltyWithdraw.age }}</b> include a 10% early-withdrawal penalty.</p>
            </div>
            <div v-show="activeSummaryTab === 'withdraw'" class="tab-pane fade show active" role="tabpanel">
              <h6>Penalty free withdraw year <b>{{ data.noPenaltyWithdraw.year }}</b> (age <b>{{ data.noPenaltyWithdraw.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.noPenaltyWithdraw.roth + data.noPenaltyWithdraw.pretaxBalance + data.noPenaltyWithdraw.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.noPenaltyWithdraw.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.noPenaltyWithdraw.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.noPenaltyWithdraw.pretaxBalance) }}</b></pre>
              <p>After you reach age <b>{{ data.noPenaltyWithdraw.age }}</b>, you can withdraw from pretax accounts without penalty, though ordinary income tax will apply.</p>
            </div>
            <div v-show="activeSummaryTab === 'rmd'" class="tab-pane fade show active" role="tabpanel">
              <h6>Required Minimum Distribution year <b>{{ data.rmd.year }}</b> (age <b>{{ data.rmd.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.rmd.roth + data.rmd.pretaxBalance + data.rmd.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.rmd.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.rmd.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.rmd.pretaxBalance) }}</b></pre>
              <p>Your pretax retirement accounts will have <b>{{ toDollar(data.rmd.pretaxBalance) }}</b> and your required minimum distribution is <b>{{ toDollar(data.rmd.rmd) }}</b>.</p>
            </div>
            <div v-show="activeSummaryTab === 'end'" class="tab-pane fade show active" role="tabpanel">
              <h6>End of life year <b>{{ data.person.deceased.year }}</b> (age <b>{{ data.person.deceased.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.person.deceased.roth + data.person.deceased.pretaxBalance + data.person.deceased.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.person.deceased.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.person.deceased.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.person.deceased.pretaxBalance) }}</b></pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  computed: {
    currentTabComponent() {
      return this.tabComponents[this.activeTab] || this.tabComponents.age;
    },
    appVm() {
      return this;
    },
    actions() {
      return {
        calculate: (...args) => this.calculate(...args),
        recalculate: (...args) => this.recalculate(...args),
        toDollar: (...args) => this.toDollar(...args),
        toPercent: (...args) => this.toPercent(...args),
        getTaxBracketsForYear: (year) => this.getTaxBracketsForYear(year),
        calculateOrdinaryIncomeTaxForYear: (income, year) =>
          this.calculateOrdinaryIncomeTaxForYear(income, year),
      };
    },
  },
  methods: {
    selectTab(tabId) {
      this.activeTab = tabId;
      this.containerClass = tabId === "yearly" ? "col-12" : "col-6";
    },
    resetData() {
      localStorage.clear();
      window.location.reload();
    },
    exportUserData() {
      const contents = JSON.stringify(serializeUserData(this.data), null, 2);
      const downloadUrl = URL.createObjectURL(
        new Blob([contents], { type: "application/json" }),
      );
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = "retirement-plan.json";
      link.click();
      URL.revokeObjectURL(downloadUrl);
      this.shareStatus = "JSON exported.";
    },
    async copyShareUrl() {
      const url = new URL(window.location.href);
      url.search = "";
      url.hash = "";
      url.searchParams.set(
        "data",
        encodeUserDataForUrl(serializeUserData(this.data)),
      );

      try {
        await navigator.clipboard.writeText(url.toString());
        this.shareStatus = "Share URL copied.";
      } catch {
        window.prompt("Copy this share URL", url.toString());
      }
    },
    calculate() {
      const selfRates = calculateContributionRates(
        this.data.contrib.employeePercent,
        this.data.contrib.roth401kPercent,
        this.data.contrib.employerPercent,
        this.data.contrib.employerMatchUpTo,
      );
      this.data.contrib.totalPercent = selfRates.totalPercent;
      this.data.contrib.rothTotalPercent = selfRates.rothTotalPercent;

      const spouseRates = calculateContributionRates(
        this.data.contrib.spouse.employeePercent,
        this.data.contrib.spouse.roth401kPercent,
        this.data.contrib.spouse.employerPercent,
        this.data.contrib.spouse.employerMatchUpTo,
      );
      this.data.contrib.spouse.totalPercent = spouseRates.totalPercent;
      this.data.contrib.spouse.rothTotalPercent = spouseRates.rothTotalPercent;

      this.calculateYearly();
      this.saveState();

      this.data.rmd = this.mergeYearlyDataByAge(this.data.rmd);
      this.data.person.retirement = this.mergeYearlyDataByAge(
        this.data.person.retirement,
      );
      this.data.rothConversion = this.mergeYearlyDataByAge(
        this.data.rothConversion,
      );
      this.data.rothConversion2 = this.mergeYearlyDataByAge(
        this.data.rothConversion2,
      );
      this.data.person.deceased = this.mergeYearlyDataByAge(
        this.data.person.deceased,
      );
      this.data.noPenaltyWithdraw = this.mergeYearlyDataByAge(
        this.data.noPenaltyWithdraw,
      );
      this.data.medicare = this.mergeYearlyDataByAge(this.data.medicare);

      window.setTimeout(updateChart, 200);
    },
    recalculate() {
      estimateMedicarePremiumsForAllYears(this);
      this.calculate();
    },
    saveState() {
      try {
        localStorage.setItem("data", JSON.stringify(this.data));
      } catch (error) {
        console.warn("Unable to save retirement data in this browser.", error);
      }
    },
    mergeYearlyDataByAge(originalData) {
      const oneYearData = this.data.yearlyData.find(
        (y) => y.age === originalData.age,
      );
      const merged = { ...originalData, ...oneYearData };
      return merged;
    },
    calculateYearly() {
      this.data.yearlyData = [];
      const startAge = Number(this.data.person.age);
      const deceasedAge = Number(this.data.person.deceased.age);
      const yearsToCalc =
        Number.isFinite(startAge) &&
        Number.isFinite(deceasedAge) &&
        deceasedAge > startAge
          ? Math.min(deceasedAge - startAge, CONFIG.MAX_AGE)
          : 0;
      let age = Number.isFinite(startAge) ? startAge : 0;
      let year = new Date().getFullYear();
      let pretaxBalance = Math.max(Number(this.data.person.pretaxBalance) || 0, 0);
      let selfSalary = Number(this.data.person.salary) || 0;
      const isJointFiler =
        this.data.tax.filingStatus === "marriedFilingJointly";
      let spouseSalary = isJointFiler
        ? Number(this.data.person.spouse.salary) || 0
        : 0;
      let salary = selfSalary + spouseSalary;
      let investment = Number(this.data.person.investment) || 0;
      let roth = Number(this.data.person.roth) || 0;
      let investmentPriorYearBalance = null;
      let investmentPriorYearCashFlow = 0;
      let investmentPriorYearWithdrawal = 0;
      let investmentPriorYearRmdReinvested = 0;
      let investmentPriorYearSurplusCash = 0;
      let pretaxPriorYearBalance = null;
      let pretaxPriorYearContribution = 0;
      let pretaxPriorYearDistribution = 0;
      let pretaxPriorYearWithdrawal = 0;
      let rothPriorYearBalance = null;
      let rothPriorYearDistribution = 0;
      let rothPriorYearContribution = 0;
      let rothPriorYearWithdrawal = 0;
      let spending = {
        beforeRetirement: this.data.spending.beforeRetirement,
        afterRetirement: this.data.spending.afterRetirement,
      };

      for (let i = 0; i <= yearsToCalc; i++) {
        const title = getRowTitle(age, this);
        let spendingAmount = 0;
        const pretaxStartingBalance = pretaxBalance;
        const rothStartingBalance = roth;
        const investmentStartingBalance = investment;
        let investmentContribution = 0;
        if (age < this.data.person.retirement.age) {
          selfSalary = calculateGain(
            i === 0,
            selfSalary,
            this.data.person.meritIncrease *
              calculatePercentOfMonthsLeftInYear(year),
          );
          if (isJointFiler) {
            spouseSalary = calculateGain(
              i === 0,
              spouseSalary,
              this.data.person.spouse.meritIncrease *
                calculatePercentOfMonthsLeftInYear(year),
            );
          }
          salary = selfSalary + spouseSalary;
          pretaxBalance = calculateGain(
            i === 0,
            pretaxBalance,
            this.data.annualReturn.beforeRetirement *
              calculatePercentOfMonthsLeftInYear(year),
          );
          investment = calculateGain(
            i === 0,
            investment,
            this.data.annualReturn.beforeRetirement *
              calculatePercentOfMonthsLeftInYear(year),
          );
          roth = calculateGain(
            i === 0,
            roth,
            this.data.annualReturn.beforeRetirement *
              calculatePercentOfMonthsLeftInYear(year),
          );
          spendingAmount =
            spending.beforeRetirement *
            calculatePercentOfMonthsLeftInYear(year);
        } else {
          selfSalary = 0;
          spouseSalary = 0;
          salary = 0;
          pretaxBalance = calculateGain(
            i === 0,
            pretaxBalance,
            this.data.annualReturn.afterRetirement,
          );
          investment = calculateGain(
            i === 0,
            investment,
            this.data.annualReturn.afterRetirement,
          );
          roth = calculateGain(
            i === 0,
            roth,
            this.data.annualReturn.afterRetirement,
          );
          spendingAmount = spending.afterRetirement;
          if (age < this.data.medicare.age) {
            spendingAmount += calculateInsuranceSpendingForYear(
              this.data.spending,
              this.data.inflation,
              year,
            );
          }
        }

        const pretaxReturn = pretaxBalance - pretaxStartingBalance;
        const rothReturn = roth - rothStartingBalance;
        let additionalExpense = 0;
        let additionalExpenseFromInvestment = 0;
        for (const contribution of this.data.investmentContributions ?? []) {
          if (!contribution || typeof contribution !== "object") continue;
          if (Number(contribution.age) === age) {
            const amount = Number(contribution.amount);
            if (Number.isFinite(amount) && amount > 0) {
              if (contribution.type === "expense") {
                additionalExpense += amount;
              } else {
                investment += amount;
                investmentContribution += amount;
              }
            }
          }
        }
        additionalExpenseFromInvestment =
          age < this.data.person.retirement.age
            ? additionalExpense
            : Math.min(Math.max(investment, 0), additionalExpense);
        investment -= additionalExpenseFromInvestment;
        spendingAmount += additionalExpense;
        const investmentReturn =
          investment -
          investmentStartingBalance -
          investmentContribution +
          additionalExpenseFromInvestment;

        const monthsLeft = calculatePercentOfMonthsLeftInYear(year);
        const k401 =
          (selfSalary * (Number(this.data.contrib.totalPercent) / 100) +
            spouseSalary *
              (Number(this.data.contrib.spouse.totalPercent) / 100)) *
          monthsLeft;
        const k401Employee =
          (selfSalary * (Number(this.data.contrib.employeePercent) / 100) +
            spouseSalary *
              (Number(this.data.contrib.spouse.employeePercent) / 100)) *
          monthsLeft;
        // Employer match is part of roth401k but it is not deducted from the
        // employee's take-home pay; only the employee deferral is.
        const roth401kEmployee =
          (selfSalary * (Number(this.data.contrib.roth401kPercent) / 100) +
            spouseSalary *
              (Number(this.data.contrib.spouse.roth401kPercent) / 100)) *
          monthsLeft;
        const roth401k =
          (selfSalary * (Number(this.data.contrib.rothTotalPercent) / 100) +
            spouseSalary *
              (Number(this.data.contrib.spouse.rothTotalPercent) / 100)) *
          monthsLeft;

        const taxableEarnedIncome = salary - k401Employee;

        // Required Minimum Distribution. The RMD is always taxable ordinary
        // income and, by law, must be distributed before (and cannot be part
        // of) any Roth conversion. The old code only applied the RMD when a
        // Roth conversion was enabled and, worse, moved it into the Roth
        // account as if it had been converted.
        let rmd = 0;
        if (age >= this.data.rmd.age) {
          const divisor = this.data.rmd.lifetimeTable.find(
            (x) => x[0] === age,
          )?.[1];
          // RMDs use the prior year-end balance, which is this row's starting
          // balance (before this year's growth and contributions).
          rmd = divisor
            ? Math.min(
                Math.max(pretaxStartingBalance, 0) / divisor,
                Math.max(pretaxBalance, 0),
              )
            : 0;
        }
        const taxableOrdinaryIncomeBeforeConversion = taxableEarnedIncome + rmd;

        // Choose the active Roth-conversion stage. The conversion is sized
        // against the bracket room left after RMDs and the pre-tax withdrawals
        // used to fund spending. That room is recomputed inside the loop below
        // once those withdrawals are known, so the conversion does not push
        // income past the selected bracket.
        const conversionConfig =
          age >= this.data.rothConversion2.age
            ? this.data.rothConversion2
            : this.data.rothConversion;
        const conversionBracket = Number(conversionConfig.bracket) || 0;
        const canConvert =
          age >= this.data.rothConversion.age &&
          conversionBracket > 0 &&
          pretaxBalance > rmd;
        const getConversionRoom = (otherOrdinaryIncome) =>
          getIncomeForBracketAndYear(this, year, conversionBracket) -
          otherOrdinaryIncome +
          (Number(conversionConfig.offset) || 0);
        const calculateConversionAmount = (
          otherOrdinaryIncome,
          pretaxWithdrawal = 0,
        ) => {
          if (!canConvert) return 0;
          const room = getConversionRoom(otherOrdinaryIncome);
          const available = pretaxBalance - rmd - pretaxWithdrawal;
          return Math.max(0, Math.min(available, room));
        };
        let conversionAmount = calculateConversionAmount(
          taxableOrdinaryIncomeBeforeConversion,
        );

        const ss = calculateSSBenefits(
          this.data.person,
          this.data.inflation,
          age,
        );
        let spendingAfterSS = spendingAmount - ss;

        const fica = calculateFica(selfSalary, year, this, spouseSalary);
        const medicarePeople =
          this.data.tax.filingStatus === "marriedFilingJointly" ? 2 : 1;
        const allocateWithdrawals = (cashNeeded) => {
          let remaining = Math.max(cashNeeded, 0);
          let pretaxWithdrawal = 0;
          let investmentWithdrawal = 0;
          let rothWithdrawal = 0;
          // The RMD is distributed whether or not cash is needed. While still
          // working, salary funds spending, so the whole RMD is reinvested.
          const rmdUsed =
            age >= this.data.person.retirement.age
              ? Math.min(rmd, remaining)
              : 0;
          remaining -= rmdUsed;
          const takePretax = () => {
            const pretaxAvailable = Math.max(
              pretaxBalance + k401 - rmd - conversionAmount,
              0,
            );
            pretaxWithdrawal = Math.min(pretaxAvailable, remaining);
            remaining -= pretaxWithdrawal;
          };
          const takeInvestment = () => {
            investmentWithdrawal = Math.min(Math.max(investment, 0), remaining);
            remaining -= investmentWithdrawal;
          };
          const takeRoth = () => {
            rothWithdrawal = Math.min(Math.max(roth, 0), remaining);
            remaining -= rothWithdrawal;
          };

          if (age >= this.data.person.retirement.age) {
            if (age >= this.data.noPenaltyWithdraw.age) {
              takePretax();
              takeInvestment();
              takeRoth();
            } else {
              // Before the penalty-free age, use the taxable account, then
              // Roth (assumed to be qualified/contribution basis), and only
              // then take a penalized pre-tax withdrawal.
              takeInvestment();
              takeRoth();
              takePretax();
            }
          }

          return {
            pretaxWithdrawal,
            investmentWithdrawal,
            rothWithdrawal,
            rmdUsed,
            shortfall: remaining,
          };
        };
        const calculateTaxesForWithdrawals = ({
          pretaxWithdrawal,
          investmentWithdrawal,
        }) => {
          const taxableOrdinaryIncome =
            taxableOrdinaryIncomeBeforeConversion + conversionAmount;
          const withdrawalTaxableIncome =
            taxableOrdinaryIncome + pretaxWithdrawal;
          const taxableSS = calculateSSToTax(
            withdrawalTaxableIncome,
            ss,
            this,
          );
          const ordinaryIncomeTax = this.calculateOrdinaryIncomeTaxForYear(
            withdrawalTaxableIncome + taxableSS,
            year,
          );
          const capitalGainTax = calculateCapitalGainTax({
            age,
            year,
            taxableIncome: withdrawalTaxableIncome + taxableSS,
            investmentWithdrawal,
            state: this,
          });
          const stateTax =
            withdrawalTaxableIncome *
            (age < this.data.person.retirement.age
              ? this.data.tax.state.beforeRetirement / 100
              : this.data.tax.state.afterRetirement / 100);
          const medicareBPremium =
            age >= this.data.medicare.age
              ? getMedicarePremiumsByMagi(
                  withdrawalTaxableIncome + taxableSS,
                  year - 2,
                  this,
                ) *
                12 *
                medicarePeople
              : 0;
          const earlyWithdrawalPenalty = calculateEarlyWithdrawalPenalty(
            pretaxWithdrawal,
            age,
            this.data.noPenaltyWithdraw.age,
          );

          return {
            taxableSS,
            ordinaryIncomeTax,
            capitalGainTax,
            stateTax,
            medicareBPremium,
            earlyWithdrawalPenalty,
            tax:
              ordinaryIncomeTax +
              fica +
              capitalGainTax +
              stateTax +
              earlyWithdrawalPenalty,
          };
        };

        // Converge the withdrawal/tax feedback loop. An outer loop then
        // resizes the Roth conversion so it fills only the bracket room left
        // after the RMD and the pre-tax withdrawals needed for spending.
        let withdrawals = allocateWithdrawals(0);
        let taxes = calculateTaxesForWithdrawals(withdrawals);
        const sameWithdrawals = (a, b) =>
          Math.abs(a.pretaxWithdrawal - b.pretaxWithdrawal) < 0.01 &&
          Math.abs(a.investmentWithdrawal - b.investmentWithdrawal) < 0.01 &&
          Math.abs(a.rothWithdrawal - b.rothWithdrawal) < 0.01 &&
          Math.abs(a.rmdUsed - b.rmdUsed) < 0.01;
        const convergeWithdrawals = () => {
          for (let i = 0; i < 50; i++) {
            taxes = calculateTaxesForWithdrawals(withdrawals);
            const nextWithdrawals = allocateWithdrawals(
              taxes.tax +
                spendingAfterSS +
                taxes.medicareBPremium -
                additionalExpenseFromInvestment,
            );
            const converged = sameWithdrawals(nextWithdrawals, withdrawals);
            withdrawals = nextWithdrawals;
            if (converged) break;
          }
        };

        convergeWithdrawals();
        for (let outer = 0; canConvert && outer < 25; outer++) {
          const nextConversionAmount = calculateConversionAmount(
            taxableOrdinaryIncomeBeforeConversion +
              withdrawals.pretaxWithdrawal,
            withdrawals.pretaxWithdrawal,
          );
          if (Math.abs(nextConversionAmount - conversionAmount) < 1) {
            conversionAmount = nextConversionAmount;
            break;
          }
          // Damp the update: conversion -> tax -> withdrawal -> bracket room
          // is a negative feedback loop and a full step can oscillate.
          conversionAmount =
            conversionAmount + (nextConversionAmount - conversionAmount) * 0.5;
          withdrawals = allocateWithdrawals(0);
          convergeWithdrawals();
        }
        // Make sure the recorded withdrawals match the final conversion amount
        // (the last conversion update resets the loop above).
        convergeWithdrawals();
        taxes = calculateTaxesForWithdrawals(withdrawals);

        const {
          pretaxWithdrawal,
          investmentWithdrawal,
          rothWithdrawal,
          rmdUsed,
        } = withdrawals;
        const {
          taxableSS,
          ordinaryIncomeTax,
          capitalGainTax,
          stateTax,
          medicareBPremium,
          earlyWithdrawalPenalty,
          tax,
        } = taxes;
        spendingAfterSS += medicareBPremium;

        const rmdReinvested = Math.max(rmd - rmdUsed, 0);
        // Surplus income (for example Social Security above spending) is
        // saved in the taxable account instead of disappearing.
        const cashNeeded =
          tax + spendingAfterSS - additionalExpenseFromInvestment;
        const surplusCash =
          age >= this.data.person.retirement.age && cashNeeded < 0
            ? -cashNeeded
            : 0;

        const yearly = {
          age,
          pretaxBalance,
          pretaxStartingBalance,
          pretaxReturn,
          pretaxPriorYearBalance,
          pretaxPriorYearContribution,
          pretaxPriorYearDistribution,
          pretaxPriorYearWithdrawal,
          year,
          salary,
          k401,
          roth401k,
          rmd,
          rmdUsed,
          rmdReinvested,
          dist: conversionAmount,
          conversionAmount,
          investment,
          investmentStartingBalance,
          investmentReturn,
          investmentContribution,
          additionalExpense,
          additionalExpenseFromInvestment,
          surplusCash,
          shortfall:
            age >= this.data.person.retirement.age
              ? withdrawals.shortfall
              : 0,
          investmentPriorYearBalance,
          investmentPriorYearCashFlow,
          investmentPriorYearWithdrawal,
          investmentPriorYearRmdReinvested,
          investmentPriorYearSurplusCash,
          roth,
          rothStartingBalance,
          rothReturn,
          rothPriorYearBalance,
          rothPriorYearDistribution,
          rothPriorYearContribution,
          rothPriorYearWithdrawal,
          tax,
          spending: spendingAmount,
          fica,
          ordinaryIncomeTax,
          capitalGainTax,
          stateTax,
          earlyWithdrawalPenalty,
          title,
          ss,
          medicare: medicareBPremium,
          netWorth: pretaxBalance + roth + investment,
        };
        this.data.yearlyData.push(yearly);

        age++;
        year++;
        roth = roth + conversionAmount + roth401k - rothWithdrawal;
        pretaxBalance = Math.max(
          pretaxBalance +
            k401 -
            rmd -
            conversionAmount -
            pretaxWithdrawal,
          0,
        );
        investment -= investmentWithdrawal;
        investment += rmdReinvested + surplusCash;
        let investmentCashFlow = 0;

        if (age <= this.data.person.retirement.age) {
          investmentCashFlow =
            (taxableEarnedIncome -
              roth401kEmployee -
              (spendingAfterSS - additionalExpense) -
              tax) *
            calculatePercentOfMonthsLeftInYear(year - 1);
          investment += investmentCashFlow;
        }

        rothPriorYearBalance = yearly.roth;
        rothPriorYearDistribution = conversionAmount;
        rothPriorYearContribution = roth401k;
        rothPriorYearWithdrawal = rothWithdrawal;
        investmentPriorYearBalance = yearly.investment;
        investmentPriorYearCashFlow = investmentCashFlow;
        investmentPriorYearWithdrawal = investmentWithdrawal;
        investmentPriorYearRmdReinvested = rmdReinvested;
        investmentPriorYearSurplusCash = surplusCash;
        pretaxPriorYearBalance = yearly.pretaxBalance;
        pretaxPriorYearContribution = k401;
        pretaxPriorYearDistribution = conversionAmount + rmd;
        pretaxPriorYearWithdrawal = pretaxWithdrawal;

        spending.beforeRetirement =
          spending.beforeRetirement * (1 + this.data.inflation / 100);
        spending.afterRetirement =
          spending.afterRetirement * (1 + this.data.inflation / 100);
      }
    },
    toDollar,
    toPercent,
    getTaxBracketsForYear(year) {
      return getTaxBracketsForYearHelper(this, year);
    },
    calculateOrdinaryIncomeTaxForYear(income, year) {
      return calculateOrdinaryIncomeTaxForYearHelper(this, income, year);
    },
  },
  beforeMount() {
    try {
      this.calculate();
    } catch (ex) {
      console.error(ex);
    }
  },
});

app.config.globalProperties.window = window;
app.mount("#app");

window.resetDivTab = function resetDivTab() {
  const divTabs = document.getElementById("divtabs");
  if (divTabs) divTabs.className = "col-6";
};
window.setDivTabClass = function setDivTabClass(cla) {
  const divTabs = document.getElementById("divtabs");
  if (divTabs) divTabs.className = cla;
};
window.updateChart = updateChart;
