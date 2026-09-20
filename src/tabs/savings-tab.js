import { defineComponent } from "vue";

export default defineComponent({
  name: "SavingsTab",
  props: ["state", "actions"],
  template: `
    <div class="row">
      <h6>Current Savings (you and spouse)</h6>
      <div class="col-4">
        <label for="pretaxBalance">Current Pretax Balance:</label>
        <div class="input-group">
          <input id="pretaxBalance" class="form-control" :value="actions.toDollar(state.data.person.pretaxBalance)" @focus="e => { e.target.value = String(state.data.person.pretaxBalance ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.pretaxBalance = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.pretaxBalance ?? 0); } }" type="text" step="100" />
        </div>
      </div>
      <div class="col-4">
        <label for="rothBalance">Current Roth Balance:</label>
        <div class="input-group">
          <input id="rothBalance" class="form-control" :value="actions.toDollar(state.data.person.roth)" @focus="e => { e.target.value = String(state.data.person.roth ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.roth = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.roth ?? 0); } }" type="text" min="0" step="1000" />
        </div>
      </div>
      <div class="col-4">
        <label for="investmentBalance">Current Post Tax Investment:</label>
        <div class="input-group">
          <input id="investmentBalance" class="form-control" :value="actions.toDollar(state.data.person.investment)" @focus="e => { e.target.value = String(state.data.person.investment ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.person.investment = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.person.investment ?? 0); } }" type="text" min="1" step="1000" />
        </div>
      </div>
    </div>
    <hr />
    <div class="row">
      <h6>Rate of return</h6>
      <div class="col-4">
        <label for="annualReturnBefore">Annual Return Before Retirement:</label>
        <div class="input-group">
          <input id="annualReturnBefore" class="form-control" v-model="state.data.annualReturn.beforeRetirement" type="number" min="1" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="annualReturnAfter">Annual Return After Retirement:</label>
        <div class="input-group">
          <input id="annualReturnAfter" class="form-control" v-model="state.data.annualReturn.afterRetirement" type="number" min="1" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
    </div>
    <hr />
    <div>
      <h5>Net worth <b>{{actions.toDollar(state.data.person.roth + state.data.person.investment + state.data.person.pretaxBalance)}}</b>.</h5>
    </div>
  `,
});
