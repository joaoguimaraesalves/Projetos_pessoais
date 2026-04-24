// routes/dashboard.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // COALESCE(..., 0) evita null quando a tabela está vazia
    const agregadoVendas = db.prepare(
        `SELECT COALESCE(SUM(valor),0) as vendas,
                COALESCE(SUM(custo),0) as custos,
                COALESCE(SUM(quantidade),0) as qtd
         FROM vendas`
    );
    const agregadoSaidas = db.prepare(
        `SELECT COALESCE(SUM(valor),0) as total_saidas FROM saidas`
    );
    const pontosVendas = db.prepare(`SELECT valor, custo, date(data) as dia FROM vendas`);
    const pontosSaidas = db.prepare(`SELECT valor, date(data) as dia FROM saidas`);

    router.get('/', (req, res) => {
        const rv = agregadoVendas.get();
        const rs = agregadoSaidas.get();
        const lucroLiquido = rv.vendas - rv.custos - rs.total_saidas;

        res.json({
            total_vendas: rv.vendas,
            custos: rv.custos,
            saidas: rs.total_saidas,
            lucro_liquido: lucroLiquido,
            qtd_vendida: rv.qtd,
            ticket_medio: rv.qtd > 0 ? rv.vendas / rv.qtd : 0,
            margem: rv.vendas > 0 ? ((lucroLiquido / rv.vendas) * 100).toFixed(2) : 0
        });
    });

    router.get('/grafico', (req, res) => {
        res.json({
            vendas: pontosVendas.all(),
            saidas: pontosSaidas.all()
        });
    });

    return router;
};