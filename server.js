/*
============================================================
POWERFIT SUPLEMENTOS — SERVIDOR BACKEND
============================================================
Rotas disponíveis:
  GET  /                   → arquivo estático (index.html)
  POST /mensagem           → salva mensagem do formulário de contato
  POST /cadastro           → cadastra novo usuário (com hash bcrypt)
  POST /login              → autentica usuário e cria sessão
  POST /logout             → encerra a sessão atual
  GET  /me                 → retorna dados do usuário logado
  GET  /produtos           → lista produtos (catálogo)
  POST /receitas           → publica receita (com upload de imagem)
  POST /finalizar-compra   → finaliza pedido do carrinho
============================================================
*/

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const validator = require("validator");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const pool = require("./db.js");

const app = express();
const PORT = process.env.PORT || 3000;

/* ── MIDDLEWARES ────────────────────────────────────────── */

// CORS restrito às origens permitidas (em dev, libera localhost)
const allowedOrigins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:5500", // Live Server (VSCode)
    "http://127.0.0.1:5500",
    "https://psilvagomesh-bot.github.io/PI-PowerFit/"
];
app.use(cors({
    origin: (origin, cb) => {
        if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
        return cb(new Error("Origem não permitida pelo CORS"));
    },
    credentials: true
}));


app.use(express.json());

// Servir arquivos estáticos da pasta do projeto
app.use(express.static(__dirname));
app.use("/css",       express.static(path.join(__dirname, "css")));
app.use("/js",        express.static(path.join(__dirname, "js")));
app.use("/imagens",   express.static(path.join(__dirname, "imagens")));
app.use("/pages",     express.static(path.join(__dirname, "pages")));
app.use("/data",      express.static(path.join(__dirname, "data")));

// Configuração de sessão
const sessionConfig = {
    secret: process.env.SESSION_SECRET || "chave-dev-temporaria",
    resave: false,
    saveUninitialized: false,
    name: "pf_sid",
    cookie: {
        httpOnly: true,
        maxAge: 1000 * 60 * 60 // 1 hora
    }
};

if (process.env.NODE_ENV === "production") {
    sessionConfig.cookie.secure = true;
    sessionConfig.cookie.sameSite = "lax";
}

app.use(session(sessionConfig));

// Rate-limit: protege /login e /cadastro contra brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutos
    max: 20,                     // 20 tentativas por IP
    standardHeaders: true,
    legacyHeaders: false,
    message: { mensagem: "Muitas tentativas. Tente novamente em 15 minutos." }
});

// Multer para upload de imagens das receitas
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dest = path.join(__dirname, "public", "uploads");
        if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });
        cb(null, dest);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `receita-${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`);
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
    fileFilter: (req, file, cb) => {
        const tipos = /jpeg|jpg|png|webp|gif/;
        const ok = tipos.test(file.mimetype) && tipos.test(path.extname(file.originalname).toLowerCase());
        cb(ok ? null : new Error("Apenas imagens são permitidas."), ok);
    }
});

/* ── TESTE DE CONEXÃO ───────────────────────────────────── */

pool.getConnection()
    .then(() => console.log("✅ Banco conectado com sucesso!"))
    .catch((erro) => {
        console.error("❌ Erro ao conectar no banco:");
        console.error(erro);
    });

/* ── MIDDLEWARES AUXILIARES ─────────────────────────────── */

function autenticado(req, res, next) {
    if (req.session && req.session.usuarioId) return next();
    return res.status(401).json({ sucesso: false, mensagem: "Não autenticado." });
}

function sanitizar(str = "") {
    return String(str).trim().slice(0, 500);
}

/* ── ROTAS ──────────────────────────────────────────────── */

