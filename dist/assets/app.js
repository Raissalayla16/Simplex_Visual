(function () {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const exemplos = {
    "duas-fases": "2\n3\n1 1\n3 2\n1 1 <= 4\n2 1 <= 6\n1 1 >= 1",
    unico: "2\n2\n1 1\n3 2\n1 1 <= 4\n2 1 <= 6",
    inviavel: "2\n2\n1 1\n1 1\n1 1 <= 1\n1 1 >= 3",
    ilimitado: "2\n2\n1 0\n1 1\n1 -1 <= 2\n1 1 >= 1",
    multiplos: "2\n1\n1 1\n1 1\n1 1 <= 4",
    sinais: "2\n3\n-1 0\n-1 1\n1 0 >= -3\n0 1 <= 2\n1 1 == -1",
  };
  const fases = [
    ["fpi", "Forma padrão"],
    ["fase1", "Fase I"],
    ["fase2", "Fase II"],
    ["resultado", "Resultado"],
  ];
  const politicas = {
    largest: "Escolhe o maior custo reduzido positivo. Em caso de empate, vence o menor índice.",
    bland: "Escolhe a primeira coluna elegível pela ordem dos índices. Essa regra evita ciclos em aritmética exata.",
    smallest: "Escolhe o menor custo reduzido que ainda é positivo. Em caso de empate, vence o menor índice.",
  };
  const digitos = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 6, useGrouping: false });
  const mathml = "http://www.w3.org/1998/Math/MathML";
  let editor = null;
  let modoEntrada = "grade";
  let rascunhoAlterado = null;
  let execucao = null;
  let graficoVisivel = false;

  function el(tag, classe, texto) {
    const elemento = document.createElement(tag);
    if (classe) elemento.className = classe;
    if (texto !== undefined) elemento.textContent = texto;
    return elemento;
  }

  function formatar(valor) {
    if (valor === null) return "—";
    if (valor === 0) return "0";
    return valor !== 0 && Math.abs(valor) < 1e-6 ? valor.toExponential(3).replace(".", ",") : digitos.format(valor);
  }

  function selectComOpcoes(opcoes, valor, rotulo) {
    const select = el("select");
    select.setAttribute("aria-label", rotulo);
    opcoes.forEach(([v, nome]) => {
      const option = el("option", null, nome);
      option.value = v;
      select.append(option);
    });
    select.value = valor;
    return select;
  }

  function campo(valor, rotulo) {
    const input = el("input");
    input.type = "text";
    input.inputMode = "decimal";
    input.value = valor;
    input.autocomplete = "off";
    input.setAttribute("aria-label", rotulo);
    return input;
  }

  function matrizEdicao(rotulos, linhas, classe) {
    const tabela = el("table", `input-table ${classe}`);
    const topo = tabela.createTHead().insertRow();
    rotulos.forEach((rotulo) => {
      const th = el("th", null, rotulo);
      th.scope = "col";
      topo.append(th);
    });
    const corpo = tabela.createTBody();
    linhas.forEach(([rotulo, ...campos]) => {
      const linha = corpo.insertRow();
      const th = el("th", null, rotulo);
      th.scope = "row";
      linha.append(th);
      campos.forEach((entrada) => linha.insertCell().append(entrada));
    });
    return tabela;
  }

  function mostrarEditor(pl) {
    $("num-variables").value = pl.n;
    $("num-constraints").value = pl.m;
    const nomes = pl.c.map((_, j) => "x" + j);
    const custos = pl.c.map((x, j) => campo(x, `Coeficiente de ${nomes[j]} no objetivo`));
    const dominios = pl.sinais.map((x, j) => selectComOpcoes(
      [[1, "≥ 0"], [-1, "≤ 0"], [0, "Livre"]], x, `Domínio de ${nomes[j]}`));
    const restricoes = pl.restricoes.map((r, i) => {
      const rotulo = Simplex.rotuloRestricao(i);
      return {
        a: r.a.map((x, j) => campo(x, `Coeficiente de ${nomes[j]} na ${rotulo}`)),
        op: selectComOpcoes([["<=", "≤"], [">=", "≥"], ["==", "="]], r.op, `Sinal da ${rotulo}`),
        b: campo(r.b, `Lado direito b da ${rotulo}`),
      };
    });
    editor = { custos, dominios, restricoes };
    $("objective").replaceChildren(matrizEdicao(["", ...nomes], [["c", ...custos], ["Domínio", ...dominios]], "objective-inputs"));
    $("constraints").replaceChildren(pl.m === 0
      ? el("p", "empty-note", "Sem restrições além dos domínios.")
      : matrizEdicao(["", ...nomes, "Sinal", "b"],
        restricoes.map((r, i) => [`${i + 1}ª`, ...r.a, r.op, r.b]), "constraint-inputs"));
  }

  function preencherEntradas(pl, texto = Simplex.escreverPL(pl)) {
    mostrarEditor(pl);
    $("pl-text").value = texto;
    rascunhoAlterado = null;
    atualizarOriginal();
  }

  function dadosEditados() {
    return {
      n: editor.custos.length,
      m: editor.restricoes.length,
      sinais: editor.dominios.map((c) => c.value),
      c: editor.custos.map((c) => c.value),
      restricoes: editor.restricoes.map((r) => ({ a: r.a.map((c) => c.value), op: r.op.value, b: r.b.value })),
    };
  }

  function lerFormulario() {
    const n = Number($("num-variables").value);
    const m = Number($("num-constraints").value);
    if ($("num-constraints").value === "" || !Number.isSafeInteger(n) || !Number.isSafeInteger(m) || n < 1 || m < 0) {
      throw new Error("Use pelo menos uma variável e um número inteiro de restrições a partir de zero.");
    }
    if (n !== editor.custos.length || m !== editor.restricoes.length) {
      throw new Error("Confirme o tamanho do problema saindo dos campos de quantidade.");
    }
    const numeros = [...editor.custos, ...editor.restricoes.flatMap((r) => [...r.a, r.b])];
    if (numeros.some((input) => !input.value.trim() || /\s/.test(input.value.trim()))) {
      throw new Error("Preencha todos os coeficientes e lados direitos com um número por campo.");
    }
    return Simplex.lerPL(Simplex.escreverPL(dadosEditados()));
  }

  function lerEntrada() {
    return modoEntrada === "texto" ? Simplex.lerPL($("pl-text").value) : lerFormulario();
  }

  function trocarModo(modo) {
    if (modo === modoEntrada) return;
    if (rascunhoAlterado === modoEntrada) {
      try {
        const pl = lerEntrada();
        if (modo === "grade") mostrarEditor(pl);
        else $("pl-text").value = Simplex.escreverPL(pl);
        rascunhoAlterado = null;
      } catch {
        // O rascunho continua disponível no modo em que foi escrito.
      }
    }
    modoEntrada = modo;
    const emTexto = modo === "texto";
    $("grid-input").hidden = emTexto;
    $("text-input").hidden = !emTexto;
    $("grid-mode").setAttribute("aria-pressed", String(!emTexto));
    $("text-mode").setAttribute("aria-pressed", String(emTexto));
    informar("input-feedback", "");
    atualizarOriginal();
  }

  function linhasModelo(modelo) {
    const linhas = [el("p", null, modelo.objetivo)];
    if (modelo.restricoes.length) {
      const sistema = el("div", "sistema");
      const equacoes = el("div", "equacoes");
      equacoes.append(...modelo.restricoes.map((r) => el("p", null, r)));
      sistema.append(el("span", null, "sujeito a"), equacoes);
      linhas.push(sistema);
    }
    linhas.push(el("p", "domains", modelo.dominios.join("  ·  ")));
    return linhas;
  }

  function atualizarOriginal() {
    const bloco = $("original-content");
    try {
      const modelo = Simplex.descreverPL(lerEntrada());
      bloco.replaceChildren(...linhasModelo(modelo));
    } catch {
      bloco.replaceChildren(el("p", "empty-note", "Preencha uma PL válida para ver a notação."));
    }
  }

  function informar(campoId, texto) {
    const campoMensagem = $(campoId);
    campoMensagem.textContent = texto;
    campoMensagem.hidden = !texto;
  }

  function sinalizarEdicao() {
    if (execucao) $("stale").hidden = false;
  }

  function editarEntrada(modo) {
    rascunhoAlterado = modo;
    $("examples").value = "personalizado";
    informar("input-feedback", "");
    atualizarOriginal();
    sinalizarEdicao();
  }

  function redimensionar() {
    const antes = dadosEditados();
    const n = Number($("num-variables").value);
    const m = Number($("num-constraints").value);
    if ($("num-constraints").value === "" || !Number.isSafeInteger(n) || !Number.isSafeInteger(m) || n < 1 || m < 0) {
      informar("input-feedback", "Use pelo menos uma variável e um número inteiro de restrições a partir de zero.");
      return;
    }
    const completar = (valores, padrao) => Array.from({ length: n }, (_, j) => valores[j] ?? padrao);
    mostrarEditor({
      n, m,
      sinais: completar(antes.sinais, 1),
      c: completar(antes.c, 0),
      restricoes: Array.from({ length: m }, (_, i) => {
        const r = antes.restricoes[i];
        return { a: completar(r?.a ?? [], 0), op: r?.op ?? "<=", b: r?.b ?? 0 };
      }),
    });
    editarEntrada("grade");
  }

  function legenda(itens) {
    const div = el("div", "table-caption");
    itens.forEach(([classe, rotulo]) => {
      const item = el("span", "key");
      item.append(el("i", classe), document.createTextNode(rotulo));
      div.append(item);
    });
    return div;
  }

  function noMatematico(tag, texto) {
    const no = document.createElementNS(mathml, tag);
    if (texto !== undefined) no.textContent = texto;
    return no;
  }

  function matriz(linhas) {
    const grupo = noMatematico("mrow");
    const tabela = noMatematico("mtable");
    linhas.forEach((valores) => {
      const linha = noMatematico("mtr");
      valores.forEach((valor) => {
        const item = noMatematico("mtd");
        item.append(noMatematico("mn", formatar(valor)));
        linha.append(item);
      });
      tabela.append(linha);
    });
    grupo.append(noMatematico("mo", "("), tabela, noMatematico("mo", ")"));
    return grupo;
  }

  function mostrarFormaMatricial(tabela) {
    const details = el("details", "fpi-matrix original");
    details.append(el("summary", null, "Ver forma matricial"));
    const [c, ...restricoes] = tabela.linhas;
    const objetivo = noMatematico("math");
    objetivo.append(noMatematico("mtext", "max "), matriz([c.slice(0, -1)]), noMatematico("mi", "x"));
    const linhaObjetivo = el("p", "math-formula");
    linhaObjetivo.append(objetivo);
    details.append(linhaObjetivo);
    if (restricoes.length) {
      const sistema = noMatematico("math");
      sistema.append(noMatematico("mtext", "sujeito a "),
        matriz(restricoes.map((r) => r.slice(0, -1))), noMatematico("mi", "x"),
        noMatematico("mo", "="), matriz(restricoes.map((r) => [r.at(-1)])));
      const linha = el("p", "math-formula");
      linha.append(sistema);
      details.append(linha);
    }
    details.append(el("p", "formula-lines", `x = (${tabela.colunas.join(", ")})ᵀ, x ≥ 0`));
    return details;
  }

  function mostrarTabela(passo) {
    const { colunas, linhas, rotulos } = passo.tabela;
    const pivo = passo.pivo;
    const frame = el("div", "table-frame scroll");
    frame.tabIndex = 0;
    frame.setAttribute("aria-label", "Tabela com rolagem horizontal");
    const tabela = el("table", "tableau");
    tabela.setAttribute("aria-label", "Tableau do Simplex");
    const topo = tabela.createTHead().insertRow();
    ["Base", ...colunas, "b"].forEach((texto, j) => {
      const classe = j === colunas.length + 1 ? "rhs" : pivo?.coluna === j - 1 ? "column-active" : "";
      const th = el("th", classe, texto);
      th.scope = "col";
      topo.append(th);
    });
    const corpo = tabela.createTBody();
    linhas.forEach((valores, i) => {
      const linha = corpo.insertRow();
      const linhaAtiva = pivo?.linha === i || passo.linhaDestaque === i;
      if (i === 0) linha.classList.add("objective-row");
      const th = el("th", linhaAtiva ? "row-active" : null, rotulos[i]);
      th.scope = "row";
      if (i > 0) th.title = "Linha L" + i;
      linha.append(th);
      valores.forEach((valor, j) => {
        const td = linha.insertCell();
        td.textContent = formatar(valor);
        if (valor !== null) td.title = String(valor);
        if (j === colunas.length) td.classList.add("rhs");
        if (i === 0 && passo.elegiveis?.includes(j)) td.classList.add("eligible");
        if (linhaAtiva) td.classList.add("row-active");
        if (pivo?.coluna === j) {
          td.classList.add("column-active");
          if (linhaAtiva) {
            td.dataset.pivot = "";
            td.setAttribute("aria-label", "Pivô " + formatar(valor));
          }
        }
      });
    });
    frame.append(tabela);
    return frame;
  }

  function metricas(pivo) {
    const div = el("div", "stats");
    const itens = [["Entra na base", pivo.entra], ["Sai da base", pivo.sai ?? "—"], ["Pivô", formatar(pivo.valor)]];
    itens.forEach(([rotulo, valor]) => {
      const bloco = el("div", "metric");
      bloco.append(el("span", null, rotulo), el("strong", null, valor));
      div.append(bloco);
    });
    return div;
  }

  function mostrarRazoes(pivo) {
    const bloco = el("div", "ratios");
    bloco.append(el("h4", null, "Teste da razão"));
    const frame = el("div", "scroll");
    const tabela = el("table", "ratio-table");
    const topo = tabela.createTHead().insertRow();
    ["Variável básica", "b", `Coef. de ${pivo.entra}`, "Razão b / coef."].forEach((titulo) => {
      const th = el("th", null, titulo);
      th.scope = "col";
      topo.append(th);
    });
    const corpo = tabela.createTBody();
    pivo.razoes.forEach((r) => {
      const linha = corpo.insertRow();
      if (r.linha === pivo.linha) linha.className = "winner";
      [`L${r.linha} · ${r.nome}`, formatar(r.b), formatar(r.coeficiente),
        r.razao === null ? "Coef. ≤ 0" : formatar(r.razao)]
        .forEach((texto) => { linha.insertCell().textContent = texto; });
    });
    frame.append(tabela);
    bloco.append(frame);
    if (pivo.passo === 0) bloco.append(el("p", "field-help", "A menor razão é zero. A base muda e o ponto mantém os mesmos valores."));
    return bloco;
  }

  function operacoes(pivo) {
    const details = el("details", "operations");
    details.append(el("summary", null, "Ver contas do pivoteamento"));
    const lista = el("ul", "mono");
    lista.append(el("li", null, `L${pivo.linha} ← L${pivo.linha} / ${formatar(pivo.valor)}`));
    pivo.operacoes.forEach(({ linha, fator }) => lista.append(el("li", null,
      `L${linha} ← L${linha} − (${formatar(fator)}) × L${pivo.linha}`)));
    details.append(lista);
    return details;
  }

  function vetor(destino, titulo, valores, nome) {
    const bloco = el("div", "result-block");
    const linha = el("div", "values");
    valores.forEach((v, j) => linha.append(el("span", "value-tag mono", `${nome}${j} = ${formatar(v)}`)));
    bloco.append(el("h4", null, titulo), valores.length ? linha : el("p", "field-help", "Sem restrições explícitas."));
    destino.append(bloco);
  }

  function mostrarResultado(passo) {
    const r = passo.resultado;
    const div = el("div", "result");
    const status = el("div", `status-card ${r.status}`);
    const rotulo = { inviavel: "Inviável", ilimitado: "Ilimitado", otimo: "Ótimo único", "otimo (multiplos)": "Múltiplos ótimos" }[r.status];
    status.append(el("p", null, rotulo));
    if (r.solucoes) status.append(el("p", "big", "z = " + formatar(r.z)));
    if (r.status === "inviavel") status.append(el("p", "big", "z auxiliar = " + formatar(r.zAux)));
    if (r.status === "ilimitado") status.append(el("p", "big", "z pode crescer indefinidamente"));
    div.append(status);
    if (r.solucoes) {
      r.solucoes.forEach((x, i) => vetor(div, r.solucoes.length === 1 ? "Solução primal (x)" : `Solução primal ${i + 1}`, x, "x"));
      if (r.solucoes.length === 2) {
        div.append(el("p", "check-result", "Todo ponto do segmento λ·x¹ + (1 − λ)·x², com 0 ≤ λ ≤ 1, também é solução ótima com o mesmo z."));
      }
      vetor(div, "Solução dual (w) · certificado de otimalidade (uma por restrição)", r.dual, "w");
      const bTw = r.dual.reduce((soma, w, i) => soma + w * execucao.pl.restricoes[i].b, 0);
      div.append(el("p", "check-result", `Teorema Forte da Dualidade · cᵀx = ${formatar(r.z)} e bᵀw = ${formatar(bTw)}.`));

      // Mostra a PL Dual explícita e as folgas complementares para estudo
      const dualBox = el("details", "operations");
      dualBox.append(el("summary", null, "Ver PL Dual e folgas complementares"));
      const dualModelo = el("div", "formula-lines");
      dualModelo.append(...linhasModelo(Simplex.descreverDual(execucao.pl)));
      dualBox.append(dualModelo);
      const xOtimo = r.solucoes[0];
      const lista = el("ul", "mono");
      execucao.pl.restricoes.forEach((rest, i) => {
        const ax = rest.a.reduce((s, a, j) => s + a * xOtimo[j], 0);
        const folga = Math.abs(rest.b - ax);
        const estado = folga < 1e-7 ? "ativa (folga = 0)" : `folgada (folga = ${formatar(folga)})`;
        lista.append(el("li", null, `R${i + 1}: ${estado} · w${i} = ${formatar(r.dual[i])}`));
      });
      dualBox.append(el("p", "field-help", "Pelas folgas complementares, se uma restrição primal tem folga > 0, sua variável dual wᵢ é obrigatoriamente 0."), lista);
      div.append(dualBox);
    }
    if (r.status === "inviavel" && r.certificado) {
      vetor(div, "Certificado de inviabilidade (y) · combinação das restrições", r.certificado, "y");
      const yTb = r.certificado.reduce((s, y, i) => s + y * execucao.pl.restricoes[i].b, 0);
      div.append(el("p", "check-result", `Combinando as restrições com pesos y obtemos yᵀA ≥ 0 (para x ≥ 0) e yᵀb = ${formatar(yTb)} < 0, provando que não existe solução viável.`));
    }
    if (r.direcao) {
      vetor(div, "Ponto viável de partida (x)", r.ponto, "x");
      const cTd = execucao.pl.c.reduce((s, c, j) => s + c * r.direcao[j], 0);
      div.append(el("p", "check-result", `Certificado de ilimitada · direção d = (${r.direcao.map(formatar).join("; ")}), com cᵀd = ${formatar(cTd)} > 0. Para todo t ≥ 0, x + t·d continua viável e z cresce indefinidamente.`));
    }
    return div;
  }

  function resumoTableau(passo) {
    const { colunas, linhas, rotulos } = passo.tabela;
    const basicas = [];
    const conjuntoBase = new Set();
    for (let i = 1; i < linhas.length; i++) {
      const nome = rotulos[i];
      conjuntoBase.add(nome);
      basicas.push(`${nome} = ${formatar(linhas[i].at(-1))}`);
    }
    const naoBasicas = colunas.filter((c) => !conjuntoBase.has(c));
    const zVal = linhas[0].at(-1);
    const rotuloZ = passo.fase === "fase1" ? "z auxiliar" : "z";
    const caixa = el("div", "tableau-summary");
    caixa.append(
      el("p", null, `Solução básica atual: ${basicas.length ? basicas.join(", ") : "base vazia"}${naoBasicas.length ? `  ·  fora da base (= 0): ${naoBasicas.join(", ")}` : ""}  ·  ${rotuloZ} = ${formatar(zVal)}`),
      el("p", "field-help", "Como ler L0: a linha L0 guarda os custos reduzidos com sinal invertido (−c̄). Valores negativos em L0 indicam variáveis que aumentam o objetivo se entrarem na base."),
    );
    return caixa;
  }

  function mostrarPasso(passo) {
    const bloco = $("step-content");
    const cabecalho = el("div", "step-head");
    cabecalho.append(el("h3", null, passo.titulo), el("p", "step-text", passo.texto));
    bloco.replaceChildren(cabecalho);
    if (passo.formula) bloco.append(el("p", "formula", passo.formula));
    if (passo.pivo) bloco.append(metricas(passo.pivo));
    if (passo.modelo) {
      const modelo = el("div", "formula formula-lines");
      modelo.append(...linhasModelo(passo.modelo));
      bloco.append(modelo, mostrarFormaMatricial(passo.tabela));
    } else if (passo.tabela) {
      bloco.append(mostrarTabela(passo));
      if (!passo.resultado) bloco.append(resumoTableau(passo));
    }
    if (passo.pivo) {
      const itens = [["key-col", "Coluna de entrada"]];
      if (passo.pivo.linha !== null) itens.push(["key-row", "Linha de saída"], ["key-pivot", "Pivô"]);
      bloco.append(legenda(itens));
      if (passo.regra) bloco.append(el("p", "step-rule", passo.regra));
      if (passo.pivo.razoes.length) bloco.append(mostrarRazoes(passo.pivo));
      if (passo.pivo.linha !== null) bloco.append(operacoes(passo.pivo));
    }
    if (passo.notas?.length) {
      const notas = el("ul", "fpi-notes");
      passo.notas.forEach(({ rotulo, texto }) => {
        const li = el("li");
        li.append(el("span", "note-label", rotulo), el("span", null, texto));
        notas.append(li);
      });
      bloco.append(notas);
    }
    if (passo.custosZero?.length) bloco.append(el("p", "formula",
      "Não básicas com custo reduzido zero · " + passo.custosZero.join(", ")));
    if (passo.resultado) bloco.append(mostrarResultado(passo));
  }

  function mostrarGrafico() {
    if (!graficoVisivel || !execucao || execucao.pl.n !== 2) return;
    const passo = execucao.historico[execucao.indice];
    const pontos = passo.resultado?.solucoes ?? (passo.ponto ? [passo.ponto] : []);
    // Coleta os vértices visitados na Fase II até a etapa atual para desenhar o caminho do Simplex.
    const caminho = [];
    for (let i = 0; i <= execucao.indice; i++) {
      const p = execucao.historico[i].ponto;
      if (!p) continue;
      const anterior = caminho.at(-1);
      if (!anterior || Math.hypot(p[0] - anterior[0], p[1] - anterior[1]) > 1e-8) caminho.push(p);
    }
    const multiplos = passo.resultado?.status === "otimo (multiplos)";
    const direcao = passo.resultado?.direcao ?? null;
    const haRegiao = GraficoPL.desenhar($("graph"), execucao.pl, pontos, { caminho, direcao, multiplos });
    const descreverPonto = (p) => "(x0, x1) = (" + p.map(formatar).join("; ") + ")";
    const zPonto = (p) => execucao.pl.c[0] * p[0] + execucao.pl.c[1] * p[1];
    let texto = "O gráfico mostra o poliedro (região viável) e as retas das restrições da PL original.";
    if (pontos.length === 1) texto = `Ponto atual · ${descreverPonto(pontos[0])} com z = ${formatar(zPonto(pontos[0]))}.`;
    if (pontos.length === 2) texto = `Múltiplos ótimos · ${pontos.map(descreverPonto).join(" e ")} (todo o segmento entre eles atinge z = ${formatar(zPonto(pontos[0]))}).`;
    if (direcao) texto += " A seta azul mostra a direção ilimitada d.";
    $("graph-description").textContent = haRegiao ? texto : texto + " Sem pontos viáveis neste recorte.";
    $("graph").setAttribute("aria-label", $("graph-description").textContent);
    const modeloOrig = Simplex.descreverPL(execucao.pl);
    const itens = [];
    if (haRegiao) itens.push(["#e4d5f9", "Região viável"]);
    execucao.pl.restricoes.forEach((_, i) => itens.push([
      GraficoPL.cores[i % GraficoPL.cores.length],
      `R${i + 1}: ${modeloOrig.restricoes[i]}`,
    ]));
    if (pontos.length && Math.hypot(execucao.pl.c[0], execucao.pl.c[1]) > 1e-12) {
      itens.push(["#c43f8e", "Curva de nível cᵀx = z e gradiente c"]);
    }
    if (caminho.length >= 2) itens.push(["#5a288e", "Caminho do Simplex"]);
    if (direcao) itens.push(["#1f78b4", "Direção ilimitada (d)"]);
    if (multiplos) itens.push(["#ac407e", "Segmento de soluções ótimas"]);
    pontos.forEach((_, i) => itens.push([i === 0 ? "#5a288e" : "#ac407e", pontos.length === 1 ? "Ponto atual" : `Solução ótima ${i + 1}`]));
    $("graph-legend").replaceChildren(...itens.map(([cor, texto]) => {
      const span = el("span", "key");
      const amostra = el("i");
      amostra.style.backgroundColor = cor;
      span.append(amostra, document.createTextNode(texto));
      return span;
    }));
  }

  function mostrarVista(modoGrafico) {
    graficoVisivel = modoGrafico && execucao.pl.n === 2;
    $("step-panel").hidden = graficoVisivel;
    $("graph-panel").hidden = !graficoVisivel;
    $("step-view-button").setAttribute("aria-pressed", String(!graficoVisivel));
    $("graph-view-button").setAttribute("aria-pressed", String(graficoVisivel));
    mostrarGrafico();
  }

  function mostrarEstado() {
    const { indice, historico, finalizou, calculando } = execucao;
    const passo = historico[indice];
    $("counter").textContent = finalizou ? `Passo ${indice + 1} de ${historico.length}` : `Passo ${indice + 1}`;
    $("previous-button").disabled = indice <= 0 || calculando;
    $("next-button").disabled = calculando || finalizou && indice >= historico.length - 1;
    $("finish-button").disabled = calculando || finalizou && indice >= historico.length - 1;
    $("finish-button").textContent = calculando ? "Resolvendo…" : "Ir ao resultado";
    $("graph-view-button").disabled = execucao.pl.n !== 2;
    $("graph-view-button").title = execucao.pl.n !== 2 ? "Disponível para PLs com duas variáveis" : "";
    $("phases").replaceChildren(...fases.map(([id, rotulo], i) => {
      const primeiro = historico.findIndex((s) => s.fase === id);
      const li = el("li");
      const button = el("button");
      button.type = "button";
      button.disabled = primeiro < 0 || calculando;
      if (passo.fase === id) button.setAttribute("aria-current", "step");
      if (primeiro >= 0 && primeiro < indice) button.classList.add("done");
      const number = el("span", "phase-number", String(i + 1));
      number.setAttribute("aria-hidden", "true");
      button.append(number, document.createTextNode(rotulo));
      button.addEventListener("click", () => irAoPasso(primeiro));
      li.append(button);
      return li;
    }));
    $("history-list").replaceChildren(...historico.map((s, i) => {
      const li = el("li");
      const button = el("button", null, s.titulo);
      button.type = "button";
      button.disabled = calculando;
      if (i === indice) button.setAttribute("aria-current", "step");
      button.addEventListener("click", () => irAoPasso(i));
      li.append(button);
      return li;
    }));
    mostrarPasso(passo);
    mostrarVista(graficoVisivel);
  }

  function irAoPasso(i) {
    if (execucao.calculando || !execucao.historico[i]) return;
    execucao.indice = i;
    mostrarEstado();
  }

  function lerProximo(atual) {
    if (atual.finalizou) return;
    try {
      const item = atual.gerador.next();
      if (!item.done) atual.historico.push(item.value);
      if (item.done || item.value?.resultado) atual.finalizou = true;
    } catch (erro) {
      atual.finalizou = true;
      informar("run-error", erro.message);
    }
  }

  function iniciar(pl, rolar = false) {
    informar("run-error", "");
    execucao = {
      pl, gerador: Simplex.resolver(pl, $("policy").value),
      historico: [], indice: 0, finalizou: false, calculando: false,
    };
    graficoVisivel = false;
    $("stale").hidden = true;
    lerProximo(execucao);
    if (execucao.historico.length === 0) return;
    mostrarEstado();
    if (rolar) {
      $("resolucao").focus({ preventScroll: true });
      $("resolucao").scrollIntoView({ block: "start" });
    }
  }

  async function finalizar() {
    const atual = execucao;
    if (atual.calculando) return;
    atual.calculando = true;
    mostrarEstado();
    while (!atual.finalizou && execucao === atual) {
      await new Promise((continuar) => setTimeout(continuar, 0));
      if (execucao !== atual) return;
      for (let i = 0; i < 25 && !atual.finalizou; i++) lerProximo(atual);
    }
    atual.calculando = false;
    if (execucao !== atual) return;
    graficoVisivel = false;
    irAoPasso(atual.historico.length - 1);
  }

  $("examples").addEventListener("change", () => {
    const exemplo = exemplos[$("examples").value];
    if (exemplo) {
      const pl = Simplex.lerPL(exemplo);
      preencherEntradas(pl);
      informar("input-feedback", "");
      iniciar(pl);
    }
  });
  ["num-variables", "num-constraints"].forEach((id) => $(id).addEventListener("change", () => {
    try { redimensionar(); } catch (erro) { informar("input-feedback", "Não foi possível montar a grade. " + erro.message); }
  }));
  $("grid-mode").addEventListener("click", () => trocarModo("grade"));
  $("text-mode").addEventListener("click", () => trocarModo("texto"));
  $("grid-input").addEventListener("input", () => editarEntrada("grade"));
  $("pl-text").addEventListener("input", () => editarEntrada("texto"));
  $("policy").addEventListener("change", () => {
    informar("policy-note", politicas[$("policy").value]);
    sinalizarEdicao();
  });
  $("problem-form").addEventListener("submit", (evento) => {
    evento.preventDefault();
    try {
      const pl = lerEntrada();
      informar("input-feedback", "");
      iniciar(pl, true);
    } catch (erro) { informar("input-feedback", erro.message); }
  });
  $("import-button").addEventListener("click", () => $("import-file").click());
  $("import-file").addEventListener("change", async () => {
    const arquivo = $("import-file").files[0];
    if (!arquivo) return;
    try {
      const bytes = new Uint8Array(await arquivo.arrayBuffer());
      const codificacao = bytes[0] === 255 && bytes[1] === 254 ? "utf-16le" :
        bytes[0] === 254 && bytes[1] === 255 ? "utf-16be" : "utf-8";
      const texto = new TextDecoder(codificacao).decode(bytes);
      const pl = Simplex.lerPL(texto);
      preencherEntradas(pl, texto);
      $("examples").value = "personalizado";
      informar("input-feedback", "");
      iniciar(pl);
    } catch (erro) { informar("input-feedback", erro.message); }
    $("import-file").value = "";
  });
  $("export-button").addEventListener("click", () => {
    try {
      const dados = Simplex.escreverPL(lerEntrada());
      informar("input-feedback", "");
      const link = el("a");
      link.href = URL.createObjectURL(new Blob([dados], { type: "text/plain;charset=utf-8" }));
      link.download = "minha_pl.txt";
      link.click();
      setTimeout(() => URL.revokeObjectURL(link.href), 3000);
    } catch (erro) { informar("input-feedback", erro.message); }
  });
  $("previous-button").addEventListener("click", () => irAoPasso(execucao.indice - 1));
  $("next-button").addEventListener("click", () => {
    if (execucao.indice === execucao.historico.length - 1) lerProximo(execucao);
    if (execucao.historico[execucao.indice + 1]) irAoPasso(execucao.indice + 1);
    else mostrarEstado();
  });
  $("finish-button").addEventListener("click", finalizar);
  $("step-view-button").addEventListener("click", () => mostrarVista(false));
  $("graph-view-button").addEventListener("click", () => mostrarVista(true));
  new ResizeObserver(mostrarGrafico).observe($("graph"));

  const inicial = Simplex.lerPL(exemplos["duas-fases"]);
  preencherEntradas(inicial);
  informar("policy-note", politicas.largest);
  iniciar(inicial);
})();
