import { createApp } from "vue";
const app = createApp({
    data() {

        let savedData = JSON.parse(localStorage.getItem("data"));
        if (savedData) {
            savedData.tax.brackets = [];
            savedData.medicare.premiums = [];
            savedData.yearlyData = [];
            if (savedData.distribution.bracket == 15) {  // reset previous 15 before BBB
                savedData.distribution.bracket = 0;
            }
            return { data: savedData };
        }

        // lifetimetable used to calculate how much rmd for age
        // https://www.irs.gov/publications/p590b#en_US_2021_publink100090093
        const uniformLifetimeTable = [
            [72, 27.4], [73, 26.5], [74, 25.5], [75, 24.6], [76, 23.7], [77, 22.9], [78, 22], [79, 21.1], [80, 20.2], [81, 19.4], [82, 18.5],
            [83, 17.7], [84, 16.8], [85, 16], [86, 15.2], [87, 14.4], [88, 13.7], [89, 12.9], [90, 12.2], [91, 11.5], [92, 10.8],
            [93, 10.1], [94, 9.5], [95, 8.9], [96, 8.4], [97, 7.8], [98, 7.3], [99, 6.8], [100, 6.4]
        ];

        // initial data
        return {
            activeSummaryTab: 'current',
            summaryTabs: [
                { id: 'current', label: 'Current Year' },
                { id: 'retirement', label: 'Retirement Year' },
                { id: 'withdraw', label: 'Penalty Free Withdraw Year' },
                { id: 'rmd', label: 'Required Minimum Distribution Year' },
                { id: 'end', label: 'End of Life Year' }
            ],
            data: {
                columns: {
                    age: true, year: true, salary: true, contrib: true, contribRoth: false,
                    rmd: true, spending: true, dist: true, pretax: true, roth: true, investment: true, ss: true,
                    medicare: true, tax: true, netWorth: true
                },
                yearlyData: [],
                spending: { beforeRetirement: 80000, afterRetirement: 70000, insurance: 20000 },
                annualReturn: { beforeRetirement: 12, afterRetirement: 6 },
                distribution: { age: 60, amount: 0, bracket: 12, offset: 0 },
                noPenaltyWithdraw: { age: 60 },
                inflation: 2.8,
                meritIncrease: 2,
                medicare: { age: 65, premiums: [] },
                rmd: { age: 75, pretaxBalance: 0, year: 0, lifetimeTable: uniformLifetimeTable },
                contrib: {  // retirement acct contrib
                    employeePercent: 6, employerPercent: 50, totalPercent: 0,
                    roth401kPercent: 0, rothTotalPercent: 0, employerMatchUpTo: 6
                },
                person: {
                    age: 50, pretaxBalance: 500000, salary: 150000,
                    retirement: {
                        age: 60,
                        year: 0,
                        salary: 0,
                        pretaxBalance: 0
                    },
                    deceased: {
                        age: 88
                    },
                    investment: 100000,
                    roth: 100000,
                    ss: { age: 62, perMonth: 3000 }
                },
                tax: { brackets: [], state: { beforeRetirement: 5, afterRetirement: 0 } }
            }
        }
    },

    methods: {

        calculate() {

            this.data.contrib.totalPercent = this.calculateTotal401kWithMatch(this.data.contrib.employeePercent, this.data.contrib.employerPercent, this.data.contrib.employerMatchUpTo);
            this.data.contrib.rothTotalPercent = this.calculateTotal401kWithMatch(this.data.contrib.roth401kPercent, this.data.contrib.employerPercent, this.data.contrib.employerMatchUpTo);

            this.calculateYearly();

            this.saveState();

            this.data.rmd = this.mergeYearlyDataByAge(this.data.rmd);

            this.data.person.retirement = this.mergeYearlyDataByAge(this.data.person.retirement);

            this.data.distribution = this.mergeYearlyDataByAge(this.data.distribution);

            this.data.person.deceased = this.mergeYearlyDataByAge(this.data.person.deceased);

            this.data.noPenaltyWithdraw = this.mergeYearlyDataByAge(this.data.noPenaltyWithdraw);

            this.data.medicare = this.mergeYearlyDataByAge(this.data.medicare);

            window.setTimeout(updateChart, 200);
        },
        /**
         * recalculate when age changes
         */
        recalculate() {
            this.estimateMedicarePremiumsforAllYears();
            this.calculate();
        },
        mergeYearlyDataByAge(originalData) {
            const oneYearData = this.data.yearlyData.find(y => y.age === originalData.age);
            const merged = { ...originalData, ...oneYearData };
            return merged;
        },
        /**
         * ex: employer = 7%, employer = 50% up to 6%, total = 10
         */
        calculateTotal401kWithMatch(employeePercent, employerPercent, matchUpToPercent) {
            const adjustedEmployeePercent = employeePercent > matchUpToPercent ? matchUpToPercent : employeePercent;
            return employeePercent + adjustedEmployeePercent * (employerPercent / 100);

        },
        saveState() {
            localStorage.setItem("data", JSON.stringify(this.data));
        },
        calculateCompound(val, rate, years, extraContrib = 0) {
            for (let i = 0; i < years; i++) {
                val = val * (1 + rate / 100) + extraContrib;
            }
            return val;
        },
        calculateGain(ignoreRate, amount, rate) {
            if (ignoreRate) { // current year, no gain
                return amount;
            }
            if (amount < 0) {
                return amount;
            }
            return amount * (1 + rate / 100);
        },
        calculateYearly() {
            this.data.yearlyData = [];
            const yearsToCalc = this.data.person.deceased.age - this.data.person.age;
            let age = this.data.person.age;
            let year = (new Date()).getFullYear();
            let pretaxBalance = this.data.person.pretaxBalance;
            let salary = this.data.person.salary;
            let investment = this.data.person.investment;
            let roth = this.data.person.roth;
            let spending = { beforeRetirement: this.data.spending.beforeRetirement, afterRetirement: this.data.spending.afterRetirement };

            for (let i = 0; i <= yearsToCalc; i++) {
                const title = this.getRowTitle(age);

                let spendingAmount = 0;
                //before retirement
                if (age < this.data.person.retirement.age) {
                    salary = this.calculateGain(i === 0, salary, this.data.meritIncrease * this.calculatePercentOfMonthsLeftInYear(year));
                    pretaxBalance = this.calculateGain(i === 0, pretaxBalance, this.data.annualReturn.beforeRetirement * this.calculatePercentOfMonthsLeftInYear(year));
                    investment = this.calculateGain(i === 0, investment, this.data.annualReturn.beforeRetirement * this.calculatePercentOfMonthsLeftInYear(year));
                    roth = this.calculateGain(i === 0, roth, this.data.annualReturn.beforeRetirement * this.calculatePercentOfMonthsLeftInYear(year));
                    spendingAmount = spending.beforeRetirement * this.calculatePercentOfMonthsLeftInYear(year);
                } else { // after retirement
                    salary = 0;
                    pretaxBalance = this.calculateGain(i === 0, pretaxBalance, this.data.annualReturn.afterRetirement);
                    investment = this.calculateGain(i === 0, investment, this.data.annualReturn.afterRetirement);
                    roth = this.calculateGain(i === 0, roth, this.data.annualReturn.afterRetirement);
                    spendingAmount = spending.afterRetirement;
                    if (age < this.data.medicare.age) {
                        spendingAmount += this.calculateInsuranceSpendingForYear(year);
                    }
                }

                // 401k
                const k401 = salary * (this.data.contrib.totalPercent / 100) * this.calculatePercentOfMonthsLeftInYear(year);
                const k401Employee = salary * (this.data.contrib.employeePercent / 100) * this.calculatePercentOfMonthsLeftInYear(year);    // for taking it out of savings
                const roth401k = salary * (this.data.contrib.rothTotalPercent / 100) * this.calculatePercentOfMonthsLeftInYear(year);
                const roth401kEmployee = salary * (this.data.contrib.roth401kPercent / 100) * this.calculatePercentOfMonthsLeftInYear(year);

                let taxableEarnedIncome = salary - k401Employee;
                let taxableOrdinaryIncome = taxableEarnedIncome; // includes roth conversions

                // rmd age 75+ after 2035
                let rmd = 0;
                if (age >= this.data.rmd.age) {
                    rmd = pretaxBalance / (this.data.rmd.lifetimeTable.find(x => x[0] === age)[1]);
                }

                //** calculate how much to convert
                let dist = 0;
                if (pretaxBalance > 0 && age >= this.data.distribution.age) {
                    const bracket = this.data.distribution.bracket;
                    const totalDistAllowed = this.getIncomeForBracketAndYear(year, bracket) - taxableOrdinaryIncome + this.data.distribution.offset;
                    if (pretaxBalance < totalDistAllowed) {
                        dist = pretaxBalance;
                    } else {
                        dist = totalDistAllowed;
                    }

                    // if rmd is greater than calculated distribution amount, then take out RMD
                    dist = rmd > dist ? rmd : dist;

                    // dist taxed at ordinary income
                    taxableOrdinaryIncome += dist;
                }

                const ss = this.calculateSSBenefits(age);
                let spendingAfterSS = spendingAmount - ss;

                // ===========  taxes
                const fica = this.calculateFica(salary, year); // fica only on salary
                const taxableSS = this.calculateSSToTax(taxableEarnedIncome, ss);
                const ordinaryIncomeTax = this.calculateOrdinaryIncomeTaxForYear(taxableOrdinaryIncome + taxableSS, year);
                let tax = ordinaryIncomeTax;
                tax += fica;

                const capitalGainTax = this.calculateCapitalGainTax(age, year, tax, dist, spendingAfterSS, investment);
                tax += capitalGainTax;

                let stateTax = 0;
                // before retirement, state income tax
                if (age < this.data.person.retirement.age) {
                    stateTax = taxableOrdinaryIncome * (this.data.tax.state.beforeRetirement / 100);
                } else {
                    stateTax = taxableOrdinaryIncome * (this.data.tax.state.afterRetirement / 100);
                }
                tax += stateTax;
                // ==========  end of taxes
                let medicareBPremium = 0;

                if (age >= this.data.medicare.age) { // medicare kicks in
                    medicareBPremium = this.getMedicarePremiumsByMagi(taxableOrdinaryIncome + taxableSS, year - 2);
                    medicareBPremium *= 2 * 12; // 2 people for a year
                    spendingAfterSS += medicareBPremium;
                }

                let yearly = {
                    age: age,
                    pretaxBalance: pretaxBalance,
                    year: year,
                    salary: salary,
                    k401: k401,
                    roth401k: roth401k,
                    rmd: rmd,
                    dist: dist,
                    investment: investment,
                    roth: roth,
                    tax: tax,
                    spending: spendingAmount,
                    fica: fica,
                    ordinaryIncomeTax: ordinaryIncomeTax,
                    capitalGainTax: capitalGainTax,
                    stateTax: stateTax,
                    title: title,
                    ss: ss,
                    medicare: medicareBPremium,
                    netWorth: pretaxBalance + roth + investment
                };
                this.data.yearlyData.push(yearly);

                /// calculate for next year
                age++;
                year++;
                roth = roth + dist + roth401k;

                // before retirement, investment balance += salary-spending
                if (age < this.data.person.retirement.age) {
                    investment += (taxableEarnedIncome - roth401k - spendingAfterSS - tax) * this.calculatePercentOfMonthsLeftInYear(year - 1);
                }
                else {
                    // before 59.5, pay tax from investment (otherwise 10% penality)
                    // after that, pay from pretax if there's enough
                    // otherwise pay from the converted roth
                    if (age >= this.data.noPenaltyWithdraw.age) {
                        roth -= (tax + spendingAfterSS);
                    } else {
                        investment -= (tax + spendingAfterSS);
                    }
                }

                pretaxBalance = pretaxBalance + k401 - dist;
                spending.beforeRetirement = spending.beforeRetirement * (1 + this.data.inflation / 100);
                spending.afterRetirement = spending.afterRetirement * (1 + this.data.inflation / 100);
            }

            //console.table(this.data.yearlyData);
        },

        calculateInsuranceSpendingForYear(year) {
            let ins = this.data.spending.insurance;
            for (let y = new Date().getFullYear() + 1; y <= year; y++) {
                ins = ins * (1 + this.data.inflation / 100);
            }
            return ins;

        },
        calculateSSBenefits(age) {
            if (age < this.data.person.ss.age) {
                return 0;
            }

            let yearlySs = this.data.person.ss.perMonth * 12;
            for (let i = this.data.person.ss.age + 1; i <= age; i++) {
                yearlySs = yearlySs * (1 + this.data.inflation / 100);
            }

            return yearlySs;
        },

        /**
         * returns amount of ss taxable based on 'total income/inflow'
         */
        calculateSSToTax(otherIncome, ss) {
            const provisionalIncome = otherIncome + ss / 2;
            if (provisionalIncome < 32000)
                return 0;
            if (provisionalIncome < 44000)
                return ss * 0.5;

            //else
            return ss * 0.85;
        },
        getRowTitle(age) {
            let title = '';
            switch (age) {
                case this.data.person.retirement.age:
                    title = "Retirement starts";
                    break;
                case this.data.rmd.age:
                    title = "Required Minimum Distribution starts";
                    break;
                case this.data.medicare.age:
                    title = "Medicare starts";
                    break;
                case this.data.person.ss.age:
                    title = "Social Security benefit starts";
                    break;
                case this.data.distribution.age:
                    title = "Roth Conversion starts"
                    break;
                case this.data.noPenaltyWithdraw.age:
                    title = "Penalty free withdraw from pretax accounts starts, your spendings will be taken from pretax accounts first";
                    break;
            }
            return title;
        },
        /**
         * Returns percent (0-100) of months left in the current year.
         * If the provided year is not the current year, returns 100.
         * Example: in November (monthIndex=10), monthsLeftIncludingCurrent = 2 -> returns 17
         */
        calculatePercentOfMonthsLeftInYear(year) {
            const now = new Date();
            const currentYear = now.getFullYear();
            if (Number(year) !== currentYear) return 1;
            const currentMonthIndex = now.getMonth(); // 0 = Jan
            const monthsLeftIncludingCurrent = 12 - currentMonthIndex;
            const percent = Math.round((monthsLeftIncludingCurrent / 12) * 100) / 100;
            return percent;
        },

        calculateCapitalGainTax(age, year, tax, k401kWithdraw, spendingAmount, investment) {
            // before retirement, spending money is from salary, no capital gain
            // after no-penalty withdraw age, take money from roth, no capital gain
            // between retirement age and no-penalty withdraw age 59.5
            //  spending money will be paid from investment account first, which has 15% tax,
            //  plus 3.8% medicare surtax on 250k above capital gain
            // if investment account has no money, pay tax from roth, which has no tax TODO ASSUMPTION: there's enough contribution into roth to take out without penalty
            if (age < this.data.person.retirement.age) { // TODO ASSUMPTION: salary covers all spending
                return 0;
            }
            if (age >= this.data.noPenaltyWithdraw.age) { // age > 59.5, take money from pretax ira
                return 0;
            }

            // age between retirement and no-penalty withdraw age (59.5)
            const investmentWithdraws = (spendingAmount + tax + spendingAmount * 0.15) / 2; // TODO assumption: capital gain = 50% of funds sold
            const taxable = k401kWithdraw + investmentWithdraws; // assuming all taken from investment

            if (investment < investmentWithdraws) {
                return 0;  // take money from roth, no tax TODO ASSUMPTION: there's enough contribution into roth to take out without penalty
            }

            let newTax = 0;
            const noTaxCeiling = this.getCapitalGain0TaxCeiling(year);
            if (taxable > noTaxCeiling) {
                newTax += investmentWithdraws * 0.15;  // 15% capital gain
            } // otheriwse
            if (taxable > 250000) {     // apply additional 3.8% medicare surtax on net investment gain tax
                if (k401kWithdraw >= 250000) {
                    newTax += (investmentWithdraws - 250000) * 0.038;
                } else {
                    newTax += (250000 - k401kWithdraw + investmentWithdraws) * 0.038;
                }
            }
            newTax += investmentWithdraws * (this.data.tax.state.afterRetirement / 100); // state tax for capital gain
            return newTax;

        },

        getCapitalGain0TaxCeiling(year) {
            const ceilingInreaseRate = 0.045; // using ssrCeilingInreaseRate
            const ceiling2025 = 96700;
            let newCeiling = ceiling2025;
            for (let i = 0; i < year - 2025; i++) {
                newCeiling = newCeiling * (1 + ceilingInreaseRate);
            }
            return newCeiling;
        },
        // Util functions
        toDollar(val) {
            return new Intl.NumberFormat("en-US", {
                style: "currency",
                currency: "USD",
                minimumFractionDigits: 0,
                maximumFractionDigits: 0
            }).format(val);
        },
        toPercent(val) {
            return new Intl.NumberFormat("en-US", {
                style: "percent",
                maximumFractionDigits: 1,
            }).format(val / 100);
        },
        getMedicarePremiumsByMagi(magi, year) {
            const premiums = this.getMedicarePremiumsForYear(year);

            let premium = premiums.data[0].monthly;
            for (let p of premiums.data) {
                if (magi >= p.ceiling) {
                    premium = p.monthly;
                    break;
                }
            }
            return premium;
        },
        getMedicarePremiumsForYear(year) {
            if (!this.data.medicare.premiums || this.data.medicare.premiums.length === 0) {
                this.estimateMedicarePremiumsforAllYears();
            }
            const premiums = this.data.medicare.premiums.find(y => y.year === year);
            return premiums;
        },
        estimateMedicarePremiumsforAllYears() {
            this.data.medicare.premiums = [];
            //calculate part b only
            // increase rate = 6.5%  // https://www.statista.com/statistics/1284023/annual-percentage-change-of-medicare-part-b-premium-us/
            const premiumIncreaseRate = 0.065;
            const ceilingIncreaseRate = 0.039; // average of last 5 years

            // ceiling increase rate ~3.9%
            //premium2025
            const premium2025 = [
                { ceiling: 212000, monthly: 185 },
                { ceiling: 266000, monthly: 259 },
                { ceiling: 344000, monthly: 370 },
                { ceiling: 400000, monthly: 480.9 },
                { ceiling: 750000, monthly: 591.9 },
                { ceiling: 1000000, monthly: 628.9 }
            ];
            this.data.medicare.premiums.push({
                year: 2025,
                data: premium2025
            });

            const deceaseYear = (new Date()).getFullYear() + (this.data.person.deceased.age - this.data.person.age);
            for (let i = this.data.medicare.premiums[0].year + 1; i < deceaseYear; i++) {
                const previousPremium = this.data.medicare.premiums.find(x => x.year == i - 1).data;
                const newPremium = previousPremium.map(x => { return { ceiling: x.ceiling * (1 + ceilingIncreaseRate), monthly: x.monthly * (1 + premiumIncreaseRate) } });
                this.data.medicare.premiums.push({
                    year: i,
                    data: newPremium
                });
            }
        },
        getTaxBracketsForYear(year) {
            this.calculateTaxBracketsForAllYear(year);
            try {
                const bracket = this.data.tax.brackets.find(x => x.year === year);
                return bracket;
            } catch (ex) {
                console.error('year=', year, 'ex=', ex);
            }
        },
        calculateTaxBracketsForAllYear(year) {
            if (this.data.tax.brackets && this.data.tax.brackets.length !== 0) {
                return;
            }

            // historical yearly bracket increase around 1.6% in from 2007-2017
            const r = 0.016;

            const b2025Data = [
                { percent: 12, income: 96950 },
                { percent: 22, income: 206700 },
                { percent: 24, income: 394600 },
                { percent: 32, income: 501050 },
                { percent: 35, income: 751600 },
                { percent: 37, income: 1000000 }
            ];

            const b2025 = {
                year: 2025,
                standardDeduction: 30000,
                data: b2025Data
            }

            this.data.tax.brackets = [b2025];
            let extra65standardDeduction = 3100;  // 2025 extra was 3100, it will get adjusted at the same rate as tax brackets
            for (let i = 2026; i < 2026 + this.data.person.deceased.age; i++) {
                const newdata = this.data.tax.brackets[this.data.tax.brackets.length - 1].data.map(
                    x => { return { percent: x.percent, income: Math.round(x.income * (1 + r)) } }
                );
                let standardDeduction = this.data.tax.brackets[this.data.tax.brackets.length - 1].standardDeduction * (1 + r);

                // if 65, add 65 extra standard deduction for one year, then following years will be based on 65
                const age = this.data.person.age + (year - (new Date().getFullYear()));
                if (i > 2025 & age <= 65) {
                    extra65standardDeduction *= (1 + r);
                    if (age === 65) {
                        standardDeduction += extra65standardDeduction;
                    }
                }

                this.data.tax.brackets.push({
                    year: i,
                    standardDeduction: standardDeduction,
                    data: newdata
                })
            }
        },
        /**
         * returns ordinary income upper limit for given year and bracket
         * if bracket is not found, go with the bracket lower
         */
        getIncomeForBracketAndYear(year, bracketRate) {
            if (bracketRate === '0') return 0;    // not selected in dropdown

            const brackets = this.getTaxBracketsForYear(year).data;
            let bracket = brackets.find(x => x.percent === bracketRate);
            if (bracket == null) {
                let i = 0;
                for (i = 0; i < brackets.length; i++) {
                    if (brackets[i].percent > bracketRate)
                        break;
                }
                bracket = brackets[i + 1];
            }
            return bracket.income;
        },
        calculateOrdinaryIncomeTaxForYear(income, year) {
            const taxData = this.getTaxBracketsForYear(year);
            const brackets = taxData.data;
            const standardDeduction = taxData.standardDeduction > income ? income : taxData.standardDeduction;

            income = income - standardDeduction;
            let sum = 0;
            for (let i = 0; i < brackets.length; i++) {
                const bracket = brackets[i];
                if (income > bracket.income) {
                    let tax = bracket.percent / 100 * bracket.income;
                    sum += tax;
                    income = income - bracket.income;
                } else {
                    let tax = bracket.percent / 100 * income;
                    sum += tax;
                    return sum;
                }
            }
        },
        calculateFica(salary, year) {
            const ssRate = 0.062;
            const medicareRate = 0.0145, medicareCeiling = 250000, medicareRateOverCeiling = 0.0235;
            const ssTaxCeiling = this.getFica_SSTaxCeiling(year);
            let fica = 0;
            if (salary > ssTaxCeiling) {
                fica += ssTaxCeiling * ssRate;
            } else {
                fica += salary * ssRate;
            }

            if (salary <= medicareCeiling) {
                fica += salary * medicareRate;
            } else {
                fica += medicareCeiling * medicareRate;
                fica += (salary - medicareCeiling) * medicareRateOverCeiling;
            }
            return fica;
        },
        getFica_SSTaxCeiling(year) {
            const ssrCeiling2025 = 176100;       // fica is calculated up to this number
            const ssrCeilingInreaseRate = 0.045; // average from last 8 years

            let sum = ssrCeiling2025;
            for (let i = 0; i < year - 2025; i++) {
                sum = sum * (1 + ssrCeilingInreaseRate);
            }
            return sum;
        }
    },
    beforeMount() {
        try {
            this.calculate();
        } catch (ex) {
            console.error(ex);
        }
    }
});
app.config.globalProperties.window = window;
app.mount("#app");
