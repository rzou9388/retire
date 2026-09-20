import { defineComponent } from "vue";

export default defineComponent({
  name: "RothTab",
  props: ["state", "actions"],
  template: `
    <div class="row">
      <div class="col-4">
        <label for="rothConversionAge">Age to start Roth Conversion</label>
        <input id="rothConversionAge" class="form-control" v-model="state.data.rothConversion.age" type="number" min="40" step="1" @change="actions.calculate" />
      </div>
      <div class="col-4">
        <label for="rothConversionBracket" title="Projected retirement age tax brackets shown">Conversion based on tax bracket</label>
        <select id="rothConversionBracket" @change="actions.calculate" class="form-select" v-model="state.data.rothConversion.bracket">
          <option value="0">0%</option>
          <option v-for="b in actions.getTaxBracketsForYear(state.data.rothConversion.year).data" :value="b.percent">{{b.percent}}% - {{actions.toDollar(b.income)}}</option>
        </select>
      </div>
      <div class="col-4">
        <label for="rothConversionOffset" title="">- or + $ amount from the bracket</label>
        <div class="input-group">
          <input id="rothConversionOffset" class="form-control" :value="actions.toDollar(state.data.rothConversion.offset)" @focus="e => { e.target.value = String(state.data.rothConversion.offset ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.rothConversion.offset = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.rothConversion.offset ?? 0); } }" type="text" step="1000" />
        </div>
      </div>
    </div>
    <div class="row mt-4">
      <div class="col-12">
        <h6>Stage 2: When pre-tax balance is managable (e.g. ≤ $500k, bleed to prepare for RMD)</h6>
      </div>
      <div class="col-4">
        <label for="rothConversion2Age">Age to start Stage 2</label>
        <input id="rothConversion2Age" class="form-control" v-model="state.data.rothConversion2.age" type="number" min="40" step="1" @change="actions.calculate" />
      </div>
      <div class="col-4">
        <label for="rothConversion2Bracket">Stage 2 - Tax bracket</label>
        <select id="rothConversion2Bracket" @change="actions.calculate" class="form-select" v-model.number="state.data.rothConversion2.bracket">
          <option :value="0">0%</option>
          <option v-for="b in actions.getTaxBracketsForYear(state.data.rothConversion2.year).data" :value="b.percent">{{b.percent}}% - {{actions.toDollar(b.income)}}</option>
        </select>
      </div>
      <div class="col-4">
        <label for="rothConversion2Offset">Stage 2 - Offset</label>
        <div class="input-group">
          <input id="rothConversion2Offset" class="form-control" :value="actions.toDollar(state.data.rothConversion2.offset)" @focus="e => { e.target.value = String(state.data.rothConversion2.offset ?? 0); }" @blur="e => { const raw = String(e.target.value).replace(/[$,\s]/g, ''); const parsed = Number.parseFloat(raw); if (Number.isFinite(parsed)) { state.data.rothConversion2.offset = parsed; e.target.value = actions.toDollar(parsed); actions.calculate(); } else { e.target.value = actions.toDollar(state.data.rothConversion2.offset ?? 0); } }" type="text" step="1000" />
        </div>
      </div>
    </div>
    <div class="mt-4">
      <h5>Roth Conversion Strategy</h5>
      2 stage Roth conversion strategy is designed to minimize the total tax paid on your retirement, and to prepare for the required minimum distribution (RMD) at age <b>{{state.data.rmd.age}}</b>.
      It allows aggressive conversion in the early stage of retirement when you may have little to no income, and slows down the conversion in later stage of retirement to avoid pushing you into higher tax brackets when RMD starts.
      <p><strong>Stage 1:</strong> After retirement begins at age <b>{{state.data.person.retirement.age}}</b>, aggressive Roth conversion fills the <b>{{actions.toPercent(state.data.rothConversion.bracket)}}</b> tax bracket annually.</p>
      <p><strong>Stage 2:</strong> Once pre-tax balance drops to manageable level (e.g. $500k), the conversion slows down and is managed carefully to "bleed" the balance so that by age <b>{{state.data.rmd.age}}</b> (RMD start), the required minimum distribution won't push you into higher capital gains tax brackets.</p>
    </div>
    <div class="mt-3">
      <h5>Required Minimum Distribution <b>{{state.data.rmd.year}}</b> (age <b>{{state.data.rmd.age}}</b>)</h5>
      <div class="mt-3">When you reach the age of <b>{{state.data.rmd.age}}</b>, you'll be required to take "Required Minimum Distribution" from your tax deferred traditional 401k/IRA accounts, and distribution is taxed at the ordinary income rate.</div>
      <div class="mt-3">The 'ordinary income' also means that you'll have taxable income, which affects the tax you pay, your Medicare payment, and Social Security retirement benefit taxes. However, there are some tax benefits of keeping some money in the tax-deferred accounts, you want the amount to be low enough that you won't be forced to take out a lot each year. The RMD money you are forced to take out cannot be directly converted to Roth IRA. The IRS requires that you take the RMD for the year before you can perform a Roth conversion.</div>
      <div class="mt-3">The strategy is to convert your traditional 401k/IRA to Roth IRA as early as possible (typically after you retire), you'll pay taxes for the years of conversion; once converted, your roth balance, including gains, won't be taxed again, and there's no required minimum distribution, nor will your withdraws from Roth count as taxable income.</div>
      <div class="mt-3">Your Roth conversion starts at <b>{{state.data.rothConversion.age}}</b>, and fills up the <b>{{actions.toPercent(state.data.rothConversion.bracket)}}</b>tax bracket; <span v-if="state.data.yearlyData.find(x => x.pretaxBalance == 0)">at <b>{{state.data.yearlyData.find(x => x.pretaxBalance == 0).age - 1}}</b>, your tax deferred accounts will have <b>$0.00</b></span> at <b>{{state.data.rmd.age}}</b>, your tax deferred accounts will have <b>{{actions.toDollar(state.data.rmd.pretaxBalance)}}</b>.
        <div v-if="state.data.rmd.pretaxBalance > 0">you'll be required to withdraw <b>{{actions.toDollar(state.data.rmd.pretaxBalance)}}</b> / 27.4 = <b>{{actions.toDollar(state.data.rmd.rmd)}}</b> on first year and increases percentage wise every year after. Your tax bill on that first year distribution is around <b>{{actions.toDollar(actions.calculateOrdinaryIncomeTaxForYear(state.data.rmd.rmd, state.data.rmd.year))}}</b>.</div>
      </div>
    </div>
  `,
});
