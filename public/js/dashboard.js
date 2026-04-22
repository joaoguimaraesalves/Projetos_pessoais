// public/js/dashboard.js
let meuGrafico;

async function carregarDashboard() {
    const d = await fetchJSON('/api/dashboard');
    document.getElementById('val-lucro').innerText  = formatarMoeda(d.lucro_liquido);
    document.getElementById('val-saidas').innerText = formatarMoeda(d.saidas);
    document.getElementById('val-vendas').innerText = formatarMoeda(d.total_vendas);
    document.getElementById('val-qtd').innerText    = d.qtd_vendida;
    document.getElementById('val-ticket').innerText = formatarMoeda(d.ticket_medio);
    document.getElementById('val-custos').innerText = formatarMoeda(d.custos);
    document.getElementById('val-margem').innerText = d.margem + '%';
}

async function desenharGrafico() {
    const { vendas, saidas } = await fetchJSON('/api/dashboard/grafico');

    // Agrupa vendas e saídas por dia (YYYY-MM-DD)
    const porDia = {};
    vendas.forEach(v => {
        if (!porDia[v.dia]) porDia[v.dia] = { faturamento: 0, custo: 0, gastos: 0 };
        porDia[v.dia].faturamento += v.valor;
        porDia[v.dia].custo       += v.custo;
    });
    saidas.forEach(s => {
        if (!porDia[s.dia]) porDia[s.dia] = { faturamento: 0, custo: 0, gastos: 0 };
        porDia[s.dia].gastos += s.valor;
    });

    const dias = Object.keys(porDia).sort();
    const faturamentos = dias.map(d => porDia[d].faturamento);
    const lucros       = dias.map(d => porDia[d].faturamento - porDia[d].custo - porDia[d].gastos);
    const gastos       = dias.map(d => porDia[d].gastos);

    if (meuGrafico) meuGrafico.destroy();
    meuGrafico = new Chart(document.getElementById('graficoEvolucao').getContext('2d'), {
        type: 'line',
        data: {
            labels: dias,
            datasets: [
                { label: 'Faturamento',   data: faturamentos, borderColor: '#3B82F6', backgroundColor: 'rgba(59, 130, 246, 0.1)', fill: true },
                { label: 'Lucro Líquido', data: lucros,       borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true },
                { label: 'Gastos',        data: gastos,       borderColor: '#EF4444', backgroundColor: 'rgba(239, 68, 68, 0.1)', fill: true }
            ]
        },
        options: {
            responsive: true,
            plugins: { legend: { labels: { color: '#F8FAFC' } } },
            scales: { x: { ticks: { color: '#94A3B8' } }, y: { ticks: { color: '#94A3B8' } } }
        }
    });
}