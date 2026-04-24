// routes/estoque.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    const listarTodos = db.prepare(
        `SELECT m.*, p.nome as produto_nome_atual
         FROM estoque_movimentos m
         LEFT JOIN produtos p ON p.id = m.produto_id
         ORDER BY m.data DESC`
    );

    const listarPorProduto = db.prepare(
        `SELECT m.*, p.nome as produto_nome_atual
         FROM estoque_movimentos m
         LEFT JOIN produtos p ON p.id = m.produto_id
         WHERE m.produto_id = ?
         ORDER BY m.data DESC`
    );

    router.get('/movimentos', (req, res) => {
        const { produto_id } = req.query;
        if (produto_id) {
            res.json(listarPorProduto.all(produto_id));
        } else {
            res.json(listarTodos.all());
        }
    });

    return router;
};