import { defineComponent } from "vue";

export default defineComponent({
  name: "SpendingTab",
  props: ["state", "actions"],
  template: `
    <div>
      <div class="row">
        <div class="col-4">
          <label for="beforeRetirementSpending">Yearly (Before Retirement)</label>
          <div class="input-group">
            <input id="beforeRetirementSpending" class="form-control" :value="actions.toDollar(state.data.spending.beforeRetirement)" @focus="e => { e.target.value = String(state.data.spending.beforeRetirement ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.spending.beforeRetirement = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.spending.beforeRetirement ?? 0); } }" type="text" step="10000" />
          </div>
        </div>
        <div class="col-4">
          <label for="afterRetirementSpending">Yearly (After Retirement)</label>
          <div class="input-group">
            <input id="afterRetirementSpending" class="form-control" :value="actions.toDollar(state.data.spending.afterRetirement)" @focus="e => { e.target.value = String(state.data.spending.afterRetirement ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.spending.afterRetirement = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.spending.afterRetirement ?? 0); } }" type="text" step="10000" />
          </div>
        </div>
        <div class="col-4">
          <label for="retirementHealthInsurance">Yearly Retirement Health Insurance (Before Medicare)</label>
          <div class="input-group">
            <input id="retirementHealthInsurance" class="form-control" :value="actions.toDollar(state.data.spending.insurance)" @focus="e => { e.target.value = String(state.data.spending.insurance ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.spending.insurance = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.spending.insurance ?? 0); } }" type="text" step="1000" />
          </div>
        </div>
        <div>
          Your estimated yearly spending <b>before</b> retirement is
          <b>{{actions.toDollar(state.data.spending.beforeRetirement)}}</b>,
          monthly spending is <b>{{actions.toDollar(state.data.spending.beforeRetirement / 12)}}</b>,
          this should include:
          <ul>
            <li>Housing</li>
            <li>Your expensive kid(s) - tuition, activities, etc</li>
          </ul>
        </div>
        <div>
          Your estimated yearly spending <b>after</b> retirement is
          <b>{{actions.toDollar(state.data.spending.afterRetirement)}}</b>, monthly spending is
          <b>{{actions.toDollar(state.data.spending.afterRetirement / 12)}}</b>:
          <ul>
            <li>Lower housing expenses, and hopefully no more mortgage</li>
            <li>Higher medical expenses</li>
            <li>More traveling</li>
          </ul>
        </div>
        <div>
          Your estimated starting Medicare year <b>{{state.data.medicare.year}}</b>
        </div>
        <div v-if="state.data.person.retirement.age < state.data.medicare.age">
          When you retire in <b>{{state.data.person.retirement.age - state.data.person.age}}</b> years at
          <b>{{state.data.person.retirement.age}}</b>,
          you are not yet qualified for Medicare, your estimated your monthly health insurance out
          of pocket before Medicare kicks in is
          <b>{{actions.toDollar(state.data.spending.insurance / 12)}}</b>.
        </div>
        <div class="mt-3">
          Your spending will be adjusted for <b>{{actions.toPercent(state.data.inflation)}}</b> inflation every year.
        </div>
      </div>
    </div>
  `,
});
