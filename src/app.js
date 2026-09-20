import { createApp, defineAsyncComponent } from "vue";
import { loadInitialAppState } from "./default-state.js";
import {
  calculateTotal401kWithMatch,
  calculatePercentOfMonthsLeftInYear,
  calculateGain,
  calculateInsuranceSpendingForYear,
  calculateSSBenefits,
  calculateSSToTax,
  getRowTitle,
  calculateCapitalGainTax,
  calculateFica,
  getMedicarePremiumsByMagi,
  estimateMedicarePremiumsForAllYears,
  getTaxBracketsForYear as getTaxBracketsForYearHelper,
  getIncomeForBracketAndYear,
  calculateOrdinaryIncomeTaxForYear as calculateOrdinaryIncomeTaxForYearHelper,
} from "./calculator.js";
import { toDollar, toPercent } from "./formatters.js";

function updateChart() {
  const chartParent = document.getElementById("chartParent");
  if (!chartParent) return;
  chartParent.innerHTML = "";
  chartParent.style.display = "none";
  chartParent.innerHTML = '<canvas id="chart1"></canvas>';
  chartParent.style.display = "block";
  const savedData = JSON.parse(localStorage.getItem("data"));
  if (!savedData || !savedData.yearlyData) return;
  const yearlyData = savedData.yearlyData;
  const labels = yearlyData.map((x) => x.age);
  const data = {
    labels,
    datasets: [
      {
        label: "Total Balance",
        data: yearlyData.map((x) => x.investment + x.roth + x.pretaxBalance),
        borderColor: "rgb(55, 255, 111)",
        tension: 0.1,
      },
      {
        label: "Post-tax Balance",
        data: yearlyData.map((x) => x.investment),
        borderColor: "rgb(111, 192, 192)",
        tension: 0.1,
      },
      {
        label: "Roth Balance",
        data: yearlyData.map((x) => x.roth),
        borderColor: "rgb(233, 192, 192)",
        tension: 0.1,
      },
      {
        label: "Pretax Balance",
        data: yearlyData.map((x) => x.pretaxBalance),
        borderColor: "rgb(75, 244, 192)",
        tension: 0.1,
      },
    ],
  };
  new Chart(document.getElementById("chart1"), {
    type: "line",
    data,
    options: {
      scales: {
        y: {
          stacked: false,
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
  template: `
    <div class="container-fluid">
      <h3>Early Retirement Calculator</h3>
      <p>Click <a href="https://github.com/rzou9388/retire">here</a> for source code.</p>
      <hr />
      <div class="row">
        <div :class="containerClass">
          <nav>
            <div class="nav nav-tabs" role="tablist">
              <button v-for="tab in tabs" :key="tab.id" class="nav-link" :class="{ active: activeTab === tab.id }" type="button" @click="selectTab(tab.id)">{{ tab.label }}</button>
            </div>
          </nav>
          <div class="tab-content mt-3">
            <component :is="currentTabComponent" :state="appVm" :actions="actions" />
          </div>
        </div>
        <div class="col-6 overflow-auto">
          <div id="chartParent" style="height:450px;display:none"></div>
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
            <div v-if="activeSummaryTab === 'current'" class="tab-pane fade show active" role="tabpanel">
              <h6>Current year <b>{{ new Date().getFullYear() }}</b> (age <b>{{ data.person.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.person.roth + data.person.pretaxBalance + data.person.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.person.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.person.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.person.pretaxBalance) }}</b></pre>
            </div>
            <div v-else-if="activeSummaryTab === 'retirement'" class="tab-pane fade show active" role="tabpanel">
              <h6>Retirement year <b>{{ data.person.retirement.year }}</b> (age <b>{{ data.person.retirement.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.person.retirement.roth + data.person.retirement.pretaxBalance + data.person.retirement.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.person.retirement.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.person.retirement.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.person.retirement.pretaxBalance) }}</b></pre>
              <div v-if="data.person.retirement.investment < 0" class="alert alert-danger mt-3">
                Your current retirement plan cannot get you to <b>{{ data.person.retirement.age }}</b>, your post-tax balance will be <b>{{ toDollar(data.person.retirement.investment) }}</b>, try adjusting your retirement plan.
              </div>
              <p>After retirement, your spending and taxes are funded from your post-tax investment account until you reach <b>{{ data.noPenaltyWithdraw.age }}</b>.</p>
            </div>
            <div v-else-if="activeSummaryTab === 'withdraw'" class="tab-pane fade show active" role="tabpanel">
              <h6>Penalty free withdraw year <b>{{ data.noPenaltyWithdraw.year }}</b> (age <b>{{ data.noPenaltyWithdraw.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.noPenaltyWithdraw.roth + data.noPenaltyWithdraw.pretaxBalance + data.noPenaltyWithdraw.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.noPenaltyWithdraw.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.noPenaltyWithdraw.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.noPenaltyWithdraw.pretaxBalance) }}</b></pre>
              <p>After you reach age <b>{{ data.noPenaltyWithdraw.age }}</b>, you can withdraw from pretax accounts without penalty, though ordinary income tax will apply.</p>
            </div>
            <div v-else-if="activeSummaryTab === 'rmd'" class="tab-pane fade show active" role="tabpanel">
              <h6>Required Minimum Distribution year <b>{{ data.rmd.year }}</b> (age <b>{{ data.rmd.age }}</b>)</h6>
              <pre>net worth:              <b>{{ toDollar(data.rmd.roth + data.rmd.pretaxBalance + data.rmd.investment) }}</b>
investment (posttax):   <b>{{ toDollar(data.rmd.investment) }}</b>
Roth IRA/401k:          <b>{{ toDollar(data.rmd.roth) }}</b>
IRA/401k:               <b>{{ toDollar(data.rmd.pretaxBalance) }}</b></pre>
              <p>Your pretax retirement accounts will have <b>{{ toDollar(data.rmd.pretaxBalance) }}</b> and your required minimum distribution is <b>{{ toDollar(data.rmd.rmd) }}</b>.</p>
            </div>
            <div v-else class="tab-pane fade show active" role="tabpanel">
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
    calculate() {
      this.data.contrib.totalPercent = calculateTotal401kWithMatch(
        this.data.contrib.employeePercent,
        this.data.contrib.employerPercent,
        this.data.contrib.employerMatchUpTo,
      );
      this.data.contrib.rothTotalPercent = calculateTotal401kWithMatch(
        this.data.contrib.roth401kPercent,
        this.data.contrib.employerPercent,
        this.data.contrib.employerMatchUpTo,
      );

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
      localStorage.setItem("data", JSON.stringify(this.data));
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
      const yearsToCalc = this.data.person.deceased.age - this.data.person.age;
      let age = this.data.person.age;
      let year = new Date().getFullYear();
      let pretaxBalance = this.data.person.pretaxBalance;
      let salary = this.data.person.salary;
      let investment = this.data.person.investment;
      let roth = this.data.person.roth;
      let spending = {
        beforeRetirement: this.data.spending.beforeRetirement,
        afterRetirement: this.data.spending.afterRetirement,
      };

      for (let i = 0; i <= yearsToCalc; i++) {
        const title = getRowTitle(age, this);
        let spendingAmount = 0;
        if (age < this.data.person.retirement.age) {
          salary = calculateGain(
            i === 0,
            salary,
            this.data.meritIncrease * calculatePercentOfMonthsLeftInYear(year),
          );
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

        const k401 =
          salary *
          (this.data.contrib.totalPercent / 100) *
          calculatePercentOfMonthsLeftInYear(year);
        const k401Employee =
          salary *
          (this.data.contrib.employeePercent / 100) *
          calculatePercentOfMonthsLeftInYear(year);
        const roth401k =
          salary *
          (this.data.contrib.rothTotalPercent / 100) *
          calculatePercentOfMonthsLeftInYear(year);
        const roth401kEmployee =
          salary *
          (this.data.contrib.roth401kPercent / 100) *
          calculatePercentOfMonthsLeftInYear(year);

        let taxableEarnedIncome = salary - k401Employee;
        let taxableOrdinaryIncome = taxableEarnedIncome;

        let rmd = 0;
        if (age >= this.data.rmd.age) {
          const divisor = this.data.rmd.lifetimeTable.find(
            (x) => x[0] === age,
          )?.[1];
          rmd = divisor ? pretaxBalance / divisor : 0;
        }

        let dist = 0;
        let conversionAmount = 0;
        let shouldConvert =
          pretaxBalance > 0 &&
          this.data.rothConversion.bracket > 0 &&
          age >= this.data.rothConversion.age;
        if (shouldConvert) {
          let conversionConfig = this.data.rothConversion;
          if (age >= this.data.rothConversion2.age)
            conversionConfig = this.data.rothConversion2;
          const bracket = Number(conversionConfig.bracket);
          if (bracket > 0) {
            const totalDistAllowed =
              getIncomeForBracketAndYear(this, year, bracket) -
              taxableOrdinaryIncome +
              conversionConfig.offset;
            dist =
              pretaxBalance < totalDistAllowed
                ? pretaxBalance
                : totalDistAllowed;
            conversionAmount = dist;
          }
          dist = Math.max(rmd, dist);
          taxableOrdinaryIncome += dist;
        }

        const ss = calculateSSBenefits(
          this.data.person,
          this.data.inflation,
          age,
        );
        let spendingAfterSS = spendingAmount - ss;

        const fica = calculateFica(salary, year);
        const taxableSS = calculateSSToTax(taxableEarnedIncome, ss);
        const ordinaryIncomeTax = this.calculateOrdinaryIncomeTaxForYear(
          taxableOrdinaryIncome + taxableSS,
          year,
        );
        let tax = ordinaryIncomeTax + fica;
        const capitalGainTax = calculateCapitalGainTax({
          age,
          year,
          tax,
          k401kWithdraw: taxableOrdinaryIncome,
          spendingAmount,
          investment,
          state: this,
        });
        tax += capitalGainTax;
        let stateTax =
          age < this.data.person.retirement.age
            ? taxableOrdinaryIncome *
              (this.data.tax.state.beforeRetirement / 100)
            : taxableOrdinaryIncome *
              (this.data.tax.state.afterRetirement / 100);
        tax += stateTax;

        let medicareBPremium = 0;
        if (age >= this.data.medicare.age) {
          medicareBPremium =
            getMedicarePremiumsByMagi(
              taxableOrdinaryIncome + taxableSS,
              year - 2,
              this,
            ) * 24;
          spendingAfterSS += medicareBPremium;
        }

        const yearly = {
          age,
          pretaxBalance,
          year,
          salary,
          k401,
          roth401k,
          rmd,
          dist,
          conversionAmount,
          investment,
          roth,
          tax,
          spending: spendingAmount,
          fica,
          ordinaryIncomeTax,
          capitalGainTax,
          stateTax,
          title,
          ss,
          medicare: medicareBPremium,
          netWorth: pretaxBalance + roth + investment,
        };
        this.data.yearlyData.push(yearly);

        age++;
        year++;
        roth = roth + dist + roth401k;
        pretaxBalance = pretaxBalance + k401 - dist;

        if (age < this.data.person.retirement.age) {
          investment +=
            (taxableEarnedIncome - roth401k - spendingAfterSS - tax) *
            calculatePercentOfMonthsLeftInYear(year - 1);
        } else {
          if (investment - (tax + spendingAfterSS) > 0) {
            investment -= tax + spendingAfterSS;
          } else {
            if (
              age >= this.data.noPenaltyWithdraw.age &&
              roth - (tax + spendingAfterSS) > 0
            ) {
              roth -= tax + spendingAfterSS;
            } else {
              pretaxBalance -= tax + spendingAfterSS;
            }
          }
        }

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
