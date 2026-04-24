// public/js/saidas.js
async function carregarSaidas() {
    const saidas = await fetchJSON('/api/saidas');
    const tbody = document.getElementById('lista-saidas');
    tbody.innerHTML = '';

    saidas.forEach(s => {
        tbody.innerHTML += `
            <tr>
                <td>${new Date(s.data).toLocaleDateString('pt-BR')}</td>
                <td>${s.descricao}</td>
                <td style="color: var(--color-red)">- ${formatarMoeda(s.valor)}</td>
                <td><button class="btn-excluir" onclick="excluirRegistro('saidas', ${s.id}, carregarSaidas)">Excluir</button></td>
            </tr>`;
    });
}

async function salvarGasto(event) {
    event.preventDefault();
    const corpo = {
        descricao: document.getElementById('gasto-desc').value,
        valor:     parseFloat(document.getElementById('gasto-valor').value)
    };
    await fetchJSON('/api/saidas', { method: 'POST', body: JSON.stringify(corpo) });
    event.target.reset();
    fecharModal('modal-gasto');
    carregarSaidas();
    if (document.getElementById('tela-dashboard').classList.contains('active')) {
        atualizarDashboardCompleto();
    }
}