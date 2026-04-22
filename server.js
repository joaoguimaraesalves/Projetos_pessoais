// server.js
const express = require('express');
const path = require('path');
const { initDb } = require('./db/schema');

const app = express();
const port = 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const db = initDb();

// Cada módulo de rotas recebe a conexão do banco por injeção.
// Isso facilita testes e evita uma variável "db" global.
app.use('/api/dashboard', require('./routes/dashboard')(db));
app.use('/api/produtos',  require('./routes/produtos')(db));
app.use('/api/vendas',    require('./routes/vendas')(db));
app.use('/api/saidas',    require('./routes/saidas')(db));

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

module.exports = app;

if (require.main === module) {
    app.listen(port, () => console.log(`🚀 JV Imports rodando em http://localhost:${port}`));
}