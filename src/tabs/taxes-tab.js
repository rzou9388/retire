import { defineComponent } from "vue";

export default defineComponent({
  name: "TaxesTab",
  props: ["state", "actions"],
  template: /* html */ `
    <div class="row">
      <div class="col-4">
        <label for="stateTaxBefore">State Tax (Before Retirement)</label>
        <div class="input-group">
          <input id="stateTaxBefore" class="form-control" v-model="state.data.tax.state.beforeRetirement" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="stateTaxAfter">State Tax (After Retirement)</label>
        <div class="input-group">
          <input id="stateTaxAfter" class="form-control" v-model="state.data.tax.state.afterRetirement" type="number" min="0" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
      <div class="col-4">
        <label for="inflation">Inflation</label>
        <div class="input-group">
          <input id="inflation" class="form-control" v-model="state.data.inflation" type="number" step="1" @change="actions.calculate" />
          <span class="input-group-text">%</span>
        </div>
      </div>
    </div>
    <div>
      <h5>Taxes</h5>
      <div class="mt-3">
        <ul>
          <li>Federal Ordinary Income Tax uses the selected filing status (see projected tax brackets below) and increases bracket ceilings by 1.6% each year.</li>
          <li>Federal Capital Gain Tax (0%/15%/20%/23.8% for long term)</li>
            <ul>
              <li>fixed federal <b>15%</b> is used by the calculator</li>
            </ul>
          <li>FICA includes Social Security (6.2%) and Medicare (1.45%), plus an additional 0.9% Medicare tax above the filing-status threshold; no FICA is applied to capital gains or Roth conversions.</li>
          <li>Medicare Surtax of 3.8% on capital gains and Medicare premium income thresholds vary by filing status.</li>
          <li>State Tax inputs allows different taxes for before and after retirement.</li>
          <li>Long-term capital gains can't push you into a higher tax bracket</li>
        </ul>
      </div>
      <div class="mt-3">
        <div>
          <h6><b>Social Security benefits tax: </b></h6>
          Depending on your 'provisional income', 0%-85% of SSN income is taxed.
          'Provisional income' includes gross income (wages, interest, dividend, pension, rent income), tax-free interest (municipal bond) and 1/2 of SS Benefits.
          <ul>
            <li>Single and head of household: less than $25,000 = 0%, between $25,000 and $34,000 = 50%, above $34,000 = 85%.</li>
            <li>Married filing jointly: less than $32,000 = 0%, between $32,000 and $44,000 = 50%, above $44,000 = 85%.</li>
            <li>Note: provisional income is not inflation adjusted.</li>
          </ul>
          The resulting percentage of SS Benefits is subject to ordinary income tax rate.
          <br />Note: The calculation assumes there's no state tax for SS benefits.
          <br />Note: Roth IRA distributions are not included in the provisional income calculation.
        </div>
        <hr />
        <div>
          <h6><b>Buckets to withdraw to minimize tax: </b></h6>
          <ul>
            <li>Use tax-deferred accounts (401k, traditional IRA) to reduce taxable income in early retirement years when you may have little to no income, and fill up the lower tax brackets first.</li>
            <li>Use Roth accounts for tax free growth and tax free withdraws in later years, especially after RMD starts, to avoid pushing you into higher tax brackets.</li>
            <li>Use post-tax investment account for more flexibility, but be mindful of capital gain tax. The 0% long-term capital-gain threshold depends on filing status.</li>
          </ul>
        </div>
      </div>
    </div>
  `,
});
