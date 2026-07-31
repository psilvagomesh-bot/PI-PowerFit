/* ============================================================
   POWERFIT SUPLEMENTOS — SCRIPT PRINCIPAL (v1.1)
   Gerencia: carrinho (localStorage), filtros/busca de produtos,
             login/cadastro, receitas, badge do carrinho e estado
             de autenticação via /me.
   ============================================================ */

const API_BASE = "https://candy-coffee-5kc6.onrender.com"

/* ── UTILITÁRIOS ─────────────────────────────────────────── */

/** Formata número em R$ 0,00 */
function formatarBRL(valor) {
    return "R$ " + Number(valor || 0).toFixed(2).replace(".", ",").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Exibe toast temporário */
function mostrarToast(msg, tempo = 3000) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(() => toast.classList.remove("show"), tempo);
}

/** Escape para previnir XSS ao inserir HTML dinâmico */
function escapeHTML(str = "") {
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/** Cache simples do estado de autenticação */
let _usuarioLogado = null;

/* ── ESTADO DE AUTENTICAÇÃO ───────────────────────────────── */

async function verificarAuth() {
    try {
        const res = await fetch(`${API_BASE}/me`, {
            credentials: "include",
            // se for file:// não tem como fazer fetch — tratar abaixo
        });
        if (res.ok) {
            const dados = await res.json();
            _usuarioLogado = dados.usuario || null;
        } else {
            _usuarioLogado = null;
        }
    } catch (e) {
        _usuarioLogado = null;
    }
    atualizarLinkLogin();
    return _usuarioLogado;
}

function atualizarLinkLogin() {
    const link = document.getElementById("linkLogin");
    if (!link) return;

    if (_usuarioLogado) {
        link.textContent = `🚪 Sair (${_usuarioLogado.nome.split(" ")[0]})`;
        link.href = "#";
        link.addEventListener("click", async (ev) => {
            ev.preventDefault();
            await logout();
        }, { once: true });
    } else {
        link.textContent = "Login";
        link.href = "login.html";
    }
}

async function logout() {
    try {
        await fetch(`${API_BASE}/logout`, {
            method: "POST",
            credentials: "include"
        });
    } catch (_) { }
    _usuarioLogado = null;
    mostrarToast("👋 Você saiu da conta.");
    setTimeout(() => window.location.href = "../index.html", 800);
}

/* ── PRODUTOS (catálogo dinâmico) ─────────────────────────── */

let produtosLista = [];

async function carregarProdutos() {
    const container = document.getElementById("lista-produtos");
    const destaque   = document.getElementById("produtos-destaque-grid");

    if (!container && !destaque) return;

    try {
        // Tenta via endpoint do backend — fallback para JSON estático
        let dados;
        try {
            const res = await fetch(`${API_BASE}/produtos`, { credentials: "include" });
            if (res.ok) dados = await res.json();
        } catch (_) { }

        if (!dados) {
            const res = await fetch("./data/script.json", { cache: "no-store" });
            if (!res.ok) throw new Error("Erro ao carregar produtos");
            dados = await res.json();
        }

        produtosLista = dados.produtos || [];

        if (container) renderizarProdutos(produtosLista, container);
        if (destaque)  renderizarProdutos(produtosLista.slice(0, 4), destaque);
    } catch (erro) {
        console.error("Erro ao carregar produtos:", erro);
        if (container) container.innerHTML = '<p style="text-align:center; padding:40px;">⚠️ Não foi possível carregar os produtos.</p>';
        if (destaque)  destaque.innerHTML  = '<p style="text-align:center; padding:40px;">⚠️ Não foi possível carregar os produtos.</p>';
    }
}

function cardProduto(produto) {
    const precoAntigo = produto.preco_original
        ? `<small>${formatarBRL(produto.preco_original)}</small>`
        : "";
    const badge = produto.badge
        ? `<span class="produto-badge">${escapeHTML(produto.badge)}</span>`
        : "";

    const safeNome   = escapeHTML(produto.nome).replace(/'/g, "\\'");
    const safeImagem = escapeHTML(produto.imagem);
    const preco       = Number(produto.preco || 0);

    return `
        <div class="produto-card" data-categoria="${escapeHTML(produto.categoria)}">
            <div class="produto-card-img-wrap">
                <img src="${safeImagem}" alt="${safeNome}" class="produto-card-img" loading="lazy"
                     onerror="this.src='../imagens/banner.jpg'">
                ${badge}
            </div>
            <div class="produto-card-body">
                <h3 class="produto-card-nome">${safeNome}</h3>
                <p class="produto-card-desc">${escapeHTML(produto.descricao || '')}</p>
                <div class="produto-card-preco">${formatarBRL(preco)} ${precoAntigo}</div>
            </div>
            <div class="produto-card-footer">
                <button class="btn-primario" onclick="adicionarCarrinho('${safeNome}', ${preco})">
                    🛒 Adicionar
                </button>
            </div>
        </div>
    `;
}

function renderizarProdutos(lista, container) {
    if (!container) return;
    if (!lista || lista.length === 0) {
        container.innerHTML = "";
        const vazia = document.getElementById("mensagem-vazia");
        if (vazia) vazia.style.display = "block";
        return;
    } else {
        const vazia = document.getElementById("mensagem-vazia");
        if (vazia) vazia.style.display = "none";
    }
    container.innerHTML = lista.map(cardProduto).join("");
}

/* ── FILTROS + BUSCA ─────────────────────────────────────── */

function initFiltrosEBusca() {
    const container = document.getElementById("lista-produtos");
    const input     = document.getElementById("pesquisaProduto");
    const botoes    = document.querySelectorAll(".filtro-btn");

    if (botoes.length === 0 && !input) return;

    let categoriaAtiva = "todos";
    let termoAtivo = "";

    function aplicarFiltros() {
        let resultados = produtosLista;

        if (categoriaAtiva !== "todos") {
            resultados = resultados.filter(p => p.categoria === categoriaAtiva);
        }

        if (termoAtivo) {
            const t = termoAtivo.toLowerCase();
            resultados = resultados.filter(p =>
                p.nome.toLowerCase().includes(t) ||
                (p.descricao || "").toLowerCase().includes(t)
            );
        }

        renderizarProdutos(resultados, container);
    }

    botoes.forEach(btn => {
        btn.addEventListener("click", () => {
            botoes.forEach(b => b.classList.remove("ativo"));
            btn.classList.add("ativo");
            categoriaAtiva = btn.dataset.filtro;
            aplicarFiltros();
        });
    });

    if (input) {
        input.addEventListener("input", () => {
            termoAtivo = input.value.trim().toLowerCase();
            aplicarFiltros();
        });
    }
}

/* ── CARRINHO (localStorage) ──────────────────────────────── */

const STORAGE_KEY = "pf_carrinho_v1";

function getCarrinho() {
    try {
        return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
        return [];
    }
}

function salvarCarrinho(c) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(c));
}

