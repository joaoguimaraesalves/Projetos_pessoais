// routes/vendas.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    const listar  = db.prepare(`SELECT * FROM vendas ORDER BY id DESC`);
    const buscar  = db.prepare(`SELECT * FROM vendas WHERE id = ?`);
    const inserir = db.prepare(
        `INSERT INTO vendas (produto_id, produto_nome, quantidade, valor, custo, forma_pagamento, data)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
    );
    const excluir         = db.prepare(`DELETE FROM vendas WHERE id = ?`);
    const baixarEstoque   = db.prepare(`UPDATE produtos SET quantidade = quantidade - ? WHERE id = ?`);
    const devolverEstoque = db.prepare(`UPDATE produtos SET quantidade = quantidade + ? WHERE id = ?`);
    const buscarProduto   = db.prepare(`SELECT custo FROM produtos WHERE id = ?`);

    const inserirMovimento = db.prepare(
        `INSERT INTO estoque_movimentos
         (produto_id, tipo, quantidade, custo_unitario, origem_tipo, origem_id, observacao, data)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    );
    const excluirMovimentosVenda = db.prepare(
        `DELETE FROM estoque_movimentos WHERE origem_tipo = 'venda' AND origem_id = ?`
    );

    const salvarVenda = db.transaction((venda) => {
        const info = inserir.run(
            venda.produto_id, venda.produto_nome, venda.quantidade,
            venda.valor, venda.custo, venda.forma_pagamento, venda.data
        );
        const vendaId = info.lastInsertRowid;

        baixarEstoque.run(venda.quantidade, venda.produto_id);

        // Custo unitário médio — já que "custo" é o total, dividimos pela qtd
        const custoUnit = venda.custo / venda.quantidade;
        inserirMovimento.run(
            venda.produto_id,
            'saida',
            venda.quantidade,
            custoUnit,
            'venda',
            vendaId,
            `Venda #${vendaId}`,
            venda.data
        );

        return vendaId;
    });

    const excluirVenda = db.transaction((id) => {
        const venda = buscar.get(id);
        if (venda && venda.produto_id) {
            devolverEstoque.run(venda.quantidade, venda.produto_id);
        }
        excluirMovimentosVenda.run(id);
        excluir.run(id);
    });

    router.get('/', (req, res) => {
        res.json(listar.all());
    });

    router.post('/', (req, res) => {
        const id = salvarVenda({
            ...req.body,
            forma_pagamento: req.body.forma_pagamento || null,
            data: new Date().toISOString()
        });
        res.json({ ok: true, id });
    });

    router.delete('/:id', (req, res) => {
        excluirVenda(req.params.id);
        res.json({ ok: true });
    });

    return router;
};