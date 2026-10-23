import { defineComponent } from "vue";

export default defineComponent({
  name: "InfoTab",
  props: ["state", "actions"],
  template: `
    <details class="info-accordion">
      <summary class="info-accordion-summary">Projected Tax Rates</summary>
      <div class="info-accordion-body">
        <p>Calculated with historical 1.7% increase in bracket ceilings each year, and accounted for 2025 trump tax (Tax Cuts and Jobs Act) brackets.</p>
        <table class="table table-hover table-strip">
          <thead>
            <tr>
              <th>Year</th>
              <th>Rate</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="y in state.data.tax.brackets.filter(x => x.year >= (new Date()).getFullYear())">
              <td>{{y.year}}</td>
              <td>
                <table class="table table-sm mb-0">
                  <tr v-for="b in y.data">
                    <td>{{actions.toPercent(b.percent)}}</td>
                    <td>{{actions.toDollar(b.income)}}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>

    <details class="info-accordion">
      <summary class="info-accordion-summary">Projected Medicare Ceilings</summary>
      <div class="info-accordion-body">
        <p>Estimated MAGI thresholds and monthly premiums for Medicare income-related adjustment amounts (IRMAA). These ceilings are projected using the current 5.5% premium increase and 4.2% ceiling increase assumptions.</p>
        <table class="table table-hover table-strip">
          <thead>
            <tr>
              <th>Year</th>
              <th>MAGI Ceilings</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="y in (state.data.medicare.premiums || []).filter(x => x.year >= (new Date()).getFullYear())">
              <td>{{y.year}}</td>
              <td>
                <table class="table table-sm mb-0">
                  <tr v-for="p in y.data">
                    <td>{{actions.toDollar(p.ceiling)}}</td>
                    <td>{{actions.toDollar(p.monthly)}}</td>
                  </tr>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </details>
  `,
});
