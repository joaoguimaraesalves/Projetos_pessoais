// db/schema.js
const Database = require('better-sqlite3');
const path = require('path');

function initDb() {
    const dbPath = path.join(__dirname, '..', 'sistema.sqlite');
    const db = new Database(dbPath);
    db.pragma('journal_mode = WAL'); // melhora performance e concorrência em leitura/escrita

    // db.exec aceita múltiplos statements de uma vez, separados por ';'
    db.exec(`
        CREATE TABLE IF NOT EXISTS produtos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nome TEXT NOT NULL,
            custo REAL NOT NULL DEFAULT 0,
            preco REAL NOT NULL DEFAULT 0,
            quantidade INTEGER NOT NULL DEFAULT 0
        );

        CREATE TABLE IF NOT EXISTS vendas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER,
            produto_nome TEXT,
            quantidade INTEGER,
            valor REAL,
            custo REAL,
            forma_pagamento TEXT,
            data TEXT
        );

        CREATE TABLE IF NOT EXISTS saidas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            valor REAL,
            data TEXT
        );

        CREATE TABLE IF NOT EXISTS compras (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            valor_total REAL,
            forma_pagamento TEXT,
            parcelas INTEGER DEFAULT 1,
            data TEXT
        );

        CREATE TABLE IF NOT EXISTS compra_itens (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            compra_id INTEGER,
            produto_id INTEGER,
            produto_nome TEXT,
            quantidade INTEGER,
            custo_unitario REAL,
            FOREIGN KEY (compra_id) REFERENCES compras(id),
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        );

        CREATE TABLE IF NOT EXISTS contas_pagar (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            descricao TEXT,
            valor REAL,
            vencimento TEXT,
            status TEXT DEFAULT 'pendente',
            data_pagamento TEXT,
            compra_id INTEGER,
            parcela_num INTEGER,
            parcela_total INTEGER,
            FOREIGN KEY (compra_id) REFERENCES compras(id)
        );

        CREATE TABLE IF NOT EXISTS estoque_movimentos (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            produto_id INTEGER,
            tipo TEXT,
            quantidade INTEGER,
            custo_unitario REAL,
            origem_tipo TEXT,
            origem_id INTEGER,
            observacao TEXT,
            data TEXT,
            FOREIGN KEY (produto_id) REFERENCES produtos(id)
        );
    `);

    console.log('Banco de dados da JV Imports conectado!');
    return db;
}

module.exports = { initDb };