function atualizarBadge() {
    const badge = document.getElementById("badgeContador");
    if (!badge) return;
    badge.textContent = getCarrinho().reduce((s, i) => s + i.qtd, 0);
}

function adicionarCarrinho(nome, preco) {
    const carrinho = getCarrinho();
    const idx = carrinho.findIndex(p => p.nome === nome);
    if (idx > -1) {
        carrinho[idx].qtd += 1;
    } else {
        carrinho.push({ nome: String(nome).slice(0, 120), preco: Number(preco) || 0, qtd: 1 });
    }
    salvarCarrinho(carrinho);
    atualizarBadge();
    mostrarToast("✅ " + nome + " foi adicionado ao carrinho!");
}

function alterarQtd(nome, delta) {
    const carrinho = getCarrinho();
    const idx = carrinho.findIndex(p => p.nome === nome);
    if (idx === -1) return;
    carrinho[idx].qtd = Math.max(1, carrinho[idx].qtd + delta);
    salvarCarrinho(carrinho);
    renderizarCarrinho();
}

function removerItem(nome) {
    let carrinho = getCarrinho();
    carrinho = carrinho.filter(p => p.nome !== nome);
    salvarCarrinho(carrinho);
    renderizarCarrinho();
    mostrarToast("🗑️ Item removido do carrinho.");
}

