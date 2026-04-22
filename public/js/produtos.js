// public/js/produtos.js
async function carregarProdutos() {
    const produtos = await fetchJSON('/api/produtos');
    const tbody = document.getElementById('lista-produtos');
    tbody.innerHTML = '';

    produtos.forEach(p => {
        const estoqueBaixo = p.quantidade <= 2;
        tbody.innerHTML += `
            <tr>
                <td>#${p.id}</td>
                <td>${p.nome}</td>
                <td>${formatarMoeda(p.custo)}</td>
                <td>${formatarMoeda(p.preco)}</td>
                <td style="${estoqueBaixo ? 'color: var(--color-red); font-weight: bold;' : ''}">${p.quantidade} un</td>
                <td><button class="btn-excluir" onclick="excluirRegistro('produtos', ${p.id}, carregarProdutos)">Excluir</button></td>
            </tr>`;
    });
}

async function salvarProduto(event) {
    event.preventDefault();
    const corpo = {
        nome:       document.getElementById('prod-nome').value,
        custo:      parseFloat(document.getElementById('prod-custo').value),
        preco:      parseFloat(document.getElementById('prod-preco').value),
        quantidade: parseInt(document.getElementById('prod-qtd').value)
    };
    await fetchJSON('/api/produtos', { method: 'POST', body: JSON.stringify(corpo) });
    event.target.reset();
    fecharModal('modal-produto');
    carregarProdutos();
}