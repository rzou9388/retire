// Non-module helper scripts extracted from index.html

// chart
function updateChart() {
    const chartParent = document.getElementById('chartParent');
    chartParent.innerHTML = '';
    chartParent.style.display = 'none';
    chartParent.innerHTML = '<canvas id="chart1"></canvas>';
    chartParent.style.display = 'block';
    const yearlyData = JSON.parse(localStorage.getItem('data')).yearlyData;
    const labels = yearlyData.map(x => x.age);
    const data = {
        labels: labels,
        datasets: [{
            label: 'Total Balance',
            data: yearlyData.map(x => x.investment + x.roth + x.pretaxBalance),
            borderColor: 'rgb(55, 255, 111)',
            tension: 0.1
        }, {
            label: 'Post-tax Balance',
            data: yearlyData.map(x => x.investment),
            borderColor: 'rgb(111, 192, 192)',
            tension: 0.1
        }, {
            label: 'Roth Balance',
            data: yearlyData.map(x => x.roth),
            borderColor: 'rgb(233, 192, 192)',
            tension: 0.1
        },
        {
            label: 'Pretax Balance',
            data: yearlyData.map(x => x.pretaxBalance),
            borderColor: 'rgb(75, 244, 192)',
            tension: 0.1
        }
        ]
    };
    new Chart(
        document.getElementById('chart1'),
        {
            type: 'line',
            data: data,
            options: {
                scales: {
                    y: {
                        stacked: false
                    }
                }
            }
        }
    );
}

// adjust panel width
function resetDivTab() {
    setDivTabClass('col-6');
}
function setDivTabClass(cla) {
    const el = document.getElementById('divtabs');
    if (el) el.className = cla;
}