function renderizarCarrinho() {
    const lista  = document.getElementById("lista-carrinho");
    const resumo = document.getElementById("carrinho-resumo");
    const vazio  = document.getElementById("carrinho-vazio");
    if (!lista) return;

    atualizarBadge();
    const carrinho = getCarrinho();
    lista.innerHTML = "";

    if (carrinho.length === 0) {
        if (resumo) resumo.style.display = "none";
        if (vazio) vazio.style.display = "block";
        return;
    }
    if (vazio) vazio.style.display = "none";

    let subtotal = 0;

    carrinho.forEach(item => {
        const totalItem = item.preco * item.qtd;
        subtotal += totalItem;
        const li = document.createElement("div");
        li.className = "produto-item";
        li.innerHTML = `
            <div class="produto-item-img">🛒</div>
            <div class="produto-item-info">
                <h4>${escapeHTML(item.nome)}</h4>
                <p>${formatarBRL(item.preco)} cada</p>
            </div>
            <div class="produto-item-controle">
                <button class="qtd-btn" onclick="alterarQtd('${escapeHTML(item.nome).replace(/'/g, "\\'")}', -1)" aria-label="Diminuir">−</button>
                <span class="qtd-valor">${item.qtd}</span>
                <button class="qtd-btn" onclick="alterarQtd('${escapeHTML(item.nome).replace(/'/g, "\\'")}', 1)" aria-label="Aumentar">+</button>
                <span class="qtd-valor" style="color: var(--neon); font-weight:700; min-width:90px; text-align:right;">${formatarBRL(totalItem)}</span>
                <button class="qtd-remover" onclick="removerItem('${escapeHTML(item.nome).replace(/'/g, "\\'")}')" title="Remover">🗑️</button>
            </div>
        `;
        lista.appendChild(li);
    });

    if (resumo) {
        resumo.style.display = "block";
        document.getElementById("resumo-subtotal").textContent = formatarBRL(subtotal);
        document.getElementById("resumo-total").textContent    = formatarBRL(subtotal);

        // Mostra aviso se não estiver logado
        const aviso = document.getElementById("aviso-login");
        if (aviso) aviso.style.display = _usuarioLogado ? "none" : "block";
    }
}

/* ── FINALIZAR COMPRA ────────────────────────────────────── */

