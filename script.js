// =========================================================================
// URL DO APP DA WEB CONFIGURADA
// =========================================================================
const SCRIPT_URL = "https://script.google.com/macros/s/AKfycbx07yzNG9y14AXVld5Hd3mjjhs1yNDGv7Tc_GR1ZKT77qNuY5BEO_4qKm0rSBdO7S5Nvg/exec";

// Estado global da aplicação
let pacientes = [];
let vacinas = [];
let pacienteSelecionado = null;
let pacienteEmEdicaoId = null;
let vacinaEmEdicaoId = null;
let calendarioDataAtual = new Date();
calendarioDataAtual.setDate(1);

// Elementos do DOM
const loader = document.getElementById("loader");
const loaderText = document.getElementById("loader-text");
const toast = document.getElementById("toast");

const searchInput = document.getElementById("search-input");
const btnClearSearch = document.getElementById("btn-clear-search");
const pacientesCount = document.getElementById("pacientes-count");
const listaPacientesSection = document.getElementById("lista-pacientes-section");
const fichaPacienteSection = document.getElementById("ficha-paciente-section");

// Inicialização
document.addEventListener("DOMContentLoaded", () => {
    configurarMascaras();
    configurarEventos();
    carregarDadosDoDrive();
});

// =========================================================================
// COMUNICAÇÃO COM GOOGLE DRIVE (APPS SCRIPT)
// =========================================================================

async function carregarDadosDoDrive() {
    if (!SCRIPT_URL || SCRIPT_URL.includes("COLE_SUA_URL")) {
        pacientesCount.textContent = "⚠️ Configure a URL do Google Apps Script no arquivo script.js.";
        return;
    }

    mostrarLoader("Espera ai, tô carregando!");
    try {
        const response = await fetch(SCRIPT_URL);
        const data = await response.json();

        if (data.status === "success") {
            pacientes = data.pacientes || [];
            vacinas = data.vacinas || [];
            renderizarListaPacientes(searchInput.value);
            renderizarCalendarioAgenda();

            // Atualiza a ficha se estiver aberta
            if (pacienteSelecionado) {
                const atualizado = pacientes.find((p) => p.id === pacienteSelecionado.id);
                if (atualizado) abrirFichaPaciente(atualizado);
            }
        } else {
            mostrarToast("Erro ao ler dados da planilha.");
        }
    } catch (error) {
        console.error(error);
        mostrarToast("Falha de conexão com o Google Drive.");
    } finally {
        esconderLoader();
    }
}

