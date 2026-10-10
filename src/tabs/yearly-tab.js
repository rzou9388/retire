import { defineComponent } from "vue";

export default defineComponent({
  name: "YearlyTab",
  props: ["state", "actions"],
  data() {
    return { showTodaysDollars: false };
  },
  methods: {
    toDisplayDollar(amount, yearly) {
      const currentYear = new Date().getFullYear();
      const yearsFromToday = yearly.year - currentYear;
      const inflationRate = Number(this.state.data.inflation) / 100;
      const adjustedAmount = this.showTodaysDollars
        ? amount / (1 + inflationRate) ** yearsFromToday
        : amount;
      return this.actions.toDollar(adjustedAmount);
    },
    getTaxTooltip(yearly) {
      return [
        `Federal income tax: ${this.toDisplayDollar(yearly.ordinaryIncomeTax, yearly)}`,
        `FICA: ${this.toDisplayDollar(yearly.fica, yearly)}`,
        `Capital gains tax: ${this.toDisplayDollar(yearly.capitalGainTax, yearly)}`,
        `State tax: ${this.toDisplayDollar(yearly.stateTax, yearly)}`,
        `Total: ${this.toDisplayDollar(yearly.tax, yearly)}`,
      ].join("\n");
    },
    getInvestmentTooltip(yearly) {
      const enteringBalance =
        yearly.investmentPriorYearBalance === null
          ? [
              `Initial balance entering year: ${this.toDisplayDollar(yearly.investmentStartingBalance, yearly)}`,
            ]
          : [
              `Previous row balance: ${this.toDisplayDollar(yearly.investmentPriorYearBalance, yearly)}`,
              `Post-row cash savings: ${this.toDisplayDollar(yearly.investmentPriorYearCashFlow, yearly)}`,
              `Post-row investment withdrawal: -${this.toDisplayDollar(yearly.investmentPriorYearWithdrawal, yearly)}`,
              `Balance entering year: ${this.toDisplayDollar(yearly.investmentStartingBalance, yearly)}`,
            ];
      return [
        ...enteringBalance,
        `Annual return: ${this.toDisplayDollar(yearly.investmentReturn, yearly)}`,
        `One-time income added: ${this.toDisplayDollar(yearly.investmentContribution, yearly)}`,
        `Balance shown: ${this.toDisplayDollar(yearly.investment, yearly)}`,
      ].join("\n");
    },
    getPretaxTooltip(yearly) {
      const enteringBalance =
        yearly.pretaxPriorYearBalance === null
          ? [
              `Initial balance entering year: ${this.toDisplayDollar(yearly.pretaxStartingBalance, yearly)}`,
            ]
          : [
              `Previous row balance: ${this.toDisplayDollar(yearly.pretaxPriorYearBalance, yearly)}`,
              `401(k) contribution added: ${this.toDisplayDollar(yearly.pretaxPriorYearContribution, yearly)}`,
              `Distribution or conversion: -${this.toDisplayDollar(yearly.pretaxPriorYearDistribution, yearly)}`,
              `Post-row spending withdrawal: -${this.toDisplayDollar(yearly.pretaxPriorYearWithdrawal, yearly)}`,
              `Balance entering year: ${this.toDisplayDollar(yearly.pretaxStartingBalance, yearly)}`,
            ];
      return [
        ...enteringBalance,
        `Annual return: ${this.toDisplayDollar(yearly.pretaxReturn, yearly)}`,
        `Balance shown: ${this.toDisplayDollar(yearly.pretaxBalance, yearly)}`,
      ].join("\n");
    },
    getRothTooltip(yearly) {
      const enteringBalance =
        yearly.rothPriorYearBalance === null
          ? [
              `Initial balance entering year: ${this.toDisplayDollar(yearly.rothStartingBalance, yearly)}`,
            ]
          : [
              `Previous row balance: ${this.toDisplayDollar(yearly.rothPriorYearBalance, yearly)}`,
              `Pretax distribution added: ${this.toDisplayDollar(yearly.rothPriorYearDistribution, yearly)}`,
              `Roth 401(k) contribution: ${this.toDisplayDollar(yearly.rothPriorYearContribution, yearly)}`,
              `Roth withdrawal: -${this.toDisplayDollar(yearly.rothPriorYearWithdrawal, yearly)}`,
              `Balance entering year: ${this.toDisplayDollar(yearly.rothStartingBalance, yearly)}`,
            ];
      return [
        ...enteringBalance,
        `Annual return: ${this.toDisplayDollar(yearly.rothReturn, yearly)}`,
        `Balance shown: ${this.toDisplayDollar(yearly.roth, yearly)}`,
      ].join("\n");
    },
    getNetWorthTooltip(yearly) {
      return [
        `Tax-deferred balance: ${this.toDisplayDollar(yearly.pretaxBalance, yearly)}`,
        `Roth balance: ${this.toDisplayDollar(yearly.roth, yearly)}`,
        `Investment balance: ${this.toDisplayDollar(yearly.investment, yearly)}`,
        `Net worth: ${this.toDisplayDollar(yearly.netWorth, yearly)}`,
      ].join("\n");
    },
  },
  template: `
    <div class="row">
      <div class="form-check col-1">
        <input class="form-check-input" id="col-age" type="checkbox" v-model="state.data.columns.age" />
        <label class="form-check-label" for="col-age">Age</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-year" type="checkbox" v-model="state.data.columns.year" />
        <label class="form-check-label" for="col-year">Year</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-salary" type="checkbox" v-model="state.data.columns.salary" />
        <label class="form-check-label" for="col-salary">Salary</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-contrib" type="checkbox" v-model="state.data.columns.contrib" />
        <label class="form-check-label" for="col-contrib">401K Contrib {{actions.toPercent(state.data.contrib.totalPercent)}}</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-contribRoth" type="checkbox" v-model="state.data.columns.contribRoth" />
        <label class="form-check-label" for="col-contribRoth">Roth 401K {{actions.toPercent(state.data.contrib.rothTotalPercent)}}</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-rmd" type="checkbox" v-model="state.data.columns.rmd" />
        <label class="form-check-label" for="col-rmd" title="Required Minimum Distribution">RMD</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-spending" type="checkbox" v-model="state.data.columns.spending" />
        <label class="form-check-label" for="col-spending">Spending</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-dist" type="checkbox" v-model="state.data.columns.conversionAmount" />
        <label class="form-check-label" for="col-dist">Roth Conversion</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-pretax" type="checkbox" v-model="state.data.columns.pretax" />
        <label title="traditional 401k, IRA, etc" class="form-check-label" for="col-pretax">Tax Deferred Balance</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-roth" type="checkbox" v-model="state.data.columns.roth" />
        <label class="form-check-label" for="col-roth">Roth</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-investment" type="checkbox" v-model="state.data.columns.investment" />
        <label class="form-check-label" for="col-investment">Investment</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-medicare" type="checkbox" v-model="state.data.columns.medicare" />
        <label class="form-check-label" for="col-medicare">MedicareB Prem</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-ss" type="checkbox" v-model="state.data.columns.ss" />
        <label class="form-check-label" for="col-ss">Social Security</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-tax" type="checkbox" v-model="state.data.columns.tax" />
        <label class="form-check-label" for="col-tax">Taxes</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="col-net" type="checkbox" v-model="state.data.columns.netWorth" />
        <label class="form-check-label" for="col-net">Net Worth</label>
      </div>
      <div class="form-check col">
        <input class="form-check-input" id="today-dollars" type="checkbox" v-model="showTodaysDollars" />
        <label class="form-check-label" for="today-dollars">Today's dollars</label>
      </div>
    </div>
    <table class="table table-strip table-hover mt-1">
      <thead>
        <th v-if="state.data.columns.age">Age</th>
        <th v-if="state.data.columns.year">Year</th>
        <th v-if="state.data.columns.salary">Salary</th>
        <th v-if="state.data.columns.contrib">401k Contrib</th>
        <th v-if="state.data.columns.contribRoth">Roth 401k Contrib</th>
        <th title="Required Minimum Distribution" v-if="state.data.columns.rmd">RMD</th>
        <th v-if="state.data.columns.spending" title="inflation adjusted">Spending</th>
        <th v-if="state.data.columns.conversionAmount">Roth Conversion</th>
        <th v-if="state.data.columns.pretax" title="traditional 401k, IRA">Tax Deferred Balance</th>
        <th v-if="state.data.columns.roth">Roth Balance</th>
        <th v-if="state.data.columns.investment" title="post-tax brokerage + savings">Investment</th>
        <th v-if="state.data.columns.medicare">Medicare</th>
        <th v-if="state.data.columns.ss">Social Security</th>
        <th title="FICA, Federal, State, Ordinary Income and Capital Gains" v-if="state.data.columns.tax">Taxes</th>
        <th v-if="state.data.columns.netWorth">Net Worth</th>
      </thead>
      <tbody>
        <tr v-for="yearly in state.data.yearlyData" :class="{ retirementAge: yearly.age === state.data.person.retirement.age, rmdAge: yearly.age === state.data.rmd.age, medicareAge: yearly.age === state.data.medicare.age, ssAge: yearly.age === state.data.person.ss.age, noPenaltyAge: yearly.age === state.data.noPenaltyWithdraw.age }" :title="yearly.title">
          <td v-if="state.data.columns.age">{{yearly.age}}</td>
          <td v-if="state.data.columns.year">{{yearly.year}}</td>
          <td v-if="state.data.columns.salary">{{toDisplayDollar(yearly.salary, yearly)}}</td>
          <td v-if="state.data.columns.contrib">{{toDisplayDollar(yearly.k401, yearly)}}</td>
          <td v-if="state.data.columns.contribRoth">{{toDisplayDollar(yearly.roth401k, yearly)}}</td>
          <td v-if="state.data.columns.rmd">{{toDisplayDollar(yearly.rmd, yearly)}}</td>
          <td v-if="state.data.columns.spending" class="spending" :title="yearly.additionalExpense ? 'Includes one-time expenses of ' + toDisplayDollar(yearly.additionalExpense, yearly) : ''">-{{toDisplayDollar(yearly.spending, yearly)}}</td>
          <td v-if="state.data.columns.conversionAmount" class="roth-conversion">{{toDisplayDollar(yearly.conversionAmount, yearly)}}</td>
          <td v-if="state.data.columns.pretax"><span :class="{negative: yearly.pretaxBalance < 0, positive: yearly.pretaxBalance > 0}" :title="getPretaxTooltip(yearly)">{{toDisplayDollar(yearly.pretaxBalance, yearly)}}</span></td>
          <td v-if="state.data.columns.roth"><span :class="{negative: yearly.roth < 0, positive: yearly.roth > 0}" :title="getRothTooltip(yearly)">{{toDisplayDollar(yearly.roth, yearly)}}</span></td>
          <td v-if="state.data.columns.investment"><span :class="{negative: yearly.investment < 0, positive: yearly.investment > 0}" :title="getInvestmentTooltip(yearly)">{{toDisplayDollar(yearly.investment, yearly)}}</span></td>
          <td v-if="state.data.columns.medicare"><span :class="{negative: yearly.medicare > 0}">-{{toDisplayDollar(yearly.medicare, yearly)}}</span></td>
          <td v-if="state.data.columns.ss"><span :class="{positive: yearly.ss > 0}">{{toDisplayDollar(yearly.ss, yearly)}}</span></td>
          <td v-if="state.data.columns.tax"><span :class="{negative: yearly.tax > 0}" :title="getTaxTooltip(yearly)">-{{toDisplayDollar(yearly.tax, yearly)}}</span></td>
          <td v-if="state.data.columns.netWorth"><span :class="{negative: yearly.netWorth < 0, positive: yearly.netWorth > 0}" :title="getNetWorthTooltip(yearly)">{{toDisplayDollar(yearly.netWorth, yearly)}}</span></td>
        </tr>
      </tbody>
    </table>
  `,
});
