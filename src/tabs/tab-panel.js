import { defineComponent } from "vue";
import AgeTab from "./age-tab.js";
import IncomeTab from "./income-tab.js";
import SavingsTab from "./savings-tab.js";
import SpendingTab from "./spending-tab.js";
import RothTab from "./roth-tab.js";
import TaxesTab from "./taxes-tab.js";
import YearlyTab from "./yearly-tab.js";
import InfoTab from "./info-tab.js";

const components = {
  AgeTab,
  IncomeTab,
  SavingsTab,
  SpendingTab,
  RothTab,
  TaxesTab,
  YearlyTab,
  InfoTab,
};

export default defineComponent({
  name: "TabPanel",
  props: ["activeTab", "tabId", "state", "actions"],
  components,
  computed: {
    currentComponent() {
      const map = {
        age: "AgeTab",
        income: "IncomeTab",
        savings: "SavingsTab",
        spending: "SpendingTab",
        roth: "RothTab",
        taxes: "TaxesTab",
        yearly: "YearlyTab",
        info: "InfoTab",
      };
      return map[this.tabId] || null;
    },
    shouldRender() {
      return this.activeTab === this.tabId;
    },
  },
  template: `
    <div v-if="shouldRender">
      <component :is="currentComponent" :state="state" :actions="actions" />
    </div>
  `,
});
