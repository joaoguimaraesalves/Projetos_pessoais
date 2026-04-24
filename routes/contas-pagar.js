// routes/contas-pagar.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    const listarTodas     = db.prepare(`SELECT * FROM contas_pagar ORDER BY vencimento ASC`);
    const listarPendentes = db.prepare(`SELECT * FROM contas_pagar WHERE status = 'pendente' ORDER BY vencimento ASC`);
    const listarPagas     = db.prepare(`SELECT * FROM contas_pagar WHERE status = 'paga' ORDER BY data_pagamento DESC`);

    const buscar = db.prepare(`SELECT * FROM contas_pagar WHERE id = ?`);

    const inserir = db.prepare(
        `INSERT INTO contas_pagar (descricao, valor, vencimento, status)
         VALUES (?, ?, ?, 'pendente')`
    );
    const marcarPaga = db.prepare(
        `UPDATE contas_pagar SET status = 'paga', data_pagamento = ? WHERE id = ?`
    );
    const desmarcarPaga = db.prepare(
        `UPDATE contas_pagar SET status = 'pendente', data_pagamento = NULL WHERE id = ?`
    );
    const excluir = db.prepare(`DELETE FROM contas_pagar WHERE id = ?`);

    router.get('/', (req, res) => {
        const { status } = req.query;
        let stmt;
        if      (status === 'pendente') stmt = listarPendentes;
        else if (status === 'paga')     stmt = listarPagas;
        else                            stmt = listarTodas;
        res.json(stmt.all());
    });

    // Lançamento manual (fora de uma compra). Útil pra aluguel ou algo avulso.
    router.post('/', (req, res) => {
        const { descricao, valor, vencimento } = req.body;
        if (!descricao || !valor || !vencimento) {
            return res.status(400).json({ error: 'descricao, valor e vencimento são obrigatórios' });
        }
        const info = inserir.run(descricao, parseFloat(valor), vencimento);
        res.json({ ok: true, id: info.lastInsertRowid });
    });

    router.patch('/:id/pagar', (req, res) => {
        const conta = buscar.get(req.params.id);
        if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
        if (conta.status === 'paga') {
            return res.status(400).json({ error: 'Conta já está paga' });
        }
        marcarPaga.run(new Date().toISOString(), req.params.id);
        res.json({ ok: true });
    });

    // Útil se a pessoa marcar por engano
    router.patch('/:id/desfazer-pagamento', (req, res) => {
        const conta = buscar.get(req.params.id);
        if (!conta) return res.status(404).json({ error: 'Conta não encontrada' });
        desmarcarPaga.run(req.params.id);
        res.json({ ok: true });
    });

    router.delete('/:id', (req, res) => {
        excluir.run(req.params.id);
        res.json({ ok: true });
    });

    return router;
};