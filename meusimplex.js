"use strict";

const fs = require("node:fs");
const { parseArgs } = require("node:util");
const Simplex = require("./dist/assets/simplex.js");

function inteiro(texto, nome, menor, maior) {
  const valor = Number(texto);
  if (!/^\d+$/.test(texto) || !Number.isSafeInteger(valor) || valor < menor || valor > maior) {
    throw new Error(`${nome} deve ser um inteiro entre ${menor} e ${maior}.`);
  }
  return valor;
}

function formatador(digits, decimals) {
  return (valor) => {
    if (valor === null) return "—".padStart(digits);
    const magnitude = Math.abs(valor);
    let texto = magnitude.toFixed(decimals);
    if (valor < 0 && Number(texto) !== 0) texto = "-" + texto;
    return texto.padStart(digits);
  };
}

function imprimirTabela(tabela, formatar) {
  const rotulos = ["Base/linha", ...tabela.colunas, "b"];
  const linhas = tabela.linhas.map((r, i) => [tabela.rotulos[i], ...r.map(formatar)]);
  const larguras = rotulos.map((rotulo, j) => linhas.reduce(
    (maior, linha) => Math.max(maior, linha[j].length), rotulo.length));
  const alinhar = (valores) => valores.map((v, j) => v.padStart(larguras[j])).join(" | ");
  const cabecalho = alinhar(rotulos);
  console.log(cabecalho);
  console.log("-".repeat(cabecalho.length));
  linhas.forEach((linha) => console.log(alinhar(linha)));
}

function imprimirModelo(modelo) {
  console.log(modelo.objetivo);
  modelo.restricoes.forEach((r, i) => console.log(`${i === 0 ? "sujeito a " : "          "}${r}`));
  console.log("          " + modelo.dominios.join(", "));
}

function imprimirPasso(passo, formato) {
  const fase = { fpi: "FPI", fase1: "FASE I", fase2: "FASE II", resultado: "RESULTADO" }[passo.fase];
  console.log(`\n=== ${fase} · ${passo.titulo} ===`);
  console.log(passo.texto);
  if (passo.formula) console.log(passo.formula);
  if (passo.modelo) imprimirModelo(passo.modelo);
  passo.notas?.forEach(({ rotulo, texto }) => console.log(`  ${rotulo} | ${texto}`));
  if (passo.tabela) imprimirTabela(passo.tabela, formato);
  if (passo.custosZero?.length) console.log("Não básicas de custo zero: " + passo.custosZero.join(", "));
  const r = passo.resultado;
  if (r?.certificado) {
    console.log("Certificado de inviabilidade (y com yᵀA ≥ 0 e yᵀb < 0):");
    console.log(r.certificado.map(formato).join(" "));
  }
  if (r?.direcao) {
    console.log("Certificado de ilimitada · ponto viável x e direção d (x + t·d é viável para todo t ≥ 0):");
    console.log("x: " + r.ponto.map(formato).join(" "));
    console.log("d: " + r.direcao.map(formato).join(" "));
  }
  if (!passo.pivo) return;
  const { entra, sai, valor, razoes, linha, operacoes } = passo.pivo;
  if (passo.regra) console.log(passo.regra);
  console.log(sai === null ? `Candidata: ${entra} | nenhuma linha de saída` : `Entra: ${entra} | Sai: ${sai}`);
  razoes.forEach((r) => {
    console.log(r.razao === null ? `  L${r.linha} (${r.nome}) | coeficiente ≤ 0` :
      `  L${r.linha} (${r.nome}) | ${formato(r.b)} / ${formato(r.coeficiente)} = ${formato(r.razao)}`);
  });
  if (linha !== null) {
    console.log(`Pivô: ${formato(valor)}`);
    console.log(`  L${linha} ← L${linha} / ${formato(valor)}`);
    operacoes.forEach((op) => console.log(`  L${op.linha} ← L${op.linha} − (${formato(op.fator)}) × L${linha}`));
  }
}

function imprimirResultado(resultado, formato) {
  console.log(`\nStatus: ${resultado.status}`);
  if (!resultado.solucoes) return;
  console.log(`Objetivo: ${formato(resultado.z)}`);
  console.log(resultado.solucoes.length === 1 ? "Solucao:" : "Solucoes:");
  resultado.solucoes.forEach((x) => console.log(x.map(formato).join(" ")));
  console.log("Dual:");
  console.log(resultado.dual.map(formato).join(" "));
}

function principal() {
  const { values, positionals } = parseArgs({
    options: {
      help: { type: "boolean", short: "h" },
      decimals: { type: "string", default: "3" },
      digits: { type: "string", default: "7" },
      policy: { type: "string", default: "largest" },
    },
    allowPositionals: true,
  });
  if (values.help) {
    console.log("Uso: node meusimplex.js <filename> [--decimals 3] [--digits 7] [--policy largest|bland|smallest]");
    return;
  }
  if (positionals.length !== 1) throw new Error("Informe um arquivo de entrada. Use --help para ver as opções.");
  if (!Simplex.POLITICAS.includes(values.policy)) throw new Error("Escolha --policy largest, bland ou smallest.");
  const decimals = inteiro(values.decimals, "--decimals", 0, 100);
  const digits = inteiro(values.digits, "--digits", 1, 10000);
  const formato = formatador(digits, decimals);
  const pl = Simplex.lerPL(fs.readFileSync(positionals[0], "utf8"));
  console.log(`=== PL ORIGINAL · política ${values.policy} ===`);
  imprimirModelo(Simplex.descreverPL(pl));
  for (const passo of Simplex.resolver(pl, values.policy)) {
    imprimirPasso(passo, formato);
    if (passo.resultado) imprimirResultado(passo.resultado, formato);
  }
}

try {
  principal();
} catch (erro) {
  console.error("Erro: " + erro.message);
  process.exitCode = 1;
}