/* POST /mensagem  →  grava mensagem do formulário de contato */
app.post("/mensagem", async (req, res) => {
    try {
        const nome      = sanitizar(req.body.nome);
        const email     = validator.normalizeEmail(sanitizar(req.body.email)) || "";
        const mensagem  = sanitizar(req.body.mensagem);

        if (!nome || !email || !mensagem) {
            return res.status(400).json({ mensagem: "Preencha todos os campos." });
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({ mensagem: "E-mail inválido." });
        }

        await pool.execute(
            "INSERT INTO tb_mensagem (nome, email, mensagem) VALUES (?, ?, ?)",
            [validator.escape(nome), validator.escape(email), validator.escape(mensagem)]
        );

        return res.status(201).json({ mensagem: "Mensagem enviada com sucesso!" });
    } catch (error) {
        console.error("❌ Erro em /mensagem:", error);
        return res.status(500).json({ mensagem: "Erro no servidor." });
    }
});

/* POST /cadastro  →  cria usuário com senha hash bcrypt */
app.post("/cadastro", authLimiter, async (req, res) => {
    try {
        const nome  = sanitizar(req.body.nome);
        const email = validator.normalizeEmail(sanitizar(req.body.email)) || "";
        let senha   = String(req.body.senha || "");

        if (!nome || !email || !senha) {
            return res.status(400).json({ mensagem: "Preencha todos os campos." });
        }
        if (!validator.isEmail(email)) {
            return res.status(400).json({ mensagem: "E-mail inválido." });
        }
        if (senha.length < 6) {
            return res.status(400).json({ mensagem: "A senha deve ter ao menos 6 caracteres." });
        }

        const senhaHash = await bcrypt.hash(senha, 10);

        await pool.execute(
            "INSERT INTO tb_usuarios (nome, email, senha) VALUES (?, ?, ?)",
            [validator.escape(nome), email, senhaHash]
        );

        return res.status(201).json({ mensagem: "Cadastro realizado com sucesso!" });
    } catch (erro) {
        if (erro.code === "ER_DUP_ENTRY") {
            return res.status(400).json({ mensagem: "E-mail já cadastrado." });
        }
        console.error("❌ Erro em /cadastro:", erro);
        return res.status(500).json({ mensagem: "Erro ao cadastrar usuário." });
    }
});

/* POST /login  →  autentica e cria sessão */
app.post("/login", authLimiter, async (req, res) => {
    try {
        const email = validator.normalizeEmail(sanitizar(req.body.email)) || "";
        const senha = String(req.body.senha || "");

        if (!email || !senha) {
            return res.status(400).json({ sucesso: false, mensagem: "Informe e-mail e senha." });
        }

        const [usuarios] = await pool.execute(
            "SELECT id, nome, email, senha FROM tb_usuarios WHERE email = ? LIMIT 1",
            [email]
        );

        if (usuarios.length === 0) {
            return res.status(401).json({ sucesso: false, mensagem: "E-mail ou senha inválidos." });
        }

        const usuario = usuarios[0];
        const bateu = await bcrypt.compare(senha, usuario.senha);

        if (!bateu) {
            return res.status(401).json({ sucesso: false, mensagem: "E-mail ou senha inválidos." });
        }

        // Regenera a sessão para prevenir fixation attacks
        req.session.regenerate((err) => {
            if (err) {
                console.error(err);
                return res.status(500).json({ sucesso: false, mensagem: "Erro no servidor." });
            }
            req.session.usuarioId  = usuario.id;
            req.session.usuarioNome = usuario.nome;
            req.session.usuarioEmail = usuario.email;

            return res.json({
                sucesso: true,
                mensagem: "Login realizado com sucesso!",
                usuario: { id: usuario.id, nome: usuario.nome, email: usuario.email }
            });
        });
    } catch (erro) {
        console.error("❌ Erro em /login:", erro);
        return res.status(500).json({ sucesso: false, mensagem: "Erro no servidor." });
    }
});

/* POST /logout  →  encerra sessão */
app.post("/logout", (req, res) => {
    req.session.destroy(() => {
        res.clearCookie("pf_sid");
        return res.json({ sucesso: true, mensagem: "Logout realizado." });
    });
});

