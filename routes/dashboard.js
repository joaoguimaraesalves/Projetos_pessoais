// routes/dashboard.js
const express = require('express');

module.exports = (db) => {
    const router = express.Router();

    // --- Helper: calcular intervalo do filtro ---
    // Retorna { inicio, fim } em ISO (YYYY-MM-DDTHH:mm:ss.sssZ) ou null para "tudo"
    function intervaloPeriodo(periodo) {
        const agora = new Date();
        const hoje = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());

        if (periodo === 'hoje') {
            return { inicio: hoje.toISOString(), fim: null };
        }
        if (periodo === '7d') {
            const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 6);
            return { inicio: inicio.toISOString(), fim: null };
        }
        if (periodo === '30d') {
            const inicio = new Date(hoje); inicio.setDate(inicio.getDate() - 29);
            return { inicio: inicio.toISOString(), fim: null };
        }
        if (periodo === 'mes') {
            const inicio = new Date(agora.getFullYear(), agora.getMonth(), 1);
            return { inicio: inicio.toISOString(), fim: null };
        }
        if (periodo === 'ano') {
            const inicio = new Date(agora.getFullYear(), 0, 1);
            return { inicio: inicio.toISOString(), fim: null };
        }
        return null; // "total" — sem filtro
    }

    // Monta cláusula WHERE conforme o período, usando o campo passado
    function whereData(campo, periodo) {
        const intervalo = intervaloPeriodo(periodo);
        if (!intervalo) return { clausula: '', params: [] };
        return { clausula: `WHERE ${campo} >= ?`, params: [intervalo.inicio] };
    }

    // ---------- /api/dashboard ----------
    router.get('/', (req, res) => {
        const periodo = req.query.periodo || 'total';
        const wVendas = whereData('data', periodo);
        const wSaidas = whereData('data', periodo);
        // Para contas_pagar usamos a data do pagamento (só entra se foi paga no período)
        const wContas = whereData('data_pagamento', periodo);

        const rv = db.prepare(
            `SELECT COALESCE(SUM(valor),0) as vendas,
                    COALESCE(SUM(custo),0) as custos,
                    COALESCE(SUM(quantidade),0) as qtd
             FROM vendas ${wVendas.clausula}`
        ).get(...wVendas.params);

        const rs = db.prepare(
            `SELECT COALESCE(SUM(valor),0) as total_saidas
             FROM saidas ${wSaidas.clausula}`
        ).get(...wSaidas.params);

        // Contas a pagar que foram efetivamente pagas entram como despesa.
        // É aqui que parcelas de cartão viram "saída real" do período.
        const rc = db.prepare(
            `SELECT COALESCE(SUM(valor),0) as total_pago
             FROM contas_pagar
             WHERE status = 'paga'
             ${wContas.clausula ? 'AND ' + wContas.clausula.replace('WHERE ', '') : ''}`
        ).get(...wContas.params);

        const despesasTotais = rs.total_saidas + rc.total_pago;
        const lucroLiquido = rv.vendas - rv.custos - despesasTotais;

        res.json({
            total_vendas:    rv.vendas,
            custos:          rv.custos,
            saidas:          rs.total_saidas,
            contas_pagas:    rc.total_pago,
            despesas_totais: despesasTotais,
            lucro_liquido:   lucroLiquido,
            qtd_vendida:     rv.qtd,
            ticket_medio:    rv.qtd > 0 ? rv.vendas / rv.qtd : 0,
            margem:          rv.vendas > 0 ? ((lucroLiquido / rv.vendas) * 100).toFixed(2) : 0,
            periodo
        });
    });

    // ---------- /api/dashboard/grafico ----------
    router.get('/grafico', (req, res) => {
        const periodo  = req.query.periodo  || 'total';
        const agrupar  = req.query.agrupar  || 'dia'; // 'dia' ou 'mes'

        // strftime do SQLite: '%Y-%m-%d' para dia, '%Y-%m' para mês
        const formato = agrupar === 'mes' ? '%Y-%m' : '%Y-%m-%d';

        const wv = whereData('data', periodo);
        const ws = whereData('data', periodo);
        const wc = whereData('data_pagamento', periodo);

        const vendas = db.prepare(
            `SELECT strftime('${formato}', data) as periodo,
                    COALESCE(SUM(valor),0) as faturamento,
                    COALESCE(SUM(custo),0) as custo
             FROM vendas ${wv.clausula}
             GROUP BY periodo ORDER BY periodo`
        ).all(...wv.params);

        const saidas = db.prepare(
            `SELECT strftime('${formato}', data) as periodo,
                    COALESCE(SUM(valor),0) as gastos
             FROM saidas ${ws.clausula}
             GROUP BY periodo ORDER BY periodo`
        ).all(...ws.params);

        const contas = db.prepare(
            `SELECT strftime('${formato}', data_pagamento) as periodo,
                    COALESCE(SUM(valor),0) as pagas
             FROM contas_pagar
             WHERE status = 'paga'
             ${wc.clausula ? 'AND ' + wc.clausula.replace('WHERE ', '') : ''}
             GROUP BY periodo ORDER BY periodo`
        ).all(...wc.params);

        res.json({ vendas, saidas, contas });
    });

    // ---------- /api/dashboard/top-produtos ----------
    router.get('/top-produtos', (req, res) => {
        const por = req.query.por || 'qtd';      // qtd | faturamento | lucro
        const periodo = req.query.periodo || 'total';
        const w = whereData('data', periodo);

        let ordem;
        if (por === 'faturamento') ordem = 'faturamento DESC';
        else if (por === 'lucro')  ordem = 'lucro DESC';
        else                       ordem = 'qtd DESC';

        const top = db.prepare(
            `SELECT produto_nome,
                    COALESCE(SUM(quantidade),0) as qtd,
                    COALESCE(SUM(valor),0)      as faturamento,
                    COALESCE(SUM(valor - custo),0) as lucro
             FROM vendas
             ${w.clausula}
             GROUP BY produto_nome
             ORDER BY ${ordem}
             LIMIT 10`
        ).all(...w.params);

        res.json(top);
    });

    // ---------- /api/dashboard/proximas-contas ----------
    // Próximas 5 contas pendentes, ordenadas por vencimento (vencidas primeiro)
    router.get('/proximas-contas', (req, res) => {
        const contas = db.prepare(
            `SELECT * FROM contas_pagar
             WHERE status = 'pendente'
             ORDER BY vencimento ASC
             LIMIT 5`
        ).all();
        res.json(contas);
    });

    return router;
};