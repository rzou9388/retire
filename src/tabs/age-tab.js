import { defineComponent } from "vue";

export default defineComponent({
  name: "AgeTab",
  props: ["state", "actions"],
  template: `
    <div class="row">
      <div class="col-4">
        <label for="txtAge">Current Age:</label>
        <input id="txtAge" class="form-control" v-model="state.data.person.age" step="1" type="number" @change="actions.recalculate" max="100" />
      </div>
      <div class="col-4">
        <label for="retirementAge">Retirement Age:</label>
        <input id="retirementAge" class="form-control" v-model="state.data.person.retirement.age" step="1" type="number" @change="actions.recalculate" />
      </div>
      <div class="col-4">
        <label for="txtYears">Retire In Years:</label>
        <input id="txtYears" class="form-control" :value="state.data.person.retirement.age - state.data.person.age" type="number" disabled />
      </div>
      <div class="col-4">
        <label for="noPenaltyWithdrawAge">IRA no-penalty withdraw age 59.5:</label>
        <input id="noPenaltyWithdrawAge" class="form-control" :value="state.data.noPenaltyWithdraw.age" type="number" disabled />
      </div>
      <div class="col-4">
        <label for="medicareAge">Medicare Age:</label>
        <input id="medicareAge" class="form-control" :value="state.data.medicare.age" type="number" disabled />
      </div>
      <div class="col-4">
        <label for="rmdAge">Required Minimum Distribution Age:</label>
        <input id="rmdAge" class="form-control" v-model="state.data.rmd.age" type="number" disabled />
      </div>
      <div class="col-4">
        <label for="ssAge">Social Security Benefit Age (62-70):</label>
        <input id="ssAge" class="form-control" v-model="state.data.person.ss.age" type="number" @change="actions.recalculate" min="62" max="70" />
      </div>
      <div class="col-4">
        <label for="lifeExpectancy">Life Expectancy (Age):</label>
        <input id="lifeExpectancy" class="form-control" v-model="state.data.person.deceased.age" type="number" @change="actions.recalculate" max="100" />
      </div>
    </div>
    <hr />
    <div>
      <h5>Summary</h5>
      You are <b>{{state.data.person.age}}</b> years old,
      you are planning to retire in <b>{{state.data.person.retirement.age - state.data.person.age}}</b>
      years in <b>{{state.data.person.retirement.year}}</b> at the age of
      <b>{{state.data.person.retirement.age}}</b> (beginning of the year).
      You can start penalty free withdrawing from your traditional 401k/IRA accounts at
      <b>{{state.data.noPenaltyWithdraw.age}}</b>(59.5), your medicare will kick in when you are
      <b>{{state.data.medicare.age}}</b>, and your social security retirement benefit starts at
      <b>{{state.data.person.ss.age}}</b>.
      When you are
      <b>{{state.data.rmd.age}}</b>, you'll be required to withdraw (RMD) from your traditional tax
      deferred accounts (IRA, 401k).
      Your life expectancy age is
      <b>{{state.data.person.deceased.age}}</b>.
      Your total number of years in retirement is
      <b>{{state.data.person.deceased.age - state.data.person.retirement.age}}</b>.
    </div>
  `,
});
