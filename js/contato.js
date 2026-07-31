/* ============================================================
   POWERFIT — FORMULÁRIO DE CONTATO
   Envia os dados para POST /mensagem no backend.
   ============================================================ */

(function () {
    const form = document.getElementById("formContato");
    if (!form) return;

    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const nome      = document.getElementById("nome").value.trim();
        const email     = document.getElementById("email").value.trim();
        const mensagem  = document.getElementById("mensagem").value.trim();

        if (!nome || !email || !mensagem) {
            mostrarToast("❌ Preencha todos os campos.");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            mostrarToast("❌ E-mail inválido.");
            return;
        }

        try {
            const baseURL = "https://candy-coffee-5kc6.onrender.com"

            const resposta = await fetch(`${baseURL}/mensagem`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ nome, email, mensagem })
            });

            let dados;
            try {
                dados = await resposta.json();
            } catch (_) {
                dados = {};
            }

            if (!resposta.ok) {
                mostrarToast("❌ " + (dados.mensagem || "Erro ao enviar mensagem."));
                return;
            }

            mostrarToast("✅ Mensagem enviada com sucesso!");
            form.reset();
        } catch (erro) {
            console.error(erro);
            mostrarToast("❌ Erro de comunicação com o servidor.");
        }
    });
})();
