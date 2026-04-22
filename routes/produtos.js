// routes/produtos.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // Statements preparados uma vez e reusados — mais rápido e mais seguro contra SQL injection
    const listar  = db.prepare(`SELECT * FROM produtos ORDER BY nome`);
    const inserir = db.prepare(`INSERT INTO produtos (nome, custo, preco, quantidade) VALUES (?, ?, ?, ?)`);
    const excluir = db.prepare(`DELETE FROM produtos WHERE id = ?`);

    router.get('/', (req, res) => {
        res.json(listar.all());
    });

    router.post('/', (req, res) => {
        const { nome, custo, preco, quantidade } = req.body;
        const info = inserir.run(nome, custo, preco, quantidade);
        res.json({ ok: true, id: info.lastInsertRowid });
    });

    router.delete('/:id', (req, res) => {
        excluir.run(req.params.id);
        res.json({ ok: true });
    });

    return router;
};