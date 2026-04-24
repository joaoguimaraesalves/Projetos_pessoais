// public/js/vendas.js
let produtosEmEstoque = [];

async function carregarParaDropdown() {
    produtosEmEstoque = await fetchJSON('/api/produtos');
    const select = document.getElementById('venda-produto');
    select.innerHTML = '<option value="">Selecione um produto...</option>';
    produtosEmEstoque.forEach(p => {
        select.innerHTML += `<option value="${p.id}">${p.nome} (Disponível: ${p.quantidade})</option>`;
    });
}

function abrirModalVenda() {
    carregarParaDropdown();
    abrirModal('modal-venda');
}

function atualizarTotalVenda() {
    const produtoId = document.getElementById('venda-produto').value;
    const qtd = document.getElementById('venda-qtd').value;
    if (produtoId && qtd) {
        const prod = produtosEmEstoque.find(p => p.id == produtoId);
        if (prod) document.getElementById('venda-valor').value = (prod.preco * qtd).toFixed(2);
    }
}

async function salvarVenda(event) {
    event.preventDefault();
    const produtoId = document.getElementById('venda-produto').value;
    const qtd = parseInt(document.getElementById('venda-qtd').value);
    const valorRecebido = parseFloat(document.getElementById('venda-valor').value);
    const pagamento = document.getElementById('venda-pagamento').value;

    const prod = produtosEmEstoque.find(p => p.id == produtoId);
    if (!prod) return alert('Por favor, selecione um produto.');
    if (qtd > prod.quantidade) return alert('Você não tem essa quantidade no estoque!');

    const custoTotal = prod.custo * qtd;

    await fetchJSON('/api/vendas', {
        method: 'POST',
        body: JSON.stringify({
            produto_id: prod.id,
            produto_nome: prod.nome,
            quantidade: qtd,
            valor: valorRecebido,
            custo: custoTotal,
            forma_pagamento: pagamento
        })
    });

    event.target.reset();
    fecharModal('modal-venda');
    carregarDashboard();
    desenharGrafico();
    if (document.getElementById('tela-vendas').classList.contains('active'))   carregarVendas();
    if (document.getElementById('tela-produtos').classList.contains('active')) carregarProdutos();
}

async function carregarVendas() {
    const vendas = await fetchJSON('/api/vendas');
    const tbody = document.getElementById('lista-vendas');
    tbody.innerHTML = '';

    vendas.forEach(v => {
        const lucro = v.valor - v.custo;
        const pagamento = v.forma_pagamento || '—';
        tbody.innerHTML += `
            <tr>
                <td>${new Date(v.data).toLocaleDateString('pt-BR')}</td>
                <td><strong>${v.produto_nome}</strong></td>
                <td>${v.quantidade} un</td>
                <td style="color: var(--color-blue)">${formatarMoeda(v.valor)}</td>
                <td style="text-transform: capitalize;">${pagamento}</td>
                <td style="color: var(--color-green)">${formatarMoeda(lucro)}</td>
                <td><button class="btn-excluir" onclick="excluirRegistro('vendas', ${v.id}, carregarVendas)">Excluir</button></td>
            </tr>`;
    });
}