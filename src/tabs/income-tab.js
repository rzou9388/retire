import { defineComponent } from "vue";

export default defineComponent({
  name: "IncomeTab",
  props: ["state", "actions"],
  template: `
    <div class="row">
      <h6>Salary based income and savings (you and spouse)</h6>
      <div class="col-4">
        <label for="currentCombinedSalary">Current Combined Salary:</label>
        <div class="input-group">
          <input id="currentCombinedSalary" class="form-control" :value="actions.toDollar(state.data.person.salary)" @focus="e => { e.target.value = String(state.data.person.salary ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.salary = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.salary ?? 0); } }" type="text" min="0" step="1000" />
        </div>
      </div>
      <div class="col-4">
        <label for="meritIncrease">Merit Increase:</label>
        <div class="input-group">
          <input id="meritIncrease" class="form-control" v-model="state.data.meritIncrease" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="employee401k">Employee 401k Contribution:</label>
        <div class="input-group">
          <input id="employee401k" class="form-control" v-model="state.data.contrib.employeePercent" type="number" min="1" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="employeeRoth401k">Employee <b>Roth</b> 401k Contribution:</label>
        <div class="input-group">
          <input id="employeeRoth401k" class="form-control" v-model="state.data.contrib.roth401kPercent" type="number" min="1" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="employerMatch">Employer 401k Match:</label>
        <div class="input-group">
          <input id="employerMatch" class="form-control" v-model="state.data.contrib.employerPercent" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="matchUpTo">Employer 401k Match Up To:</label>
        <div class="input-group">
          <input id="matchUpTo" class="form-control" v-model="state.data.contrib.employerMatchUpTo" type="number" min="0" max="10" step="1" @change="actions.calculate" />
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
          <input id="monthlySocialSecurity" class="form-control" :value="actions.toDollar(state.data.person.ss.perMonth)" @focus="e => { e.target.value = String(state.data.person.ss.perMonth ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.ss.perMonth = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.ss.perMonth ?? 0); } }" type="text" min="0" step="100" />
        </div>
      </div>
    </div>
    <hr />
    <div>
      <h5>Summary</h5>
      Your current household earned income is <b>{{actions.toDollar(state.data.person.salary)}}</b>, you
      expect annual merit increase of <b>{{actions.toPercent(state.data.meritIncrease)}}</b>.
      <div v-if="state.data.contrib.totalPercent > 0">
        Your current tax deferred retirement accounts have <b>{{actions.toDollar(state.data.person.pretaxBalance)}}</b>, you are contributing
        <b>{{actions.toPercent(state.data.contrib.employeePercent)}}</b> of your salary to 401k, and your employer contributes
        <b>{{actions.toPercent(state.data.contrib.employerPercent)}}</b> of your contribution up to <b>{{actions.toPercent(state.data.contrib.employerMatchUpTo)}}</b>, total contribution is <b>{{actions.toPercent(state.data.contrib.totalPercent)}}</b> of your salary each year. Your current year 401k contribution calculates to be
        <b>{{actions.toDollar(state.data.person.salary * state.data.contrib.totalPercent / 100)}}</b>.
      </div>
      <div v-if="state.data.contrib.rothTotalPercent > 0">
        Your current Roth retirement accounts have <b>{{actions.toDollar(state.data.person.roth)}}</b>, you are contributing
        <b>{{actions.toPercent(state.data.contrib.roth401kPercent)}}</b> of your salary to Roth 401k, and your employer contributes
        <b>{{actions.toPercent(state.data.contrib.employerPercent)}}</b> of your contribution up to <b>{{actions.toPercent(state.data.contrib.employerMatchUpTo)}}</b>, total contribution is <b>{{actions.toPercent(state.data.contrib.rothTotalPercent)}}</b> of your salary each year. Your current year Roth 401k contribution calculates to be
        <b>{{actions.toDollar(state.data.person.salary * state.data.contrib.rothTotalPercent / 100)}}</b>.
      </div>
    </div>
  `,
});
