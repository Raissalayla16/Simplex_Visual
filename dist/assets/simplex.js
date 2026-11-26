(function (raiz) {
  "use strict";

  const EPS = 1e-9;
  const POLITICAS = ["largest", "bland", "smallest"];
  const equivalentes = (a, b) => Number.isFinite(a) && Number.isFinite(b) &&
    (a === b || Math.abs(a - b) <= EPS * Math.max(Math.abs(a), Math.abs(b)));
  // Zera cancelamentos de ponto flutuante sem apagar entradas pequenas por si só.
  const subtrair = (a, b) => equivalentes(a, b) ? 0 : a - b;
  const somar = (a, b) => subtrair(a, -b);
  const zeros = (n) => Array(n).fill(0);
  const variavel = (j) => "x" + j;
  const rotuloRestricao = (i) => `${i + 1}ª restrição`;
  const sinalBonito = { "<=": "≤", ">=": "≥", "==": "=" };

  function numero(texto, contexto) {
    const termo = String(texto).trim().replace(",", ".").replace("−", "-");
    const valor = Number(termo);
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(termo) || !Number.isFinite(valor)) {
      throw new Error(contexto + " precisa ser um número finito.");
    }
    return valor;
  }

  function lerPL(conteudo) {
    const linhas = conteudo.replace(/^\uFEFF/, "").trim().split(/\r?\n/)
      .map((linha) => linha.trim()).filter(Boolean);
    if (linhas.length < 4) throw new Error("A entrada precisa ter pelo menos quatro linhas de cabeçalho.");
    const n = numero(linhas[0], "O número de variáveis");
    const m = numero(linhas[1], "O número de restrições");
    if (!Number.isSafeInteger(n) || n < 1 || !Number.isSafeInteger(m) || m < 0) {
      throw new Error("Informe pelo menos uma variável e um número inteiro de restrições a partir de zero.");
    }
    if (linhas.length !== 4 + m) {
      throw new Error(`A entrada declara ${m} restrição(ões), mas há ${linhas.length - 4} linha(s) de restrições.`);
    }
    const dominios = linhas[2].split(/\s+/);
    // Os arquivos de teste do professor escrevem "max 2 4 8"; o prefixo é opcional.
    if (/^min\b/i.test(linhas[3])) {
      throw new Error("O formato do TP só aceita maximização. Para minimizar c·x, maximize −c·x (troque o sinal dos custos).");
    }
    const objetivo = linhas[3].replace(/^max\b\s*/i, "").split(/\s+/);
    if (dominios.length !== n || objetivo.length !== n) {
      throw new Error(`A linha de domínios e a linha do objetivo precisam ter ${n} valores cada.`);
    }
    const sinais = dominios.map((termo, j) => {
      if (!["1", "0", "-1"].includes(termo)) throw new Error(`O domínio de ${variavel(j)} deve ser 1, 0 ou -1.`);
      return Number(termo);
    });
    const c = objetivo.map((termo, j) => numero(termo, `O custo de ${variavel(j)}`));
    const restricoes = linhas.slice(4).map((linha, i) => {
      const termos = linha.split(/\s+/);
      const operador = { "≤": "<=", "≥": ">=", "=": "==" }[termos[n]] ?? termos[n];
      const rotulo = rotuloRestricao(i);
      if (termos.length !== n + 2 || !["<=", ">=", "=="].includes(operador)) {
        throw new Error(`A ${rotulo} deve ter ${n} coeficiente(s), um sinal (<=, >= ou ==) e o valor de b.`);
      }
      return {
        a: termos.slice(0, n).map((termo, j) => numero(termo, `O coeficiente de ${variavel(j)} na ${rotulo}`)),
        op: operador,
        b: numero(termos[n + 1], `O lado direito da ${rotulo}`),
      };
    });
    return { n, m, sinais, c, restricoes };
  }

  function escreverPL(pl) {
    return [
      pl.n,
      pl.m,
      pl.sinais.join(" "),
      pl.c.join(" "),
      ...pl.restricoes.map(({ a, op, b }) => `${a.join(" ")} ${op} ${b}`),
    ].join("\n") + "\n";
  }

  function expressao(coeficientes, nomes) {
    const parcelas = [];
    coeficientes.forEach((valor, j) => {
      if (valor === 0) return;
      const magnitude = Math.abs(valor);
      const termo = (magnitude === 1 ? "" : String(magnitude) + " ") + nomes[j];
      const sinal = valor < 0 ? "−" : "+";
      parcelas.push(parcelas.length === 0 ? (valor < 0 ? sinal + termo : termo) : ` ${sinal} ${termo}`);
    });
    return parcelas.join("") || "0";
  }

  function descreverPL(pl) {
    const nomes = pl.c.map((_, j) => variavel(j));
    return {
      objetivo: `max z = ${expressao(pl.c, nomes)}`,
      restricoes: pl.restricoes.map(({ a, op, b }) => `${expressao(a, nomes)} ${sinalBonito[op]} ${b}`),
      dominios: pl.sinais.map((sinal, j) => `${nomes[j]} ${sinal === 0 ? "livre" : sinal === 1 ? "≥ 0" : "≤ 0"}`),
    };
  }

  // PL dual de uma PL de maximização (notas, cap. 3): min bᵀy, uma variável yᵢ por
  // restrição e uma restrição por variável xⱼ. O sinal de yᵢ depende do sinal da
  // restrição i; o sinal da restrição j depende do domínio de xⱼ.
  function descreverDual(pl) {
    const nomes = pl.restricoes.map((_, i) => "y" + i);
    const sinalY = { "<=": "≥ 0", ">=": "≤ 0", "==": "livre" };
    const sinalRestricao = { 1: "≥", "-1": "≤", 0: "=" };
    return {
      objetivo: `min w = ${expressao(pl.restricoes.map((r) => r.b), nomes)}`,
      restricoes: pl.c.map((custo, j) =>
        `${expressao(pl.restricoes.map((r) => r.a[j]), nomes)} ${sinalRestricao[pl.sinais[j]]} ${custo}`),
      dominios: pl.restricoes.map((r, i) => `${nomes[i]} ${sinalY[r.op]}`),
    };
  }

  // ---------------------------------------------------------------------------
  // 1. Conversão para Forma Padrão de Igualdades (FPI): max cᵀx, Ax = b, x ≥ 0.
  //    Também garante b ≥ 0 multiplicando restrições com b < 0 por -1.
  // ---------------------------------------------------------------------------
  function converterFPI(pl) {
    const nomes = [];
    const custos = [];
    const colunas = [];
    const notas = [];
    const mapa = pl.sinais.map((sinal, j) => {
      const nome = variavel(j);
      const acrescentar = (rotulo, fator) => {
        const indice = nomes.length;
        nomes.push(rotulo);
        custos.push(fator * pl.c[j]);
        colunas.push({ original: j, fator });
        return { indice, fator };
      };
      if (sinal === 1) return [acrescentar(nome, 1)];
      if (sinal === -1) {
        notas.push({ rotulo: nome, texto: `${nome} ≤ 0. Escrevemos ${nome} = −${nome}⁻, com ${nome}⁻ ≥ 0.` });
        return [acrescentar(nome + "⁻", -1)];
      }
      notas.push({ rotulo: nome, texto: `${nome} é livre. Escrevemos ${nome} = ${nome}⁺ − ${nome}⁻, com as duas parcelas ≥ 0.` });
      return [acrescentar(nome + "⁺", 1), acrescentar(nome + "⁻", -1)];
    });

    const fatores = pl.restricoes.map(({ b }) => b < 0 ? -1 : 1);
    const A = pl.restricoes.map(({ a }, i) =>
      colunas.map(({ original, fator }) => fatores[i] * fator * a[original]));
    const b = pl.restricoes.map((r, i) => fatores[i] * r.b);
    pl.restricoes.forEach((r, i) => {
      const rotulo = rotuloRestricao(i);
      const op = fatores[i] === 1 || r.op === "==" ? r.op : r.op === "<=" ? ">=" : "<=";
      if (fatores[i] === -1) {
        const relacao = r.op === "==" ? "a igualdade foi preservada" :
          `${sinalBonito[r.op]} virou ${sinalBonito[op]}`;
        notas.push({ rotulo, texto: `Como b = ${r.b}, multiplicamos a linha inteira por −1. O novo b é ${b[i]} e ${relacao}.` });
      }
      if (op === "==") {
        notas.push({ rotulo, texto: "A linha já é uma igualdade." });
        return;
      }
      const nome = `s${i}`;
      const folga = op === "<=";
      A.forEach((linha, k) => linha.push(k === i ? (folga ? 1 : -1) : 0));
      nomes.push(nome);
      custos.push(0);
      notas.push({
        rotulo,
        texto: folga ? `Somamos a folga ${nome} ≥ 0 para transformar ≤ em igualdade.` :
          `Subtraímos o excesso ${nome} ≥ 0 para transformar ≥ em igualdade.`,
      });
    });
    return { A, b, nomes, custos, mapa, fatores, notas };
  }

  // Colunas unitárias já têm a forma necessária para ler b diretamente.
  function baseObvia(A, total) {
    const base = A.map(() => -1);
    for (let j = 0; j < total; j++) {
      const linha = A.findIndex((r) => r[j] === 1);
      if (linha >= 0 && base[linha] < 0 && A.every((r, i) => i === linha || r[j] === 0)) {
        base[linha] = j;
      }
    }
    return base.every((j) => j >= 0) ? base : null;
  }

  // ---------------------------------------------------------------------------
  // 2. Montagem do Tableau Estendido (VERO) e forma canônica em L0.
  //    `origem` registra todas as operações elementares sobre as linhas originais
  //    (equivale à matriz A_B⁻¹ na esquerda do tableau estendido das notas de aula).
  // ---------------------------------------------------------------------------
  function montarTableau(fpi, basePronta) {
    const { A, b, nomes, fatores } = fpi;
    const usarAuxiliar = basePronta === null;
    const colunas = usarAuxiliar ? nomes.concat(A.map((_, i) => `a${i}`)) : nomes.slice();
    const base = usarAuxiliar ? A.map((_, i) => nomes.length + i) : basePronta.slice();
    // Cada linha de origem registra a combinação das restrições de entrada.
    const origem = A.map((_, i) => A.map((__, k) => i === k ? fatores[i] : 0));
    const linhas = A.map((a, i) => [...a, ...(usarAuxiliar ? origem[i].map((_, k) => i === k ? 1 : 0) : []), b[i]]);
    return { linhas: [zeros(colunas.length + 1), ...linhas], base, colunas, origem };
  }

  // Calcula a linha objetivo L0 na forma canônica: coloca -cᵀ e zera as colunas
  // básicas usando as linhas das restrições (resultando em c_Bᵀ A_B⁻¹ A - cᵀ).
  function linhaObjetivo(tabela, custos) {
    const linha = custos.map((c) => -c).concat(0);
    tabela.base.forEach((j, i) => {
      const fator = linha[j];
      if (fator === 0) return;
      tabela.linhas[i + 1].forEach((valor, k) => { linha[k] = subtrair(linha[k], fator * valor); });
    });
    tabela.base.forEach((j) => { linha[j] = 0; });
    conferirNumeros(linha);
    return linha;
  }

  function copiarTableau(t) {
    return {
      colunas: t.colunas.slice(),
      base: t.base.slice(),
      linhas: t.linhas.map((r) => r.slice()),
      origem: t.origem.map((r) => r.slice()),
    };
  }

  function mostrarTableau(t) {
    return {
      colunas: t.colunas.slice(),
      linhas: t.linhas.map((r) => r.slice()),
      rotulos: ["L0", ...t.base.map((j) => t.colunas[j])],
    };
  }

  function extrairValores(t) {
    const x = zeros(t.colunas.length);
    t.base.forEach((j, i) => { x[j] = t.linhas[i + 1].at(-1); });
    return x;
  }

  function projetar(vetor, mapa) {
    return mapa.map((termos) => termos.reduce(
      (soma, { indice, fator }) => somar(soma, fator * vetor[indice]), 0));
  }

  function direcao(t, j, mapa) {
    const d = zeros(t.colunas.length);
    d[j] = 1;
    t.base.forEach((basica, i) => { d[basica] = -t.linhas[i + 1][j]; });
    return projetar(d, mapa);
  }

  // Recupera a solução dual wᵀ = c_Bᵀ A_B⁻¹ (ou o certificado de inviabilidade y
  // na Fase I) combinando `origem` com os custos das variáveis na base.
  function valorDual(t, fpi, m) {
    const dual = zeros(m);
    t.base.forEach((j, i) => {
      t.origem[i].forEach((coeficiente, k) => { dual[k] = somar(dual[k], fpi.custos[j] * coeficiente); });
    });
    conferirNumeros(dual);
    return dual;
  }

  // ---------------------------------------------------------------------------
  // 3. Regras de escolha da coluna de entrada, teste da razão (saída) e pivô.
  // ---------------------------------------------------------------------------
  function candidatas(t, L0, permitidas = null) {
    const basicas = new Set(t.base);
    return t.colunas.map((_, j) => j).filter((j) =>
      !basicas.has(j) && L0[j] < 0 && (permitidas === null || permitidas.has(j)));
  }

  function escolherColuna(L0, elegiveis, politica) {
    if (politica === "bland") return elegiveis[0];
    const sinal = politica === "largest" ? 1 : -1;
    return elegiveis.reduce((melhor, j) => sinal * subtrair(L0[j], L0[melhor]) < 0 ? j : melhor);
  }

  function testeDaRazao(t, j) {
    let linha = null;
    let passo = Infinity;
    const opcoes = t.base.map((basica, i) => {
      const coeficiente = t.linhas[i + 1][j];
      const b = t.linhas[i + 1].at(-1);
      const razao = coeficiente > 0 ? Math.max(0, b) / coeficiente : null;
      if (razao !== null) conferirNumeros([razao]);
      const empate = linha !== null && razao !== null && equivalentes(razao, passo);
      if (razao !== null && (linha === null || (empate ? basica < t.base[linha - 1] : razao < passo))) {
        linha = i + 1;
        passo = razao;
      }
      return { linha: i + 1, nome: t.colunas[basica], coeficiente, b, razao };
    });
    return { linha, passo, opcoes };
  }

  function conferirNumeros(vetor) {
    if (vetor.some((v) => !Number.isFinite(v))) {
      throw new Error("O cálculo excedeu a precisão disponível. Reescale os coeficientes da PL.");
    }
  }

  // Gauss-Jordan: divide a linha pivô e zera a coluna nas outras linhas.
  function pivotear(t, linha, coluna) {
    const pivo = t.linhas[linha][coluna];
    t.linhas[linha] = t.linhas[linha].map((valor) => valor / pivo);
    t.origem[linha - 1] = t.origem[linha - 1].map((valor) => valor / pivo);
    conferirNumeros(t.linhas[linha]);
    conferirNumeros(t.origem[linha - 1]);
    t.linhas.forEach((r, i) => {
      if (i === linha) return;
      const fator = r[coluna];
      if (fator === 0) return;
      t.linhas[i] = r.map((valor, j) => subtrair(valor, fator * t.linhas[linha][j]));
      t.linhas[i][coluna] = 0;
      conferirNumeros(t.linhas[i]);
      if (i > 0) {
        t.origem[i - 1] = t.origem[i - 1].map((valor, k) => subtrair(valor, fator * t.origem[linha - 1][k]));
        conferirNumeros(t.origem[i - 1]);
      }
    });
    t.linhas[linha][coluna] = 1;
    t.base[linha - 1] = coluna;
  }

  const chaveBase = (t) => t.base.slice().sort((a, b) => a - b).join(",");

  const regras = {
    largest: "Maior custo reduzido positivo (o coeficiente mais negativo em L0).",
    bland: "Menor índice entre as colunas elegíveis.",
    smallest: "Menor custo reduzido positivo (o negativo mais próximo de zero em L0).",
  };

  function movimento(t, fase, j, teste, detalhes) {
    return {
      fase,
      ...detalhes,
      tabela: mostrarTableau(t),
      pivo: {
        coluna: j,
        linha: teste.linha,
        entra: t.colunas[j],
        sai: teste.linha === null ? null : t.colunas[t.base[teste.linha - 1]],
        valor: teste.linha === null ? null : t.linhas[teste.linha][j],
        razoes: teste.opcoes,
        passo: Number.isFinite(teste.passo) ? teste.passo : null,
        operacoes: teste.linha === null ? [] : t.linhas.flatMap((r, i) =>
          i === teste.linha || r[j] === 0 ? [] : [{ linha: i, fator: r[j] }]),
      },
    };
  }

  function* executarSimplex(t, fase, politica, mapa) {
    const visitadas = new Set();
    let efetiva = politica;
    let iteracao = 1;
    while (true) {
      const L0 = t.linhas[0];
      const elegiveis = candidatas(t, L0);
      if (elegiveis.length === 0) return { tipo: "otimo" };

      const chave = chaveBase(t);
      if (visitadas.has(chave)) {
        if (efetiva === "bland") throw new Error("A precisão disponível fez a base se repetir com Bland. Reescale a PL.");
        efetiva = "bland";
        yield {
          fase, titulo: "Base repetida",
          texto: "A execução passa para Bland nesta fase para evitar um ciclo de pivôs degenerados.",
          tabela: mostrarTableau(t),
        };
        visitadas.clear();
      }
      visitadas.add(chave);
      const j = escolherColuna(L0, elegiveis, efetiva);
      const teste = testeDaRazao(t, j);
      const ponto = fase === "fase2" ? projetar(extrairValores(t), mapa) : null;
      yield movimento(t, fase, j, teste, {
        titulo: teste.linha === null ? "Sem linha de saída" : `Iteração ${iteracao} · escolher o pivô`,
        texto: teste.linha === null
          ? "A coluna melhora o objetivo e todos os seus coeficientes nas restrições são ≤ 0. A variável pode crescer sem limite."
          : "A coluna indicada melhora o objetivo. A menor razão entre as linhas elegíveis indica qual variável básica chega a zero primeiro.",
        regra: regras[efetiva],
        elegiveis,
        ponto,
      });
      if (teste.linha === null) return { tipo: "ilimitado", coluna: j };
      pivotear(t, teste.linha, j);
      iteracao++;
    }
  }

  function* retirarArtificiais(t, n) {
    let i = 0;
    while (i < t.base.length) {
      if (t.base[i] < n) {
        i++;
        continue;
      }
      const linha = i + 1;
      const j = t.linhas[linha].slice(0, n).findIndex((v, k) => v !== 0 && !t.base.includes(k));
      if (j >= 0) {
        yield movimento(t, "fase1", j, { linha, passo: 0, opcoes: [] }, {
          titulo: "Retirar uma artificial da base",
          texto: "A artificial já vale zero. A troca usa um coeficiente não nulo em uma coluna não básica da FPI e mantém o ponto viável.",
        });
        pivotear(t, linha, j);
        i++;
      } else {
        yield {
          fase: "fase1",
          titulo: "Eliminar uma linha redundante",
          texto: `A linha de ${t.colunas[t.base[i]]} vira 0 = 0 quando retiramos as artificiais. Ela pode sair do tableau.`,
          tabela: mostrarTableau(t),
          linhaDestaque: linha,
        };
        t.linhas.splice(linha, 1);
        t.origem.splice(i, 1);
        t.base.splice(i, 1);
      }
    }
    t.linhas = t.linhas.map((r) => r.slice(0, n).concat(r.at(-1)));
    t.colunas.length = n;
  }

  const distinto = (a, b) => a.some((valor, i) => !equivalentes(valor, b[i]));
  const avancarNoRaio = (ponto, d) => ponto.map((valor, i) => somar(valor, d[i]));

  // Se um pivô de custo zero não desloca o ponto, otimizamos uma coordenada
  // original usando somente as colunas de custo zero do ótimo de partida.
  function procurarNoConjuntoOtimo(t, fpi, permitidas, primeiro) {
    for (const [k, termos] of fpi.mapa.entries()) {
      for (const sentido of [1, -1]) {
        const custos = zeros(t.colunas.length);
        termos.forEach(({ indice, fator }) => { custos[indice] = sentido * fator; });
        const copia = copiarTableau(t);
        const caminho = [];
        const visitadas = new Set();
        while (true) {
          const auxiliar = linhaObjetivo(copia, custos);
          const colunas = candidatas(copia, auxiliar, permitidas);
          if (colunas.length === 0) break;
          const chave = chaveBase(copia);
          if (visitadas.has(chave)) throw new Error("A precisão disponível impediu a busca de outro ótimo. Reescale a PL.");
          visitadas.add(chave);
          const j = escolherColuna(auxiliar, colunas, "bland");
          const teste = testeDaRazao(copia, j);
          caminho.push(movimento(copia, "fase2", j, teste, {
            titulo: teste.linha === null ? "Direção de ótimos" : "Pivô no conjunto ótimo",
            texto: `Variamos ${variavel(k)} dentro do conjunto ótimo. L0 continua sendo a do objetivo original, que fica constante.`,
            ponto: projetar(extrairValores(copia), fpi.mapa),
          }));
          if (teste.linha === null) {
            const alvo = avancarNoRaio(projetar(extrairValores(copia), fpi.mapa), direcao(copia, j, fpi.mapa));
            if (distinto(alvo, primeiro)) return { alvo, caminho };
            break;
          }
          pivotear(copia, teste.linha, j);
          const alvo = projetar(extrairValores(copia), fpi.mapa);
          if (distinto(alvo, primeiro)) return { alvo, caminho };
        }
      }
    }
    return null;
  }

  function* outroOtimo(t, fpi, primeiro) {
    const basicas = new Set(t.base);
    const zeradas = t.colunas.map((_, j) => j)
      .filter((j) => !basicas.has(j) && t.linhas[0][j] === 0);
    let haDegeneracao = false;
    for (const j of zeradas) {
      const d = direcao(t, j, fpi.mapa);
      if (!d.some((valor) => valor !== 0)) continue;
      const teste = testeDaRazao(t, j);
      if (teste.linha === null) {
        const alvo = avancarNoRaio(primeiro, d);
        if (!distinto(alvo, primeiro)) continue;
        yield movimento(t, "fase2", j, teste, {
          titulo: "Direção de ótimos",
          texto: "A coluna tem custo reduzido zero e nenhuma linha limita seu aumento. Avançamos uma unidade nessa direção para obter outro ponto ótimo.",
          ponto: primeiro,
        });
        return alvo;
      }
      const copia = copiarTableau(t);
      pivotear(copia, teste.linha, j);
      const alvo = projetar(extrairValores(copia), fpi.mapa);
      if (distinto(alvo, primeiro)) {
        yield movimento(t, "fase2", j, teste, {
          titulo: "Mais um pivô, mesmo objetivo",
          texto: "Esta variável não básica tem custo reduzido zero. Ao pivotear, obtemos outro ponto da PL original e mantemos o valor de z.",
          ponto: primeiro,
        });
        return alvo;
      }
      haDegeneracao = true;
    }
    if (haDegeneracao) {
      const alternativa = procurarNoConjuntoOtimo(t, fpi, new Set([...t.base, ...zeradas]), primeiro);
      if (alternativa) {
        yield* alternativa.caminho;
        return alternativa.alvo;
      }
    }
    return null;
  }

  // ---------------------------------------------------------------------------
  // 4. Fluxo principal do Simplex em Duas Fases (função geradora: cada `yield`
  //    emite uma etapa consumida tanto pelo terminal quanto pela interface web).
  // ---------------------------------------------------------------------------
  function* resolver(pl, politica = "largest") {
    if (!POLITICAS.includes(politica)) throw new Error("Política desconhecida: " + politica);
    const fpi = converterFPI(pl);
    yield {
      fase: "fpi",
      titulo: "Forma padrão de igualdades",
      texto: "Em FPI, maximizamos, escrevemos as restrições como igualdades e usamos variáveis não negativas. Para iniciar a base, também deixamos b ≥ 0.",
      modelo: {
        objetivo: "max z = " + expressao(fpi.custos, fpi.nomes),
        restricoes: fpi.A.map((r, i) => `${expressao(r, fpi.nomes)} = ${fpi.b[i]}`),
        dominios: [fpi.nomes.join(", ") + " ≥ 0"],
      },
      tabela: {
        colunas: fpi.nomes.slice(),
        linhas: [fpi.custos.concat(null), ...fpi.A.map((r, i) => r.concat(fpi.b[i]))],
        rotulos: ["c", ...fpi.A.map((_, i) => `(${i + 1})`)],
      },
      notas: fpi.notas,
    };

    const basePronta = baseObvia(fpi.A, fpi.nomes.length);
    const t = montarTableau(fpi, basePronta);
    if (basePronta === null) {
      const aux = fpi.custos.map(() => 0).concat(fpi.A.map(() => -1));
      t.linhas[0] = linhaObjetivo(t, aux);
      yield {
        fase: "fase1",
        titulo: "Montar a PL auxiliar",
        texto: "As artificiais aᵢ formam uma identidade. Com as demais variáveis em zero, elas começam com os valores de b.",
        formula: "max z auxiliar = " + expressao(aux, t.colunas),
        tabela: mostrarTableau(t),
      };
      const auxResultado = yield* executarSimplex(t, "fase1", politica, fpi.mapa);
      if (auxResultado.tipo === "ilimitado") {
        throw new Error("A PL auxiliar está sujeita a erro numérico. Reescale os coeficientes.");
      }
      const somaArtificiais = t.base.reduce((soma, j, i) =>
        j < fpi.nomes.length ? soma : soma + Math.max(0, t.linhas[i + 1].at(-1)), 0);
      const zAux = 0 - somaArtificiais;
      t.linhas[0][t.colunas.length] = zAux;
      const inviavel = zAux < -EPS * (1 + Math.max(0, ...fpi.b.map(Math.abs)));
      // Certificado de inviabilidade (notas, seção 1.7.1): y = c_B·B⁻¹ da PL auxiliar,
      // lido no registro de operações. Vale yᵀA ≥ 0 nas colunas da FPI e yᵀb = z auxiliar < 0.
      const certificado = inviavel ? valorDual(t, { custos: aux }, pl.m) : null;
      yield {
        fase: "fase1",
        titulo: inviavel ? "Ótimo auxiliar abaixo de zero" : "Ótimo auxiliar igual a zero",
        texto: inviavel
          ? "Uma soma positiva de artificiais permanece no ótimo da Fase I. A PL original não admite ponto que satisfaça todas as restrições."
          : "Todas as artificiais valem zero. Agora podemos retirar suas colunas e levar uma base viável para o objetivo original.",
        tabela: mostrarTableau(t),
      };
      if (inviavel) {
        yield {
          fase: "resultado", titulo: "PL inviável",
          texto: "A Fase I não conseguiu zerar todas as artificiais. O vetor y abaixo é um certificado: combinando as restrições com esses pesos, obtemos uma desigualdade impossível (lado esquerdo ≥ 0 e lado direito < 0).",
          resultado: { status: "inviavel", zAux, certificado },
        };
        return;
      }
      yield* retirarArtificiais(t, fpi.nomes.length);
    } else {
      yield {
        fase: "fase1",
        titulo: "Base viável já disponível",
        texto: basePronta.length
          ? `As colunas ${basePronta.map((j) => t.colunas[j]).join(", ")} formam uma identidade. As básicas valem b ≥ 0 e as demais valem zero. Podemos pular a PL auxiliar.`
          : "Sem linhas de restrição, a origem já é viável. A Fase II começa com base vazia.",
      };
    }

    t.linhas[0] = linhaObjetivo(t, fpi.custos);
    yield {
      fase: "fase2", titulo: "Restaurar o objetivo original",
      texto: "Colocamos −c em L0 e usamos as linhas das restrições para zerar as colunas básicas em L0. A solução inicial tem as não básicas em zero.",
      formula: "max z = " + expressao(fpi.custos, t.colunas),
      tabela: mostrarTableau(t),
      ponto: projetar(extrairValores(t), fpi.mapa),
    };
    const fim = yield* executarSimplex(t, "fase2", politica, fpi.mapa);
    const ponto = projetar(extrairValores(t), fpi.mapa);
    if (fim.tipo === "ilimitado") {
      const d = direcao(t, fim.coluna, fpi.mapa);
      yield {
        fase: "resultado", titulo: "PL ilimitada",
        texto: "A partir do ponto atual, existe uma direção que preserva as restrições e permite aumentar z sem limite.",
        tabela: mostrarTableau(t),
        ponto,
        resultado: { status: "ilimitado", ponto, direcao: d },
      };
      return;
    }

    yield {
      fase: "fase2", titulo: "Teste de otimalidade",
      texto: "Todos os coeficientes das não básicas em L0 são ≥ 0. A base atual é ótima. Em seguida, verificamos se um custo reduzido zero permite mudar o ponto original sem mudar z.",
      tabela: mostrarTableau(t),
      ponto,
      custosZero: t.colunas.filter((_, j) => !t.base.includes(j) && t.linhas[0][j] === 0),
    };
    const segundo = yield* outroOtimo(t, fpi, ponto);
    const z = pl.c.reduce((soma, custo, j) => somar(soma, custo * ponto[j]), 0);
    conferirNumeros([z, ...ponto]);
    const resultado = {
      status: segundo ? "otimo (multiplos)" : "otimo",
      z,
      solucoes: segundo ? [ponto, segundo] : [ponto],
      dual: valorDual(t, fpi, pl.m),
    };
    yield {
      fase: "resultado",
      titulo: segundo ? "Múltiplas soluções ótimas" : "Ótimo encontrado",
      texto: segundo ? "Os dois pontos satisfazem a PL original e atingem o mesmo valor de z." :
        "O maior valor de z é atingido por um único ponto da PL original.",
      ponto,
      resultado,
    };
  }

  const api = { POLITICAS, lerPL, escreverPL, descreverPL, descreverDual, rotuloRestricao, resolver };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.Simplex = api;
})(globalThis);
