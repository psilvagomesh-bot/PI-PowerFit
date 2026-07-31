# 🏋️ PowerFit Suplementos

Loja virtual de suplementos esportivos com vitrine, carrinho, autenticação e publicação de receitas pela comunidade.

**Stack:** Node.js (Express) · MySQL · HTML · CSS · JavaScript (vanilla)

---

## ✨ Funcionalidades

- 🛒 **Catálogo de 6 produtos** com filtros por categoria e busca por nome
- 🛍️ **Carrinho** persistido em `localStorage` (sem login obrigatório)
- 🔐 **Login / Cadastro** com hash de senha (bcrypt) e sessão via cookie `pf_sid`
- 📩 **Formulário de contato** persistido em banco (`tb_mensagem`)
- 🍽️ **Receitas da comunidade** — usuários logados podem publicar (com upload de foto)
- 📱 **Design responsivo** (desktop, tablet e celular)
- 🛡️ **Proteções:** rate-limit em auth, sanitização contra XSS, validação de e-mail, origens CORS restritas

---

## 🛠️ Pré-requisitos

| Recurso | Versão |
|---|---|
| Node.js | ≥ 18.x |
| MySQL | ≥ 8.0 (ou serviço gerenciado, ex.: Aiven) |
| npm | ≥ 9.x |

---

## 🚀 Instalação

```bash
# 1. Clonar ou baixar o projeto
git clone <repo-url> PI-PowerFit && cd PI-PowerFit

# 2. Instalar dependências
npm install

# 3. Configurar variáveis de ambiente
cp .env.example .env
# edite o .env com seus valores reais (host, usuário, senha do MySQL etc.)

# 4. Criar o schema do banco
# No MySQL local OU via cliente (HeidiSQL, DBeaver etc.):
mysql -u root -p < data/schema.sql
# Em hospedagens gerenciadas (Aiven), basta colar o conteúdo de data/schema.sql no console SQL.

# 5. Iniciar o servidor
npm start
```

O servidor estará disponível em **http://localhost:3000**.

---

## 📁 Estrutura do projeto

```
PI-PowerFit/
├── server.js              # API Express (rotas /mensagem /cadastro /login /me /produtos /receitas /finalizar-compra)
├── db.js                  # Pool de conexões MySQL
├── package.json
├── README.md
├── .env.example           # Modelo das variáveis de ambiente
├── .gitignore
├── data/
│   ├── script.json        # Catálogo de produtos
│   └── schema.sql         # Script de criação do banco
├── public/uploads/        # Imagens enviadas nas receitas
├── css/
│   └── style.css          # Estilo global (paleta dark + neon)
├── js/
│   ├── script.js          # Carrinho, login/cadastro, produtos, receitas
│   └── contato.js         # Envio do formulário de contato
├── imagens/               # Imagens dos produtos
├── pages/
│   ├── produtos.html      # Catálogo + filtros
│   ├── sobre.html         # História + missão + valores
│   ├── receitas.html      # Receitas + formulário de publicação
│   ├── contato.html       # Formulário de contato
│   ├── login.html         # Login + cadastro lado a lado
│   └── carrinho.html      # Carrinho + checkout + modal de sucesso
└── index.html             # Home
```

---

## 🔌 Rotas da API

| Método | Rota                | Autenticação | Descrição                                  |
|--------|---------------------|---------------|--------------------------------------------|
| GET    | `/`                 | —             | Arquivos estáticos do projeto               |
| POST   | `/mensagem`         | —             | Grava mensagem do contato                  |
| POST   | `/cadastro`         | —             | Cadastra usuário (com hash bcrypt)         |
| POST   | `/login`            | —             | Autentica e cria sessão                    |
| POST   | `/logout`           | sessão válida | Encerra sessão                             |
| GET    | `/me`               | sessão válida | Retorna dados do usuário logado            |
| GET    | `/produtos`         | —             | Lista catálogo de produtos                 |
| GET    | `/receitas`         | —             | Lista receitas publicadas                  |
| POST   | `/receitas`         | sessão válida | Publica receita (com upload de imagem)     |
| POST   | `/finalizar-compra` | sessão válida | Registra pedido do carrinho no banco       |

---

## 🗄️ Estrutura do Banco

| Tabela        | Colunas                                            |
|---------------|----------------------------------------------------|
| `tb_usuarios` | `id`, `nome`, `email` (UNIQUE), `senha` (hash)     |
| `tb_mensagem` | `id`, `nome`, `email`, `mensagem`, `criado_em`     |
| `tb_receitas` | `id`, `autor`, `titulo`, `descricao`, `imagem`     |
| `tb_pedidos`  | `id`, `usuario_id` (FK), `itens` (JSON), `total`   |

Schema completo em **data/schema.sql**.

---

## 🧪 Testes rápidos após subir o servidor

```bash
# Página inicial
http://localhost:3000/

# Catálogo
http://localhost:3000/pages/produtos.html

# Envio de mensagem (deve retornar sucesso)
curl -X POST http://localhost:3000/mensagem \
     -H "Content-Type: application/json" \
     -d '{"nome":"Teste","email":"t@t.com","mensagem":"Oi"}'

# Cadastro
curl -X POST http://localhost:3000/cadastro \
     -H "Content-Type: application/json" \
     -d '{"nome":"Lucas","email":"lucas@t.com","senha":"123456"}'

# Login (manter cookies)
curl -c cookies.txt -X POST http://localhost:3000/login \
     -H "Content-Type: application/json" \
     -d '{"email":"lucas@t.com","senha":"123456"}'

# /me autenticado
curl -b cookies.txt http://localhost:3000/me
```

---

## 🔒 Observações de segurança

- Senhas são armazenadas **apenas com hash bcrypt** (10 rounds).
- Sessões expiram em **1 hora** (`maxAge: 1000*60*60`).
- Em produção (NODE_ENV=production) o cookie recebe `secure: true` e `sameSite: "lax"`.
- Inputs enviados ao banco passam por `validator.escape()` (anti-XSS).
- `/login` e `/cadastro` recebem **rate-limit** (20 req/15min por IP).
- CORS está restrito às origens da lista em `server.js` — ajuste conforme necessário.

---

## 📜 Licença

ISC — feito para fins didáticos (Projeto Integrador).
