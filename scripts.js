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
            label: 'Post-tax Balance',
            data: yearlyData.map(x => x.investment),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.3)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            fill: true,
            stack: 'balances'
        }, {
            label: 'Roth Balance',
            data: yearlyData.map(x => x.roth),
            borderColor: '#0f9f8f',
            backgroundColor: 'rgba(15, 159, 143, 0.3)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            fill: true,
            stack: 'balances'
        }, {
            label: 'Pretax Balance',
            data: yearlyData.map(x => x.pretaxBalance),
            borderColor: '#8b5cf6',
            backgroundColor: 'rgba(139, 92, 246, 0.3)',
            borderWidth: 2,
            pointRadius: 0,
            pointHoverRadius: 4,
            tension: 0.25,
            fill: true,
            stack: 'balances'
        }, {
            label: 'Total Balance',
            data: yearlyData.map(x => x.investment + x.roth + x.pretaxBalance),
            borderColor: '#0f172a',
            backgroundColor: '#0f172a',
            borderWidth: 3,
            pointRadius: 0,
            pointHoverRadius: 5,
            tension: 0.25,
            fill: false,
            stack: 'total'
        }]
    };
    new Chart(
        document.getElementById('chart1'),
        {
            type: 'line',
            data: data,
            options: {
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'circle',
                            padding: 18,
                            color: '#475569',
                            font: { family: 'Manrope', weight: '600' }
                        }
                    },
                    tooltip: {
                        backgroundColor: '#0f172a',
                        titleFont: { family: 'Manrope', weight: '700' },
                        bodyFont: { family: 'Manrope' },
                        padding: 12,
                        callbacks: {
                            title: items => `Age ${items[0].label}`,
                            label: context => `${context.dataset.label}: ${new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                maximumFractionDigits: 0
                            }).format(context.parsed.y)}`
                        }
                    }
                },
                scales: {
                    x: {
                        stacked: true,
                        grid: { display: false },
                        ticks: { color: '#64748b' },
                        title: {
                            display: true,
                            text: 'Age',
                            color: '#64748b',
                            font: { family: 'Manrope', weight: '600' }
                        }
                    },
                    y: {
                        stacked: true,
                        beginAtZero: true,
                        grid: { color: 'rgba(148, 163, 184, 0.2)' },
                        ticks: {
                            color: '#64748b',
                            callback: value => new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                notation: 'compact',
                                maximumFractionDigits: 1
                            }).format(value)
                        }
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
