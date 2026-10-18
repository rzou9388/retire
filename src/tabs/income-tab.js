import { defineComponent } from "vue";

export default defineComponent({
  name: "IncomeTab",
  props: ["state", "actions"],
  template: /* html */ `
    <div class="row income-person-row">
      <h6>Self</h6>
      <div class="col-md-2">
        <label for="selfSalary">Annual Salary:</label>
        <div class="input-group">
          <input id="selfSalary" class="form-control" :value="actions.toDollar(state.data.person.salary)" @focus="e => { e.target.value = String(state.data.person.salary ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.salary = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.salary ?? 0); } }" type="text" min="0" step="1000" />
        </div>
      </div>
      <div class="col-md-2">
        <label for="selfMeritIncrease">Merit Increase:</label>
        <div class="input-group">
          <input id="selfMeritIncrease" class="form-control" v-model="state.data.person.meritIncrease" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="employee401k">401(k) Contribution:</label>
        <div class="input-group">
          <input id="employee401k" class="form-control" v-model="state.data.contrib.employeePercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="employeeRoth401k">Roth 401(k) Contribution:</label>
        <div class="input-group">
          <input id="employeeRoth401k" class="form-control" v-model="state.data.contrib.roth401kPercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="employerMatch">Employer Match:</label>
        <div class="input-group">
          <input id="employerMatch" class="form-control" v-model="state.data.contrib.employerPercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="matchUpTo">Match Up To:</label>
        <div class="input-group">
          <input id="matchUpTo" class="form-control" v-model="state.data.contrib.employerMatchUpTo" type="number" min="0" max="10" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
    </div>
    <hr />
    <div class="row income-person-row">
      <h6>Spouse</h6>
      <div class="col-md-2">
        <label for="spouseSalary">Annual Salary:</label>
        <div class="input-group">
          <input id="spouseSalary" class="form-control" :value="actions.toDollar(state.data.person.spouse.salary)" @focus="e => { e.target.value = String(state.data.person.spouse.salary ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.spouse.salary = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.spouse.salary ?? 0); } }" type="text" min="0" step="1000" />
        </div>
      </div>
      <div class="col-md-2">
        <label for="spouseMeritIncrease">Merit Increase:</label>
        <div class="input-group">
          <input id="spouseMeritIncrease" class="form-control" v-model="state.data.person.spouse.meritIncrease" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="spouse401k">401(k) Contribution:</label>
        <div class="input-group">
          <input id="spouse401k" class="form-control" v-model="state.data.contrib.spouse.employeePercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="spouseRoth401k">Roth 401(k) Contribution:</label>
        <div class="input-group">
          <input id="spouseRoth401k" class="form-control" v-model="state.data.contrib.spouse.roth401kPercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="spouseEmployerMatch">Employer Match:</label>
        <div class="input-group">
          <input id="spouseEmployerMatch" class="form-control" v-model="state.data.contrib.spouse.employerPercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-md-2">
        <label for="spouseMatchUpTo">Match Up To:</label>
        <div class="input-group">
          <input id="spouseMatchUpTo" class="form-control" v-model="state.data.contrib.spouse.employerMatchUpTo" type="number" min="0" max="10" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
    </div>
    <hr />
    <div class="row">
      <div class="col-4">
        <label for="ssBenefitAge">Social Security Benefit Age (62-70):</label>
        <input id="ssBenefitAge" class="form-control" v-model="state.data.person.ss.age" type="number" @change="actions.recalculate" min="62" max="70" />
      </div>
      <div class="col-4">
        <label :for="'monthlySocialSecurity'">Monthly Social Security Income (age <b>{{state.data.person.ss.age}}</b>):</label>
        <div class="input-group">
          <input id="monthlySocialSecurity" class="form-control" :value="actions.toDollar(state.data.person.ss.perMonth, 2)" @focus="e => { e.target.value = String(state.data.person.ss.perMonth ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.ss.perMonth = parsed; e.target.value = actions.toDollar(parsed, 2); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.ss.perMonth ?? 0, 2); } }" type="text" min="0" step="100" />
        </div>
      </div>
    </div>
    <hr />
    <div>
      <div class="d-flex align-items-center justify-content-between">
        <h5>Additional Income or Expenses</h5>
        <button class="btn btn-outline-primary btn-sm" type="button" @click="state.data.investmentContributions.push({ label: '', type: 'income', age: state.data.person.age, amount: 0 }); actions.calculate()">Add event</button>
      </div>
      <p>Add one-time income, such as selling a home, or expenses, such as buying a car, at the selected age. Income is added to investments; taxes on proceeds are not estimated.</p>
      <div v-for="(contribution, index) in state.data.investmentContributions" :key="index" class="row g-2 align-items-end mb-2">
        <div class="col-md-4">
          <label :for="'investmentContributionLabel' + index">Description:</label>
          <input :id="'investmentContributionLabel' + index" class="form-control" v-model="contribution.label" type="text" placeholder="Home sale, car purchase, etc" @change="actions.calculate" />
        </div>
        <div class="col-md-2">
          <label :for="'investmentContributionAge' + index">Age:</label>
          <input :id="'investmentContributionAge' + index" class="form-control" v-model.number="contribution.age" type="number" min="0" step="1" @change="actions.calculate" />
        </div>
        <div class="col-md-2">
          <label :for="'investmentContributionType' + index">Type:</label>
          <select :id="'investmentContributionType' + index" class="form-select" :value="contribution.type || 'income'" @change="contribution.type = $event.target.value; actions.calculate()">
            <option value="income">Income</option>
            <option value="expense">Expense</option>
          </select>
        </div>
        <div class="col-md-3">
          <label :for="'investmentContributionAmount' + index">Amount:</label>
          <div class="input-group">
            <span class="input-group-text">$</span>
            <input :id="'investmentContributionAmount' + index" class="form-control" v-model.number="contribution.amount" type="number" min="0" step="1000" @change="actions.calculate" />
          </div>
        </div>
        <div class="col-md-1 d-flex align-items-end justify-content-center">
          <button class="btn btn-outline-danger btn-sm mt-4" type="button" :aria-label="'Remove ' + (contribution.label || 'income or expense')" @click="state.data.investmentContributions.splice(index, 1); actions.calculate()">&times;</button>
        </div>
      </div>
    </div>
    <hr />
    <div>
      <h5>Summary</h5>
      Your current household earned income is <b>{{actions.toDollar(state.data.person.salary + state.data.person.spouse.salary)}}</b>, you
      expect annual merit increases of <b>{{actions.toPercent(state.data.person.meritIncrease)}}</b> for you and
      <b>{{actions.toPercent(state.data.person.spouse.meritIncrease)}}</b> for your spouse.
      <div v-if="state.data.contrib.totalPercent > 0">
        Your estimated annual 401(k) contribution including employer match is <b>{{actions.toDollar(state.data.person.salary * state.data.contrib.totalPercent / 100)}}</b> for you.
      </div>
      <div v-if="state.data.contrib.rothTotalPercent > 0">
        Your estimated annual Roth 401(k) contribution including employer match is <b>{{actions.toDollar(state.data.person.salary * state.data.contrib.rothTotalPercent / 100)}}</b> for you.
      </div>
      <div v-if="state.data.person.spouse.salary > 0 && state.data.contrib.spouse.totalPercent > 0">
        Your spouse's estimated annual 401(k) contribution including employer match is <b>{{actions.toDollar(state.data.person.spouse.salary * state.data.contrib.spouse.totalPercent / 100)}}</b>.
      </div>
      <div v-if="state.data.person.spouse.salary > 0 && state.data.contrib.spouse.rothTotalPercent > 0">
        Your spouse's estimated annual Roth 401(k) contribution including employer match is <b>{{actions.toDollar(state.data.person.spouse.salary * state.data.contrib.spouse.rothTotalPercent / 100)}}</b>.
      </div>
    </div>
  `,
});