async function finalizarCompra() {
    const carrinho = getCarrinho();
    if (carrinho.length === 0) {
        mostrarToast("🛒 Seu carrinho está vazio.");
        return;
    }

    if (!_usuarioLogado) {
        mostrarToast("⚠️ Faça login para finalizar a compra.");
        setTimeout(() => window.location.href = "login.html", 1200);
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/finalizar-compra`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ itens: carrinho })
        });

        const dados = await res.json();

        if (!res.ok || !dados.sucesso) {
            mostrarToast("❌ " + (dados.mensagem || "Erro ao finalizar o pedido."));
            return;
        }

        // Modal de sucesso
        const modal        = document.getElementById("modal-pedido");
        const protoEl      = document.getElementById("modal-protocolo");
        const totalEl      = document.getElementById("modal-total");
        if (modal) {
            if (protoEl) protoEl.textContent = dados.protocolo || "";
            if (totalEl) totalEl.textContent = formatarBRL(dados.total || 0);
            modal.style.display = "flex";
        }
        salvarCarrinho([]);
        atualizarBadge();
        renderizarCarrinho();
    } catch (e) {
        console.error(e);
        mostrarToast("❌ Erro ao comunicar com o servidor.");
    }
}

/* ── RECEITAS ────────────────────────────────────────────── */

async function carregarReceitas() {
    const destino = document.getElementById("receitas-dinamicas");
    if (!destino) return;

    try {
        const res = await fetch(`${API_BASE}/receitas`);
        if (!res.ok) throw new Error("Falha /receitas");
        const dados = await res.json();
        const receitas = dados.receitas || [];

        if (receitas.length === 0) {
            destino.innerHTML = `
                <p style="text-align:center; color: var(--cinza-texto); padding:20px;">
                    Nenhuma receita publicada ainda. Que tal compartilhar a sua?
                </p>`;
            return;
        }

        destino.innerHTML = receitas.map(r => `
            <div class="receita-card">
                ${r.imagem ? `<img src="${escapeHTML(r.imagem)}" alt="${escapeHTML(r.titulo)}" class="receita-img" loading="lazy">` : ""}
                <h3>🍽️ ${escapeHTML(r.titulo)}</h3>
                <p><strong>Por:</strong> ${escapeHTML(r.autor)}</p>
                <p style="margin-top: 8px;">${escapeHTML(r.descricao)}</p>
            </div>
        `).join("");
    } catch (e) {
        destino.innerHTML = `
            <p style="text-align:center; color: var(--cinza-texto); padding:20px;">
                Não foi possível carregar as receitas agora.
            </p>`;
    }
}

function initFormReceita() {
    const form = document.getElementById("formReceita");
    if (!form) return;

    const msgReceita = document.getElementById("msg-receita");
    const publicarForm = form;

    if (!_usuarioLogado) {
        if (msgReceita) msgReceita.innerHTML = `Você precisa estar <a href="login.html" style="color:var(--neon);">logado</a> para publicar uma receita.`;
        publicarForm.style.display = "none";
        return;
    } else {
        if (msgReceita) msgReceita.textContent = `Você está logado como ${_usuarioLogado.nome}. Compartilhe uma receita com a comunidade!`;
        publicarForm.style.display = "block";
    }

    publicarForm.addEventListener("submit", async (ev) => {
        ev.preventDefault();
        const titulo = document.getElementById("nomeReceita").value.trim();
        const descricao = document.getElementById("descReceita").value.trim();
        const foto = document.getElementById("fotoReceita").files[0];

        if (!titulo || !descricao) {
            mostrarToast("❌ Preencha título e descrição.");
            return;
        }

        const fd = new FormData();
        fd.append("titulo", titulo);
        fd.append("descricao", descricao);
        if (foto) fd.append("imagem", foto);

        try {
            const res = await fetch(`${API_BASE}/receitas`, {
                method: "POST",
                credentials: "include",
                body: fd
            });
            const dados = await res.json();
            if (!res.ok) throw new Error(dados.mensagem || "Erro ao publicar");
            mostrarToast("✅ Receita publicada com sucesso!");
            publicarForm.reset();
            await carregarReceitas();
        } catch (e) {
            mostrarToast("❌ " + e.message);
        }
    });
}

/* ── ALTERNAR ABAS LOGIN / CADASTRO ──────────────────────── */
/**
 * Mostra apenas um dos formulários (login ou cadastro) dentro do mesmo card.
 * Usado em pages/login.html — pressupõe #login, #cadastro e dois .tabs .tab.
 */
function mostrarFormulario(tipo) {
    const login    = document.getElementById("login");
    const cadastro = document.getElementById("cadastro");
    if (!login || !cadastro) return;

    const tabs = document.querySelectorAll(".tabs .tab");
    tabs.forEach(t => {
        t.classList.remove("active");
        t.setAttribute("aria-selected", "false");
    });

    if (tipo === "cadastro") {
        cadastro.classList.remove("hidden");
        login.classList.add("hidden");
        if (tabs[1]) {
            tabs[1].classList.add("active");
            tabs[1].setAttribute("aria-selected", "true");
        }
    } else {
        login.classList.remove("hidden");
        cadastro.classList.add("hidden");
        if (tabs[0]) {
            tabs[0].classList.add("active");
            tabs[0].setAttribute("aria-selected", "true");
        }
    }
}

/** Permite abrir ?tab=cadastro direto pela URL */
function initAbasAuth() {
    if (!document.getElementById("login") || !document.getElementById("cadastro")) return;
    try {
        const params = new URLSearchParams(window.location.search);
        const tab = (params.get("tab") || "").toLowerCase();
        if (tab === "cadastro") mostrarFormulario("cadastro");
    } catch (_) { /* sem URLSearchParams -> mantém aba padrão */ }
}

/* ── FORMULÁRIOS DE LOGIN / CADASTRO ─────────────────────── */

function initFormsAuth() {
    // LOGIN
    const formLogin = document.getElementById("formLogin");
    if (formLogin) {
        formLogin.addEventListener("submit", async (e) => {
            e.preventDefault();
            const email = document.getElementById("emailLogin").value.trim();
            const senha = document.getElementById("senhaLogin").value;

            if (!email || !senha) {
                mostrarToast("❌ Preencha e-mail e senha.");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/login`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, senha })
                });
                const dados = await res.json();
                if (!res.ok || !dados.sucesso) {
                    mostrarToast("❌ " + (dados.mensagem || "Falha no login."));
                    return;
                }
                mostrarToast("✅ Login realizado! Bem-vindo(a), " + (dados.usuario?.nome || ""));
                setTimeout(() => window.location.href = "../index.html", 800);
            } catch (err) {
                mostrarToast("❌ Erro de comunicação com o servidor.");
            }
        });
    }

    // CADASTRO
    const formCadastro = document.getElementById("formCadastroForm");
    if (formCadastro) {
        formCadastro.addEventListener("submit", async (e) => {
            e.preventDefault();
            const nome = document.getElementById("nomeNovo").value.trim();
            const email = document.getElementById("emailNovo").value.trim();
            const senha = document.getElementById("senhaNova").value;
            const confirma = document.getElementById("senhaConfirm").value;

            if (!nome || !email || !senha || !confirma) {
                mostrarToast("❌ Preencha todos os campos do cadastro.");
                return;
            }

            if (senha.length < 6) {
                mostrarToast("❌ A senha deve ter pelo menos 6 caracteres.");
                return;
            }

            if (senha !== confirma) {
                mostrarToast("❌ As senhas não coincidem.");
                return;
            }

            // Validação de e-mail simples no frontend
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(email)) {
                mostrarToast("❌ E-mail inválido.");
                return;
            }

            try {
                const res = await fetch(`${API_BASE}/cadastro`, {
                    method: "POST",
                    credentials: "include",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ nome, email, senha })
                });
                const dados = await res.json();

                if (!res.ok) {
                    mostrarToast("❌ " + (dados.mensagem || "Erro no cadastro."));
                    return;
                }

                mostrarToast("✅ " + dados.mensagem);
                formCadastro.reset();
                // Pré-preenche o email no login e troca a aba de volta para login
                const emailLogin = document.getElementById("emailLogin");
                if (emailLogin) emailLogin.value = email;
                setTimeout(() => {
                    mostrarFormulario("login");
                    if (emailLogin) emailLogin.focus();
                }, 1200);
            } catch (err) {
                mostrarToast("❌ Erro de comunicação com o servidor.");
            }
        });
    }
}

/* ── MENU MOBILE ─────────────────────────────────────────── */

function initMenuToggle() {
    const btn = document.getElementById("menuToggle");
    const menu = document.getElementById("menu");
    if (!btn || !menu) return;

    btn.addEventListener("click", () => {
        const aberto = menu.classList.toggle("aberto");
        btn.setAttribute("aria-expanded", aberto ? "true" : "false");
    });
}

/* ── INICIALIZAÇÃO ───────────────────────────────────────── */

document.addEventListener("DOMContentLoaded", async () => {
    atualizarBadge();
    initMenuToggle();

    await verificarAuth();
    initAbasAuth();
    initFormsAuth();
    initFormReceita();
    carregarReceitas();

    await carregarProdutos();
    initFiltrosEBusca();

    if (document.getElementById("lista-carrinho")) {
        renderizarCarrinho();
    }
});