/* GET /me  →  retorna dados do usuário logado */
app.get("/me", autenticado, (req, res) => {
    return res.json({
        sucesso: true,
        autenticado: true,
        usuario: {
            id: req.session.usuarioId,
            nome: req.session.usuarioNome,
            email: req.session.usuarioEmail
        }
    });
});

/* GET /produtos  →  retorna catálogo de produtos */
app.get("/produtos", async (req, res) => {
    try {
        const file = path.join(__dirname, "data", "script.json");
        const raw  = fs.readFileSync(file, "utf8");
        const data = JSON.parse(raw);
        return res.json(data);
    } catch (err) {
        console.error("❌ Erro em /produtos:", err);
        return res.status(500).json({ mensagem: "Erro ao carregar produtos." });
    }
});

/* GET /receitas  →  retorna todas as receitas */
app.get("/receitas", async (req, res) => {
    try {
        const [rows] = await pool.execute(
            "SELECT id, autor, titulo, descricao, imagem, criado_em FROM tb_receitas ORDER BY criado_em DESC"
        );
        return res.json({ receitas: rows });
    } catch (err) {
        console.error("❌ Erro em /receitas:", err);
        return res.status(500).json({ receitas: [] });
    }
});

/* POST /receitas  →  publica nova receita (com ou sem imagem) */
app.post("/receitas", autenticado, upload.single("imagem"), async (req, res) => {
    try {
        const titulo   = sanitizar(req.body.titulo);
        const descricao = sanitizar(req.body.descricao);
        const autor    = req.session.usuarioNome || "Anônimo";

        if (!titulo || !descricao) {
            return res.status(400).json({ mensagem: "Preencha título e descrição." });
        }

        const imagem = req.file ? `/uploads/${req.file.filename}` : null;

        await pool.execute(
            "INSERT INTO tb_receitas (autor, titulo, descricao, imagem) VALUES (?, ?, ?, ?)",
            [validator.escape(autor), validator.escape(titulo), validator.escape(descricao), imagem]
        );

        return res.status(201).json({ mensagem: "Receita publicada com sucesso!" });
    } catch (err) {
        console.error("❌ Erro em POST /receitas:", err);
        return res.status(500).json({ mensagem: "Erro ao publicar receita." });
    }
});

/* POST /finalizar-compra  →  registra pedido do usuário logado */
app.post("/finalizar-compra", autenticado, async (req, res) => {
    try {
        const itens = Array.isArray(req.body.itens) ? req.body.itens : [];
        if (itens.length === 0) {
            return res.status(400).json({ mensagem: "Carrinho vazio." });
        }

        // Sanitiza cada item
        const itensLimpos = itens
            .map(i => ({
                nome: sanitizar(i.nome),
                preco: Number(i.preco) || 0,
                qtd: Math.max(1, parseInt(i.qtd, 10) || 1)
            }))
            .filter(i => i.nome && i.preco > 0);

        if (itensLimpos.length === 0) {
            return res.status(400).json({ mensagem: "Itens inválidos no carrinho." });
        }

        const total = itensLimpos.reduce((s, i) => s + i.preco * i.qtd, 0);
        const itensJson = JSON.stringify(itensLimpos);

        await pool.execute(
            "INSERT INTO tb_pedidos (usuario_id, itens, total, criado_em) VALUES (?, ?, ?, NOW())",
            [req.session.usuarioId, itensJson, total]
        );

        return res.status(201).json({
            sucesso: true,
            mensagem: "Pedido finalizado com sucesso!",
            protocolo: `PF-${Date.now().toString().slice(-8)}`,
            total
        });
    } catch (err) {
        console.error("❌ Erro em /finalizar-compra:", err);
        return res.status(500).json({ mensagem: "Erro ao finalizar a compra." });
    }
});

/* Rota de fallback — 404 */
app.use((req, res) => {
    res.status(404).json({ mensagem: "Rota não encontrada." });
});

/* ── START ──────────────────────────────────────────────── */
app.listen(PORT, () => {
    console.log(`🚀 Servidor rodando em http://localhost:${PORT}`);
});
