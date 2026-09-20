import { defineComponent } from "vue";

export default defineComponent({
  name: "InfoTab",
  props: ["state", "actions"],
  template: `
    <details>
      <summary>Projected Tax Rates</summary>
      <div class="row">
        Calculated with historical 1.7% increase in bracket ceilings each year, and accounted for 2025 trump tax (Tax Cuts and Jobs Act) brackets.
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
                <table>
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
  `,
});
