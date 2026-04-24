// routes/compras.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // ---------- Statements preparados ----------

    const listarCompras = db.prepare(`SELECT * FROM compras ORDER BY id DESC`);
    const buscarCompra  = db.prepare(`SELECT * FROM compras WHERE id = ?`);
    const buscarItens   = db.prepare(`SELECT * FROM compra_itens WHERE compra_id = ?`);

    const inserirCompra = db.prepare(
        `INSERT INTO compras (descricao, valor_total, forma_pagamento, parcelas, data)
         VALUES (?, ?, ?, ?, ?)`
    );
    const inserirItem = db.prepare(
        `INSERT INTO compra_itens (compra_id, produto_id, produto_nome, quantidade, custo_unitario)
         VALUES (?, ?, ?, ?, ?)`
    );

    const buscarProduto    = db.prepare(`SELECT * FROM produtos WHERE id = ?`);
    const inserirProduto   = db.prepare(`INSERT INTO produtos (nome, custo, preco, quantidade) VALUES (?, ?, ?, ?)`);
    const atualizarProduto = db.prepare(
        `UPDATE produtos SET custo = ?, quantidade = quantidade + ? WHERE id = ?`
    );

    const inserirMovimento = db.prepare(
        `INSERT INTO estoque_movimentos
         (produto_id, tipo, quantidade, custo_unitario, origem_tipo, origem_id, observacao, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );

    const inserirContaPagar = db.prepare(
        `INSERT INTO contas_pagar
         (descricao, valor, vencimento, status, compra_id, parcela_num, parcela_total)
         VALUES (?, ?, ?, 'pendente', ?, ?, ?)`
    );

    const excluirCompra      = db.prepare(`DELETE FROM compras WHERE id = ?`);
    const excluirItensCompra = db.prepare(`DELETE FROM compra_itens WHERE compra_id = ?`);
    const excluirMovimentosCompra = db.prepare(
        `DELETE FROM estoque_movimentos WHERE origem_tipo = 'compra' AND origem_id = ?`
    );
    const excluirContasPendentes = db.prepare(
        `DELETE FROM contas_pagar WHERE compra_id = ? AND status = 'pendente'`
    );
    const contarContasPagas = db.prepare(
        `SELECT COUNT(*) as total FROM contas_pagar WHERE compra_id = ? AND status = 'paga'`
    );
    const devolverEstoque = db.prepare(
        `UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?`
    );

    // ---------- Helpers ----------

    // Soma N meses a uma data ISO (YYYY-MM-DD). Primeira parcela = 30 dias depois da compra,
    // segunda = 60 dias, e por aí vai — padrão de cartão de crédito.
    function calcularVencimento(dataBase, numMeses) {
        const d = new Date(dataBase);
        d.setMonth(d.getMonth() + numMeses);
        return d.toISOString().slice(0, 10);
    }

    // ---------- Transação principal: criar compra ----------

    // Recebe o payload já validado e faz TUDO numa transação só.
    // Se qualquer passo falhar, rollback automático: nada fica meio-salvo no banco.
    const criarCompra = db.transaction((payload) => {
        const { descricao, forma_pagamento, parcelas, itens } = payload;
        const dataISO = new Date().toISOString();

        // Passo 1: calcular valor total a partir dos itens (fonte única de verdade)
        const valor_total = itens.reduce(
            (acc, item) => acc + item.quantidade * item.custo_unitario, 0
        );

        // Passo 2: inserir cabeçalho da compra
        const infoCompra = inserirCompra.run(
            descricao || null,
            valor_total,
            forma_pagamento,
            parcelas,
            dataISO
        );
        const compraId = infoCompra.lastInsertRowid;

        // Passo 3: para cada item — cria/atualiza produto, registra item, loga movimento
        for (const item of itens) {
            let produtoId = item.produto_id;
            let produtoNome;

            if (produtoId) {
                // Produto existente: atualiza custo e soma ao estoque
                const prod = buscarProduto.get(produtoId);
                if (!prod) throw new Error(`Produto #${produtoId} não encontrado`);
                produtoNome = prod.nome;
                atualizarProduto.run(item.custo_unitario, item.quantidade, produtoId);
            } else {
                // Produto novo: cadastra agora, com preço de venda 0 (usuário edita depois)
                const infoProd = inserirProduto.run(
                    item.produto_nome,
                    item.custo_unitario,
                    0,
                    item.quantidade
                );
                produtoId = infoProd.lastInsertRowid;
                produtoNome = item.produto_nome;
            }

            inserirItem.run(
                compraId, produtoId, produtoNome,
                item.quantidade, item.custo_unitario
            );

            inserirMovimento.run(
                produtoId,
                'entrada',
                item.quantidade,
                item.custo_unitario,
                'compra',
                compraId,
                `Compra #${compraId}`,
                dataISO
            );
        }

        // Passo 4: se foi cartão parcelado, gera as contas a pagar
        if (forma_pagamento === 'cartao' && parcelas > 1) {
            // Divide o total em N parcelas; ajusta a última pra fechar a conta
            // (evita erros de centavo por arredondamento).
            const valorParcela = Math.floor((valor_total / parcelas) * 100) / 100;
            const soma = valorParcela * (parcelas - 1);
            const valorUltima = Math.round((valor_total - soma) * 100) / 100;

            for (let i = 1; i <= parcelas; i++) {
                const valor = (i === parcelas) ? valorUltima : valorParcela;
                const vencimento = calcularVencimento(dataISO, i);
                inserirContaPagar.run(
                    `${descricao || 'Compra'} — parcela ${i}/${parcelas}`,
                    valor,
                    vencimento,
                    compraId,
                    i,
                    parcelas
                );
            }
        }

        return compraId;
    });

    const apagarCompra = db.transaction((id) => {
        const compra = buscarCompra.get(id);
        if (!compra) throw new Error('Compra não encontrada');

        const pagas = contarContasPagas.get(id).total;
        if (pagas > 0) {
            // Proteção: se já pagou alguma parcela, bloqueia exclusão.
            // Permitir seria apagar um registro financeiro já realizado → inconsistência.
            throw new Error(
                'Esta compra tem parcelas já pagas e não pode ser excluída. ' +
                'Se precisar reverter, exclua as parcelas pagas primeiro.'
            );
        }

        // Devolve ao fornecedor (reduz estoque) cada item da compra
        const itens = buscarItens.all(id);
        for (const item of itens) {
            devolverEstoque.run(item.quantidade, item.produto_id);
        }

        excluirMovimentosCompra.run(id);
        excluirContasPendentes.run(id);
        excluirItensCompra.run(id);
        excluirCompra.run(id);
    });

    // ---------- Validação do payload ----------

    function validarPayload(body) {
        if (!body) return 'Payload vazio';
        const { forma_pagamento, parcelas, itens } = body;

        if (!['dinheiro', 'pix', 'cartao'].includes(forma_pagamento)) {
            return 'Forma de pagamento inválida (use dinheiro, pix ou cartao)';
        }
        const p = parseInt(parcelas);
        if (forma_pagamento === 'cartao' && (!p || p < 1)) {
            return 'Para cartão, informe o número de parcelas (>= 1)';
        }
        if (!Array.isArray(itens) || itens.length === 0) {
            return 'A compra precisa ter ao menos 1 item';
        }
        for (const it of itens) {
            if (!it.produto_id && !it.produto_nome) {
                return 'Cada item precisa de produto_id ou produto_nome';
            }
            if (!it.quantidade || it.quantidade <= 0) {
                return 'Quantidade deve ser maior que zero';
            }
            if (it.custo_unitario === undefined || it.custo_unitario < 0) {
                return 'Custo unitário inválido';
            }
        }
        return null;
    }

    // ---------- Rotas ----------

    router.get('/', (req, res) => {
        res.json(listarCompras.all());
    });

    router.get('/:id', (req, res) => {
        const compra = buscarCompra.get(req.params.id);
        if (!compra) return res.status(404).json({ error: 'Compra não encontrada' });
        compra.itens = buscarItens.all(req.params.id);
        res.json(compra);
    });

    router.post('/', (req, res) => {
        const erro = validarPayload(req.body);
        if (erro) return res.status(400).json({ error: erro });

        try {
            const id = criarCompra({
                descricao:       req.body.descricao,
                forma_pagamento: req.body.forma_pagamento,
                parcelas:        parseInt(req.body.parcelas) || 1,
                itens:           req.body.itens
            });
            res.json({ ok: true, id });
        } catch (e) {
            res.status(500).json({ error: e.message });
        }
    });

    router.delete('/:id', (req, res) => {
        try {
            apagarCompra(parseInt(req.params.id));
            res.json({ ok: true });
        } catch (e) {
            res.status(400).json({ error: e.message });
        }
    });

    return router;
};