async function enviarParaDrive(payload, mensagemLoader) {
    if (!SCRIPT_URL || SCRIPT_URL.includes("COLE_SUA_URL")) {
        mostrarToast("Configure a URL do Apps Script no script.js primeiro!");
        return null;
    }

    mostrarLoader(mensagemLoader);
    try {
        const response = await fetch(SCRIPT_URL, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        return result;
    } catch (error) {
        console.error(error);
        mostrarToast("Erro ao salvar no Google Drive.");
        return null;
    } finally {
        esconderLoader();
    }
}

// =========================================================================
// RENDERIZAÇÃO E BUSCA DE PACIENTES
// =========================================================================

function renderizarListaPacientes(filtro = "") {
    const termo = filtro.trim().toLowerCase();
    const termoNumerico = termo.replace(/\D/g, "");

    const filtrados = pacientes.filter((p) => {
        const nomeMatch = (p.nome || "").toLowerCase().includes(termo);
        const cpfLimpo = String(p.cpf || "").replace(/\D/g, "");
        const telLimpo = String(p.contato || "").replace(/\D/g, "");

        const cpfMatch = termoNumerico.length > 0 && cpfLimpo.includes(termoNumerico);
        const telMatch = termoNumerico.length > 0 && telLimpo.includes(termoNumerico);

        return !termo || nomeMatch || cpfMatch || telMatch;
    });

    pacientesCount.textContent =
        filtrados.length === 1
            ? "1 paciente encontrado"
            : `${filtrados.length} pacientes encontrados`;

    listaPacientesSection.innerHTML = "";

    if (filtrados.length === 0) {
        listaPacientesSection.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        Nenhum paciente encontrado com "${filtro}". Clique em <strong>+ Novo Paciente</strong> para cadastrar.
      </div>
    `;
        return;
    }

    filtrados.forEach((paciente) => {
        const idade = calcularIdade(paciente.dataNascimento);
        const ehMenor = idade !== null && idade < 18;

        const card = document.createElement("div");
        card.className = "patient-card";
        card.innerHTML = `
      <div class="patient-card-header">
        <h3>${paciente.nome}</h3>
        ${ehMenor ? '<span class="badge badge-pink">Menor</span>' : ""}
      </div>
      <p><strong>CPF:</strong> ${paciente.cpf || "Não informado"}</p>
      <p><strong>Contato:</strong> ${paciente.contato || "Não informado"}</p>
      <p><strong>Nascimento:</strong> ${formatarDataBR(paciente.dataNascimento)} (${idade !== null ? idade + " anos" : "-"})</p>
    `;

        card.addEventListener("click", () => abrirFichaPaciente(paciente));
        listaPacientesSection.appendChild(card);
    });
}

// =========================================================================
// PRONTUÁRIO / FICHA DO PACIENTE
// =========================================================================

function abrirFichaPaciente(paciente) {
    document.getElementById("agenda-calendario-section").classList.add("hidden");
    pacienteSelecionado = paciente;

    // Alterna visualização
    document.querySelector(".search-section").classList.add("hidden");
    listaPacientesSection.classList.add("hidden");
    fichaPacienteSection.classList.remove("hidden");

    const idade = calcularIdade(paciente.dataNascimento);
    const ehMenor = idade !== null && idade < 18;

    document.getElementById("ficha-nome").textContent = paciente.nome;
    document.getElementById("ficha-idade-nasc").textContent = `Nascimento: ${formatarDataBR(paciente.dataNascimento)} (${idade !== null ? idade + " anos" : "-"})`;
    document.getElementById("ficha-cpf").textContent = paciente.cpf || "---";
    document.getElementById("ficha-contato").textContent = paciente.contato || "---";
    document.getElementById("ficha-observacoes").value = paciente.observacoes || "";

    // Dados do responsável se menor de idade
    const badgeMenor = document.getElementById("badge-menor");
    const respBox = document.getElementById("ficha-responsavel-box");

    if (ehMenor || paciente.menorIdade === "Sim") {
        badgeMenor.classList.remove("hidden");
        respBox.classList.remove("hidden");
        document.getElementById("ficha-resp-nome").textContent = paciente.respNome || "Não informado";
        document.getElementById("ficha-resp-cpf").textContent = paciente.respCpf || "Não informado";
        document.getElementById("ficha-resp-parentesco").textContent = paciente.respParentesco || "Não informado";
    } else {
        badgeMenor.classList.add("hidden");
        respBox.classList.add("hidden");
    }

    renderizarVacinasDoPaciente(paciente.id);
}

function renderizarVacinasDoPaciente(pacienteId) {
    const vacinasPaciente = vacinas
        .filter((v) => v.pacienteId === pacienteId)
        .sort((a, b) => new Date(normalizarDataISO(b.dataAplicacao)) - new Date(normalizarDataISO(a.dataAplicacao)));

    const badgeTotal = document.getElementById("total-vacinas-badge");
    const vazioEl = document.getElementById("vacinas-vazio");
    const wrapperEl = document.getElementById("vacinas-table-wrapper");
    const tbody = document.getElementById("vacinas-tbody");

    badgeTotal.textContent =
        vacinasPaciente.length === 1 ? "1 aplicação" : `${vacinasPaciente.length} aplicações`;

    tbody.innerHTML = "";

    if (vacinasPaciente.length === 0) {
        vazioEl.classList.remove("hidden");
        wrapperEl.classList.add("hidden");
        return;
    }

    vazioEl.classList.add("hidden");
    wrapperEl.classList.remove("hidden");

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);

    vacinasPaciente.forEach((v) => {
        const tr = document.createElement("tr");

        let proxDoseHtml = "Dose única / Concluída";
        let temPendencia = false;

        const rawProx = String(v.proximaDose || "").trim();
        const foiConcluidaManual = rawProx.startsWith("CONCLUIDA:");
        const proxISO = normalizarDataISO(rawProx.replace("CONCLUIDA:", ""));

        if (proxISO) {
            const concluida = foiConcluidaManual || verificarDoseConcluida(v, vacinasPaciente);

            if (concluida) {
                proxDoseHtml = `<span class="badge badge-success" title="Agendamento de ${formatarDataBR(proxISO)} concluído">✓ Aplicada (${formatarDataBR(proxISO)})</span>`;
            } else {
                temPendencia = true;
                const dataProx = new Date(proxISO + "T00:00:00");
                const atrasada = dataProx < hoje;
                proxDoseHtml = `<span class="badge ${atrasada ? "badge-warning" : "badge-blue"}">${formatarDataBR(proxISO)}</span>`;
            }
        }

        tr.innerHTML = `
      <td><strong>${formatarDataBR(v.dataAplicacao)}</strong></td>
      <td><strong>${v.nomeVacina}</strong></td>
      <td>${v.marca}<br><small style="color: var(--text-muted)">${v.fabricante}</small></td>
      <td>Lote: <strong>${v.lote}</strong><br><small style="color: var(--text-muted)">Val: ${formatarDataBR(v.dataValidade)}</small></td>
      <td>${v.localAplicacao}</td>
      <td>${proxDoseHtml}</td>
      <td>
        <div class="action-buttons-cell">
          <button type="button" class="btn-edit-row">✏️ Editar</button>
          ${temPendencia ? '<button type="button" class="btn-concluir-row" title="Marcar próxima dose como já aplicada">✓ Baixar</button>' : ""}
        </div>
      </td>
    `;

        tr.querySelector(".btn-edit-row").addEventListener("click", () => {
            abrirModalEditarVacina(v);
        });

        const btnConcluir = tr.querySelector(".btn-concluir-row");
        if (btnConcluir) {
            btnConcluir.addEventListener("click", () => concluirProximaDoseManual(v, proxISO));
        }

        tbody.appendChild(tr);
    });
}

async function concluirProximaDoseManual(vacina, proxISO) {
    const payload = {
        action: "editVacina",
        vacinaId: vacina.id,
        pacienteId: vacina.pacienteId,
        dataAplicacao: normalizarDataISO(vacina.dataAplicacao),
        nomeVacina: vacina.nomeVacina,
        marca: vacina.marca,
        fabricante: vacina.fabricante,
        lote: vacina.lote,
        localAplicacao: vacina.localAplicacao,
        dataValidade: normalizarDataISO(vacina.dataValidade),
        proximaDose: `CONCLUIDA:${proxISO}`
    };

    const res = await enviarParaDrive(payload, "Dando baixa no agendamento...");
    if (res && res.status === "success") {
        mostrarToast("Agendamento marcado como concluído!");
        await carregarDadosDoDrive();
    }
}

function abrirModalEditarVacina(vacina) {
    vacinaEmEdicaoId = vacina.id;

    document.getElementById("modal-vacina-titulo").textContent = "Editar Aplicação de Vacina";
    document.getElementById("btn-submit-vacina").textContent = "Salvar Alterações";

    const proxLimpa = String(vacina.proximaDose || "").replace("CONCLUIDA:", "");
    document.getElementById("vac-data").value = normalizarDataISO(vacina.dataAplicacao);
    document.getElementById("vac-nome").value = vacina.nomeVacina || "";
    document.getElementById("vac-marca").value = vacina.marca || "";
    document.getElementById("vac-fabricante").value = vacina.fabricante || "";
    document.getElementById("vac-lote").value = vacina.lote || "";
    document.getElementById("vac-validade").value = normalizarDataISO(vacina.dataValidade);
    document.getElementById("vac-local").value = vacina.localAplicacao || "";
    document.getElementById("vac-proxima").value = normalizarDataISO(proxLimpa);

    document.getElementById("modal-vacina").classList.remove("hidden");
}

// =========================================================================
// EVENTOS E FORMULÁRIOS
// =========================================================================

function configurarEventos() {
    // Navegação do Calendário
    document.getElementById("btn-cal-prev").addEventListener("click", () => {
        calendarioDataAtual.setMonth(calendarioDataAtual.getMonth() - 1);
        renderizarCalendarioAgenda();
    });

    document.getElementById("btn-cal-next").addEventListener("click", () => {
        calendarioDataAtual.setMonth(calendarioDataAtual.getMonth() + 1);
        renderizarCalendarioAgenda();
    });

    document.getElementById("btn-cal-hoje").addEventListener("click", () => {
        calendarioDataAtual = new Date();
        calendarioDataAtual.setDate(1);
        renderizarCalendarioAgenda();
    });

    // Busca em tempo real
    searchInput.addEventListener("input", (e) => {
        const val = e.target.value;
        btnClearSearch.classList.toggle("hidden", val.length === 0);
        renderizarListaPacientes(val);
    });

    btnClearSearch.addEventListener("click", () => {
        searchInput.value = "";
        btnClearSearch.classList.add("hidden");
        renderizarListaPacientes("");
        searchInput.focus();
    });

    // Voltar para lista
    document.getElementById("btn-voltar-lista").addEventListener("click", () => {
        pacienteSelecionado = null;
        fichaPacienteSection.classList.add("hidden");
        document.querySelector(".search-section").classList.remove("hidden");
        listaPacientesSection.classList.remove("hidden");
        document.getElementById("agenda-calendario-section").classList.remove("hidden");
        renderizarListaPacientes(searchInput.value);
        renderizarCalendarioAgenda();
    });

    // Abrir modal Novo Paciente
    document.getElementById("btn-novo-paciente").addEventListener("click", () => {
        pacienteEmEdicaoId = null;
        document.getElementById("modal-paciente-titulo").textContent = "Cadastrar Novo Paciente";
        document.getElementById("btn-submit-paciente").textContent = "Salvar Paciente";

        document.getElementById("form-paciente").reset();
        document.getElementById("secao-responsavel").classList.add("hidden");
        document.getElementById("resp-nome").required = false;
        document.getElementById("resp-cpf").required = false;
        document.getElementById("resp-parentesco").required = false;
        document.getElementById("idade-preview").textContent = "";
        document.getElementById("modal-paciente").classList.remove("hidden");
    });

    // Abrir modal Editar Paciente
    document.getElementById("btn-editar-paciente").addEventListener("click", () => {
        if (!pacienteSelecionado) return;

        pacienteEmEdicaoId = pacienteSelecionado.id;
        document.getElementById("modal-paciente-titulo").textContent = "Editar Dados do Paciente";
        document.getElementById("btn-submit-paciente").textContent = "Salvar Alterações";

        document.getElementById("pac-nome").value = pacienteSelecionado.nome || "";
        const dataNascISO = normalizarDataISO(pacienteSelecionado.dataNascimento);
        document.getElementById("pac-nascimento").value = dataNascISO;
        document.getElementById("pac-cpf").value = pacienteSelecionado.cpf || "";
        document.getElementById("pac-contato").value = pacienteSelecionado.contato || "";

        // Dispara o cálculo de idade para abrir/preencher a caixa de responsável se menor
        document.getElementById("pac-nascimento").dispatchEvent(new Event("change"));

        const idade = calcularIdade(dataNascISO);
        if ((idade !== null && idade < 18) || pacienteSelecionado.menorIdade === "Sim") {
            document.getElementById("secao-responsavel").classList.remove("hidden");
            document.getElementById("resp-nome").value = pacienteSelecionado.respNome || "";
            document.getElementById("resp-cpf").value = pacienteSelecionado.respCpf || "";
            document.getElementById("resp-parentesco").value = pacienteSelecionado.respParentesco || "";
        }

        document.getElementById("modal-paciente").classList.remove("hidden");
    });

    // Excluir Paciente
    document.getElementById("btn-excluir-paciente").addEventListener("click", async () => {
        if (!pacienteSelecionado) return;

        const confirmou = confirm(
            `Tem certeza que deseja excluir o paciente "${pacienteSelecionado.nome}"?\n\nIsso também apagará todo o histórico de vacinas dele e não poderá ser desfeito.`
        );
        if (!confirmou) return;

        const res = await enviarParaDrive(
            {
                action: "deletePaciente",
                pacienteId: pacienteSelecionado.id
            },
            "Excluindo paciente..."
        );

        if (res && res.status === "success") {
            pacienteSelecionado = null;
            fichaPacienteSection.classList.add("hidden");
            document.querySelector(".search-section").classList.remove("hidden");
            listaPacientesSection.classList.remove("hidden");
            const agendaEl = document.getElementById("agenda-calendario-section");
            if (agendaEl) agendaEl.classList.remove("hidden");

            mostrarToast("Paciente excluído com sucesso!");
            await carregarDadosDoDrive();
        }
    });

    // Abrir modal Nova Vacina
    document.getElementById("btn-abrir-modal-vacina").addEventListener("click", () => {
        vacinaEmEdicaoId = null;
        document.getElementById("modal-vacina-titulo").textContent = "Registrar Aplicação de Vacina";
        document.getElementById("btn-submit-vacina").textContent = "Registrar Aplicação";

        document.getElementById("form-vacina").reset();
        document.getElementById("vac-data").value = obterDataHojeLocalISO();
        document.getElementById("modal-vacina").classList.remove("hidden");
    });

    // Fechar modais
    document.querySelectorAll("[data-close]").forEach((btn) => {
        btn.addEventListener("click", () => {
            const modalId = btn.getAttribute("data-close");
            document.getElementById(modalId).classList.add("hidden");
            if (modalId === "modal-vacina") vacinaEmEdicaoId = null;
            if (modalId === "modal-paciente") pacienteEmEdicaoId = null;
        });
    });

    // Verificação automática de menor de idade ao digitar data de nascimento
    document.getElementById("pac-nascimento").addEventListener("change", (e) => {
        const dataNasc = e.target.value;
        const idade = calcularIdade(dataNasc);
        const preview = document.getElementById("idade-preview");
        const secaoResp = document.getElementById("secao-responsavel");
        const respNome = document.getElementById("resp-nome");
        const respCpf = document.getElementById("resp-cpf");
        const respParentesco = document.getElementById("resp-parentesco");

        if (idade === null) {
            preview.textContent = "";
            secaoResp.classList.add("hidden");
            return;
        }

        preview.textContent = `Idade calculada: ${idade} anos`;

        if (idade < 18) {
            secaoResp.classList.remove("hidden");
            respNome.required = true;
            respCpf.required = true;
            respParentesco.required = true;
        } else {
            secaoResp.classList.add("hidden");
            respNome.required = false;
            respCpf.required = false;
            respParentesco.required = false;
        }
    });

    // Submit: Cadastrar Novo Paciente OU Salvar Edição (ÚNICO)
    document.getElementById("form-paciente").addEventListener("submit", async (e) => {
        e.preventDefault();

        const dataNasc = document.getElementById("pac-nascimento").value;
        const idade = calcularIdade(dataNasc);
        const ehMenor = idade !== null && idade < 18;
        const ehEdicao = Boolean(pacienteEmEdicaoId);

        const payload = {
            action: ehEdicao ? "editPaciente" : "addPaciente",
            pacienteId: pacienteEmEdicaoId,
            nome: document.getElementById("pac-nome").value.trim(),
            dataNascimento: dataNasc,
            cpf: document.getElementById("pac-cpf").value.trim(),
            contato: document.getElementById("pac-contato").value.trim(),
            menorIdade: ehMenor,
            respNome: ehMenor ? document.getElementById("resp-nome").value.trim() : "",
            respCpf: ehMenor ? document.getElementById("resp-cpf").value.trim() : "",
            respParentesco: ehMenor ? document.getElementById("resp-parentesco").value : "",
            observacoes: ehEdicao && pacienteSelecionado ? (pacienteSelecionado.observacoes || "") : ""
        };

        const msgLoader = ehEdicao
            ? "Atualizando dados do paciente..."
            : "Salvando cadastro do paciente...";

        const res = await enviarParaDrive(payload, msgLoader);
        if (res && res.status === "success") {
            pacienteEmEdicaoId = null;
            document.getElementById("modal-paciente").classList.add("hidden");
            mostrarToast(ehEdicao ? "Dados do paciente atualizados!" : "Paciente cadastrado com sucesso!");
            await carregarDadosDoDrive();
        }
    });

    // Submit: Registrar Nova Vacina OU Salvar Edição
    document.getElementById("form-vacina").addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!pacienteSelecionado) return;

        const ehEdicao = Boolean(vacinaEmEdicaoId);

        const payload = {
            action: ehEdicao ? "editVacina" : "addVacina",
            vacinaId: vacinaEmEdicaoId,
            pacienteId: pacienteSelecionado.id,
            dataAplicacao: document.getElementById("vac-data").value,
            nomeVacina: document.getElementById("vac-nome").value.trim(),
            marca: document.getElementById("vac-marca").value.trim(),
            fabricante: document.getElementById("vac-fabricante").value.trim(),
            lote: document.getElementById("vac-lote").value.trim(),
            localAplicacao: document.getElementById("vac-local").value,
            dataValidade: document.getElementById("vac-validade").value,
            proximaDose: document.getElementById("vac-proxima").value
        };

        const mensagemLoader = ehEdicao
            ? "Atualizando dados da vacina..."
            : "Registrando aplicação no cartão...";

        const res = await enviarParaDrive(payload, mensagemLoader);
        if (res && res.status === "success") {
            vacinaEmEdicaoId = null;
            document.getElementById("modal-vacina").classList.add("hidden");
            mostrarToast(ehEdicao ? "Vacina atualizada com sucesso!" : "Aplicação de vacina registrada!");
            await carregarDadosDoDrive();
        }
    });

    // Salvar Observações Clínicas
    document.getElementById("btn-salvar-observacoes").addEventListener("click", async () => {
        if (!pacienteSelecionado) return;

        const obs = document.getElementById("ficha-observacoes").value.trim();
        const res = await enviarParaDrive(
            {
                action: "updateObservacoes",
                pacienteId: pacienteSelecionado.id,
                observacoes: obs
            },
            "Salvando observações..."
        );

        if (res && res.status === "success") {
            pacienteSelecionado.observacoes = obs;
            mostrarToast("Observações atualizadas com sucesso!");
        }
    });
}

// =========================================================================
// UTILITÁRIOS E MÁSCARAS
// =========================================================================

// Garante extração limpa de "AAAA-MM-DD" mesmo se o Google Sheets retornar ISO completo
function normalizarDataISO(valor) {
    if (!valor) return "";
    const texto = String(valor).trim();
    const match = texto.match(/^(\d{4}-\d{2}-\d{2})/);
    if (match) return match[1];
    return texto;
}

// Retorna a data de hoje no fuso horário local (evita pular para amanhã após as 21h)
function obterDataHojeLocalISO() {
    const hoje = new Date();
    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");
    return `${ano}-${mes}-${dia}`;
}

function calcularIdade(dataValor) {
    const dataISO = normalizarDataISO(dataValor);
    if (!dataISO) return null;

    const hoje = new Date();
    const nasc = new Date(dataISO + "T00:00:00");
    if (isNaN(nasc.getTime())) return null;

    let idade = hoje.getFullYear() - nasc.getFullYear();
    const mes = hoje.getMonth() - nasc.getMonth();
    if (mes < 0 || (mes === 0 && hoje.getDate() < nasc.getDate())) {
        idade--;
    }
    return idade;
}

function formatarDataBR(dataValor) {
    const dataISO = normalizarDataISO(dataValor);
    if (!dataISO) return "---";
    const partes = dataISO.split("-");
    if (partes.length !== 3) return dataISO;
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function configurarMascaras() {
    const aplicarMascaraCPF = (input) => {
        input.addEventListener("input", (e) => {
            let v = e.target.value.replace(/\D/g, "").slice(0, 11);
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d)/, "$1.$2");
            v = v.replace(/(\d{3})(\d{1,2})$/, "$1-$2");
            e.target.value = v;
        });
    };

    aplicarMascaraCPF(document.getElementById("pac-cpf"));
    aplicarMascaraCPF(document.getElementById("resp-cpf"));

    const telInput = document.getElementById("pac-contato");
    telInput.addEventListener("input", (e) => {
        let v = e.target.value.replace(/\D/g, "").slice(0, 11);
        if (v.length > 2) v = v.replace(/^(\d{2})(\d)/g, "($1) $2");
        if (v.length > 7) v = v.replace(/(\d{5})(\d)/, "$1-$2");
        e.target.value = v;
    });
}

function mostrarLoader(texto) {
    loaderText.textContent = texto;
    loader.classList.remove("hidden");
}

function esconderLoader() {
    loader.classList.add("hidden");
}

function mostrarToast(mensagem) {
    toast.textContent = mensagem;
    toast.classList.remove("hidden");
    setTimeout(() => {
        toast.classList.add("hidden");
    }, 3500);
}

// =========================================================================
// CALENDÁRIO / AGENDA DE PRÓXIMAS DOSES
// =========================================================================

function renderizarCalendarioAgenda() {
    const grid = document.getElementById("calendar-grid");
    const labelMesAno = document.getElementById("cal-mes-ano");
    if (!grid || !labelMesAno) return;

    const ano = calendarioDataAtual.getFullYear();
    const mes = calendarioDataAtual.getMonth();

    const nomeMes = calendarioDataAtual.toLocaleDateString("pt-BR", {
        month: "long",
        year: "numeric"
    });
    labelMesAno.textContent = nomeMes;

    // Mapeia apenas os agendamentos PENDENTES por data ISO (AAAA-MM-DD)
    const agendamentosPorDia = {};
    vacinas.forEach((v) => {
        const rawProx = String(v.proximaDose || "").trim();
        if (!rawProx || rawProx.startsWith("CONCLUIDA:")) return;

        const proxISO = normalizarDataISO(rawProx);
        if (!proxISO) return;

        const vacinasDoPaciente = vacinas.filter((item) => item.pacienteId === v.pacienteId);
        if (verificarDoseConcluida(v, vacinasDoPaciente)) return;

        const paciente = pacientes.find((p) => p.id === v.pacienteId);
        if (!paciente) return;

        if (!agendamentosPorDia[proxISO]) {
            agendamentosPorDia[proxISO] = [];
        }
        agendamentosPorDia[proxISO].push({
            paciente,
            vacina: v
        });
    });

    const primeiroDiaSemana = new Date(ano, mes, 1).getDay();
    const totalDiasMes = new Date(ano, mes + 1, 0).getDate();
    const hojeISO = obterDataHojeLocalISO();

    grid.innerHTML = "";

    // Células vazias antes do dia 1
    for (let i = 0; i < primeiroDiaSemana; i++) {
        const emptyCell = document.createElement("div");
        emptyCell.className = "calendar-day empty";
        grid.appendChild(emptyCell);
    }

    // Dias do mês
    for (let dia = 1; dia <= totalDiasMes; dia++) {
        const mesStr = String(mes + 1).padStart(2, "0");
        const diaStr = String(dia).padStart(2, "0");
        const dataAtualISO = `${ano}-${mesStr}-${diaStr}`;

        const dayCell = document.createElement("div");
        dayCell.className = "calendar-day";
        if (dataAtualISO === hojeISO) {
            dayCell.classList.add("today");
        }

        const dayNumber = document.createElement("div");
        dayNumber.className = "calendar-day-number";
        dayNumber.textContent = dia;
        dayCell.appendChild(dayNumber);

        const eventsContainer = document.createElement("div");
        eventsContainer.className = "calendar-events";

        const eventosDoDia = agendamentosPorDia[dataAtualISO] || [];
        eventosDoDia.forEach(({ paciente, vacina }) => {
            const btnEvento = document.createElement("button");
            btnEvento.type = "button";
            btnEvento.className = "cal-event-pill";
            if (dataAtualISO < hojeISO) {
                btnEvento.classList.add("atrasada");
            }

            const primeiroSegundoNome = (paciente.nome || "").split(" ").slice(0, 2).join(" ");
            btnEvento.title = `${paciente.nome} - ${vacina.nomeVacina} (${paciente.contato || "Sem telefone"})`;

            const strongNome = document.createElement("strong");
            strongNome.textContent = primeiroSegundoNome;

            const spanVacina = document.createElement("span");
            spanVacina.textContent = vacina.nomeVacina;

            btnEvento.appendChild(strongNome);
            btnEvento.appendChild(spanVacina);

            btnEvento.addEventListener("click", () => {
                abrirFichaPaciente(paciente);
            });

            eventsContainer.appendChild(btnEvento);
        });

        dayCell.appendChild(eventsContainer);
        grid.appendChild(dayCell);
    }
}

// Verifica se o agendamento de proximaDose já foi cumprido por uma aplicação posterior
function verificarDoseConcluida(vacinaRegistro, todasVacinasDoPaciente) {
    const proxISO = normalizarDataISO(vacinaRegistro.proximaDose);
    if (!proxISO) return true;

    // Marcação manual caso tenha tomado fora da clínica
    if (String(vacinaRegistro.proximaDose).startsWith("CONCLUIDA:")) {
        return true;
    }

    const nomeAtual = (vacinaRegistro.nomeVacina || "").trim().toLowerCase();
    const dataAplicacaoAtual = normalizarDataISO(vacinaRegistro.dataAplicacao);

    return todasVacinasDoPaciente.some((outra) => {
        if (outra.id === vacinaRegistro.id) return false;
        const nomeOutra = (outra.nomeVacina || "").trim().toLowerCase();
        const dataOutra = normalizarDataISO(outra.dataAplicacao);

        // Mesma vacina aplicada depois da dose anterior (ou a partir da data agendada)
        return (
            nomeOutra === nomeAtual &&
            dataOutra > dataAplicacaoAtual
        );
    });
}