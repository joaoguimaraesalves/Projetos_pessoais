// routes/saidas.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    const listar  = db.prepare(`SELECT * FROM saidas ORDER BY id DESC`);
    const inserir = db.prepare(`INSERT INTO saidas (descricao, valor, data) VALUES (?, ?, ?)`);
    const excluir = db.prepare(`DELETE FROM saidas WHERE id = ?`);

    router.get('/', (req, res) => {
        res.json(listar.all());
    });

    router.post('/', (req, res) => {
        const { descricao, valor } = req.body;
        const info = inserir.run(descricao, valor, new Date().toISOString());
        res.json({ ok: true, id: info.lastInsertRowid });
    });

    router.delete('/:id', (req, res) => {
        excluir.run(req.params.id);
        res.json({ ok: true });
    });

    return router;
};