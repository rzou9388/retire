import { defineComponent } from "vue";

export default defineComponent({
  name: "TaxesTab",
  props: ["state", "actions"],
  template: `
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
          <li>Federal Ordinary Income Tax (see table below) - with historical 1.7% increase in bracket ceilings each year</li>
          <li>Federal Capital Gain Tax (0%/15%/20%/23.8% for long term)</li>
            <ul>
              <li> 2026 15%: $613k for married filing jointly; up to $545k for single; $579k for head of household; $272k for married filing separately
              </li>
              <li>fixed federal <b>15%</b> is used by the calculator</li>
            </ul>
          <li>FICA (SS & Medicare), 6.2%, and extra 0.9% for portion of salary income over $250,000; no FICA on capital gains or roth conversion.</li>
          <li>Medicare Surtax 3.8% on Capital Gain for MAGI over $250,000.</li>
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
            <li>For single filer (tax): if provisional income is less than 25000, 0%; between 25000 and 34000, then 50%, above 34000 = 85%.</li>
            <li>Married Filing Jointly: less than 32,000 = 0%, between 32000 and 44000 = 50%, > 44000, then 85%.</li>
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
            <li>Use post-tax investment account for more flexibility, but be mindful of capital gain tax. Keep in mind that there's 0% long term capital gain tax when MAGI is below threshold (e.g. $98,900 for MFJ for 2026).</li>
            <li>example: $98,900 + $32,200 (standard deduction) - $40,000 (SS) - $50,000 (Pretax withdraw) = $41,100 investment gain that you can realize with 0% tax.</li>
          </ul>
        </div>
      </div>
    </div>
  `,
});
