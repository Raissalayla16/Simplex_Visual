(function (raiz) {
  "use strict";

  const cores = ["#7240ac", "#2878a7", "#ae5287", "#2b8170", "#8e562d", "#5360ba"];
  const formatar = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 3 });
  const produto = (a, p) => a[0] * p[0] + a[1] * p[1];

  function recortar(poligono, a, b) {
    const saida = [];
    for (let i = 0; i < poligono.length; i++) {
      const p = poligono[i];
      const q = poligono[(i + 1) % poligono.length];
      const dp = produto(a, p) - b;
      const dq = produto(a, q) - b;
      const pDentro = dp <= 1e-10;
      const qDentro = dq <= 1e-10;
      if (pDentro) saida.push(p);
      if (pDentro !== qDentro) {
        const t = dp / (dp - dq);
        saida.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]);
      }
    }
    return saida;
  }

  // Calcula a caixa [xmin, xmax] x [ymin, ymax] que enquadra a origem, os
  // interceptos das restrições, os vértices visitados e uma amostra do raio ilimitado.
  function limites(pl, pontos, caminho = [], direcao = null) {
    const todos = [...pontos, ...caminho];
    if (direcao && pontos.length) {
      const norma = Math.hypot(direcao[0], direcao[1]) || 1;
      todos.push([pontos[0][0] + (direcao[0] / norma) * 2.5, pontos[0][1] + (direcao[1] / norma) * 2.5]);
    }
    const xs = [0, ...todos.map((p) => p[0])];
    const ys = [0, ...todos.map((p) => p[1])];
    pl.restricoes.forEach(({ a, b }) => {
      if (a[0] !== 0) xs.push(b / a[0]);
      if (a[1] !== 0) ys.push(b / a[1]);
    });
    const faixa = (nums, sinal) => {
      const finitos = nums.filter(Number.isFinite);
      let min = Math.min(...finitos);
      let max = Math.max(...finitos);
      if (min === max) {
        min = sinal === 1 ? 0 : min - 4;
        max = sinal === -1 ? 0 : max + 4;
      }
      const margem = (max - min) * .18;
      return [min - margem, max + margem];
    };
    return [faixa(xs, pl.sinais[0]), faixa(ys, pl.sinais[1])];
  }

  function segmento(a, b, xs, ys) {
    const candidatos = [];
    if (a[1] !== 0) xs.forEach((x) => candidatos.push([x, (b - a[0] * x) / a[1]]));
    if (a[0] !== 0) ys.forEach((y) => candidatos.push([(b - a[1] * y) / a[0], y]));
    const dentro = candidatos.filter(([x, y]) => x >= xs[0] - 1e-8 && x <= xs[1] + 1e-8 &&
      y >= ys[0] - 1e-8 && y <= ys[1] + 1e-8);
    // Remove duplicatas nos cantos do retângulo para garantir os dois extremos reais do segmento.
    const unicos = [];
    for (const p of dentro) {
      if (!unicos.some((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) < 1e-6)) unicos.push(p);
    }
    return unicos;
  }

  function marcas(min, max, total) {
    const ideal = (max - min) / total;
    const ordem = 10 ** Math.floor(Math.log10(ideal));
    if (!Number.isFinite(ordem) || ordem <= 0) return [];
    const escala = [1, 2, 5, 10].find((n) => n * ordem >= ideal);
    const passo = escala * ordem;
    const primeira = Math.ceil(min / passo);
    const ultima = Math.floor(max / passo);
    return Array.from({ length: Math.min(20, Math.max(0, ultima - primeira + 1)) },
      (_, i) => (primeira + i) * passo);
  }

  function desenharSeta(g, x1, y1, x2, y2, cor, tamanho = 8) {
    const ang = Math.atan2(y2 - y1, x2 - x1);
    g.beginPath();
    g.moveTo(x2, y2);
    g.lineTo(x2 - tamanho * Math.cos(ang - 0.42), y2 - tamanho * Math.sin(ang - 0.42));
    g.lineTo(x2 - tamanho * Math.cos(ang + 0.42), y2 - tamanho * Math.sin(ang + 0.42));
    g.closePath();
    g.fillStyle = cor;
    g.fill();
  }

  function etiquetaCaixa(g, texto, x, y, corTexto, corFundo, corBorda) {
    g.font = "600 11px system-ui, sans-serif";
    const w = g.measureText(texto).width + 10;
    const h = 19;
    g.fillStyle = corFundo;
    g.strokeStyle = corBorda;
    g.lineWidth = 1;
    g.beginPath();
    g.roundRect(x - w / 2, y - h / 2, w, h, 5);
    g.fill();
    g.stroke();
    g.fillStyle = corTexto;
    g.textAlign = "center";
    g.textBaseline = "middle";
    g.fillText(texto, x, y + 0.5);
    g.textBaseline = "alphabetic";
  }

  function desenhar(canvas, pl, pontos, opcoes = {}) {
    const { caminho = [], direcao = null, multiplos = false } = opcoes;
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0) return false;
    const escala = raiz.devicePixelRatio || 1;
    canvas.width = Math.round(rect.width * escala);
    canvas.height = Math.round(rect.height * escala);
    const g = canvas.getContext("2d");
    g.scale(escala, escala);

    const [xs, ys] = limites(pl, pontos, caminho, direcao);
    const margem = { esquerda: 55, direita: 28, cima: 29, baixo: 38 };
    const largura = rect.width - margem.esquerda - margem.direita;
    const altura = rect.height - margem.cima - margem.baixo;
    const paraTela = ([x, y]) => [
      margem.esquerda + (x - xs[0]) / (xs[1] - xs[0]) * largura,
      margem.cima + (ys[1] - y) / (ys[1] - ys[0]) * altura,
    ];
    const pontoLinha = (p) => g.lineTo(...paraTela(p));
    function traco(pts, cor, espessura = 1, tracejado = []) {
      if (pts.length < 2) return;
      g.beginPath();
      g.moveTo(...paraTela(pts[0]));
      pts.slice(1).forEach(pontoLinha);
      g.setLineDash(tracejado);
      g.strokeStyle = cor;
      g.lineWidth = espessura;
      g.stroke();
      g.setLineDash([]);
    }

    g.fillStyle = "#fbf9fd";
    g.fillRect(margem.esquerda, margem.cima, largura, altura);
    g.font = "12px system-ui, sans-serif";
    g.fillStyle = "#655774";
    g.textAlign = "center";
    marcas(...xs, largura > 400 ? 7 : 4).forEach((x) => {
      traco([[x, ys[0]], [x, ys[1]]], "#ebe4f1");
      g.fillText(formatar.format(x), paraTela([x, ys[0]])[0], rect.height - 17, 65);
    });
    g.textAlign = "right";
    marcas(...ys, 6).forEach((y) => {
      traco([[xs[0], y], [xs[1], y]], "#ebe4f1");
      g.fillText(formatar.format(y), margem.esquerda - 7, paraTela([0, y])[1] + 4, 47);
    });

    // Recorta o retângulo visível por cada semiplano (algoritmo de Sutherland-Hodgman)
    // para obter o polígono convexo da região viável.
    g.save();
    g.beginPath();
    g.rect(margem.esquerda, margem.cima, largura, altura);
    g.clip();

    let regiao = [[xs[0], ys[0]], [xs[1], ys[0]], [xs[1], ys[1]], [xs[0], ys[1]]];
    const cortar = (a, b) => {
      const norma = Math.max(Math.abs(a[0]), Math.abs(a[1]));
      if (norma === 0) {
        if (b < 0) regiao = [];
        return;
      }
      regiao = recortar(regiao, a.map((n) => n / norma), b / norma);
    };
    pl.restricoes.forEach(({ a, op, b }) => {
      if (op !== ">=") cortar(a, b);
      if (op !== "<=") cortar(a.map((v) => -v), -b);
    });
    pl.sinais.forEach((v, j) => {
      if (v !== 0) cortar(j === 0 ? [-v, 0] : [0, -v], 0);
    });
    if (regiao.length) {
      g.beginPath();
      g.moveTo(...paraTela(regiao[0]));
      regiao.slice(1).forEach(pontoLinha);
      g.closePath();
      g.fillStyle = "#e6d9f9bd";
      g.fill();
      g.strokeStyle = "#8454b6";
      g.lineWidth = 1.5;
      g.stroke();
      if (regiao.every((p) => Math.hypot(p[0] - regiao[0][0], p[1] - regiao[0][1]) < 1e-8)) {
        g.beginPath();
        g.arc(...paraTela(regiao[0]), 4, 0, 2 * Math.PI);
        g.fillStyle = "#8454b6";
        g.fill();
      }
    }

    traco([[0, ys[0]], [0, ys[1]]], "#80758e", 1.15);
    traco([[xs[0], 0], [xs[1], 0]], "#80758e", 1.15);

    // Retas das restrições com rótulo discreto R1, R2, ...
    const telasPontos = pontos.map(paraTela);
    pl.restricoes.forEach(({ a, b }, i) => {
      const seg = segmento(a, b, xs, ys);
      const cor = cores[i % cores.length];
      traco(seg, cor, 1.5, [5, 3]);
      if (seg.length >= 2) {
        const p1 = paraTela(seg[0]);
        const p2 = paraTela(seg[1]);
        const opcoesT = [0.22 + (i % 3) * 0.14, 0.78 - (i % 3) * 0.12, 0.5];
        const pos = opcoesT.map((t) => [
          Math.min(Math.max(p1[0] + t * (p2[0] - p1[0]), margem.esquerda + 18), margem.esquerda + largura - 18),
          Math.min(Math.max(p1[1] + t * (p2[1] - p1[1]), margem.cima + 14), margem.cima + altura - 14),
        ]);
        const [rx, ry] = pos.find(([x, y]) => telasPontos.every(([px, py]) => Math.hypot(x - px, y - py) > 34)) ?? pos[0];
        etiquetaCaixa(g, `R${i + 1}`, rx, ry, cor, "#ffffffeb", cor + "55");
      }
    });

    // Curva de nível da função objetivo cᵀx = z passando pelo ponto atual
    // e seta do gradiente c indicando o sentido de crescimento de z.
    const cNorma = Math.hypot(pl.c[0], pl.c[1]);
    if (pontos.length && cNorma > 1e-12) {
      const zAtual = produto(pl.c, pontos[0]);
      const segObj = segmento(pl.c, zAtual, xs, ys);
      traco(segObj, "#c43f8e", 1.8, [7, 4]);
      const [px, py] = paraTela(pontos[0]);
      const [qx, qy] = paraTela([pontos[0][0] + pl.c[0], pontos[0][1] + pl.c[1]]);
      const dx = qx - px;
      const dy = qy - py;
      const dist = Math.hypot(dx, dy) || 1;
      const comp = 34;
      const gx = px + (dx / dist) * comp;
      const gy = py + (dy / dist) * comp;
      g.beginPath();
      g.moveTo(px, py);
      g.lineTo(gx, gy);
      g.strokeStyle = "#c43f8e";
      g.lineWidth = 2;
      g.stroke();
      desenharSeta(g, px, py, gx, gy, "#c43f8e", 7);
    }

    // Segmento de múltiplas soluções ótimas (combinação convexa)
    if (multiplos && pontos.length >= 2) {
      traco([pontos[0], pontos[1]], "#ac407e", 4.5);
    }

    // Semirreta de crescimento ilimitado (certificado d)
    if (direcao && pontos.length) {
      const dNorma = Math.hypot(direcao[0], direcao[1]);
      if (dNorma > 1e-12) {
        const escalaRaio = Math.max(xs[1] - xs[0], ys[1] - ys[0]) * 1.5;
        const destino = [
          pontos[0][0] + (direcao[0] / dNorma) * escalaRaio,
          pontos[0][1] + (direcao[1] / dNorma) * escalaRaio,
        ];
        traco([pontos[0], destino], "#1f78b4", 2.4, [6, 4]);
        const [x1, y1] = paraTela(pontos[0]);
        const [x2, y2] = paraTela(destino);
        const dist = Math.hypot(x2 - x1, y2 - y1) || 1;
        const sx = x1 + ((x2 - x1) / dist) * Math.min(72, dist * 0.7);
        const sy = y1 + ((y2 - y1) / dist) * Math.min(72, dist * 0.7);
        desenharSeta(g, x1, y1, sx, sy, "#1f78b4", 9);
      }
    }

    // Trajetória percorrida pelo Simplex na Fase II (vértice a vértice)
    if (caminho.length >= 2) {
      for (let i = 0; i < caminho.length - 1; i++) {
        const a = paraTela(caminho[i]);
        const b = paraTela(caminho[i + 1]);
        if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 2) continue;
        g.beginPath();
        g.moveTo(a[0], a[1]);
        g.lineTo(b[0], b[1]);
        g.strokeStyle = "#5a288e";
        g.lineWidth = 2.2;
        g.stroke();
        const mx = a[0] + (b[0] - a[0]) * 0.62;
        const my = a[1] + (b[1] - a[1]) * 0.62;
        desenharSeta(g, a[0], a[1], mx, my, "#5a288e", 7);
      }
      caminho.slice(0, -1).forEach((p) => {
        const [x, y] = paraTela(p);
        g.beginPath();
        g.arc(x, y, 4, 0, 2 * Math.PI);
        g.fillStyle = "#fff";
        g.fill();
        g.lineWidth = 2;
        g.strokeStyle = "#5a288e";
        g.stroke();
      });
    }

    // Pontos destacados (ponto atual ou soluções ótimas) com rótulo de coordenadas
    pontos.forEach((p, i) => {
      const [x, y] = paraTela(p);
      const cor = i === 0 ? "#5a288e" : "#ac407e";
      g.beginPath();
      g.arc(x, y, 6.5, 0, 2 * Math.PI);
      g.fillStyle = cor;
      g.fill();
      g.lineWidth = 2.2;
      g.strokeStyle = "#fff";
      g.stroke();
      const rotulo = `(${formatar.format(p[0])}; ${formatar.format(p[1])})`;
      const lx = Math.min(Math.max(x, margem.esquerda + 44), margem.esquerda + largura - 44);
      const ly = y - 18 < margem.cima + 12 ? y + 20 : y - 18;
      etiquetaCaixa(g, rotulo, lx, ly, cor, "#fffffff0", cor + "55");
    });

    g.restore();

    // Nomes dos eixos fora do recorte
    g.fillStyle = "#4b3c5b";
    g.textAlign = "left";
    g.font = "bold 12px system-ui, sans-serif";
    g.fillText("x₁", margem.esquerda, margem.cima - 9);
    g.fillText("x₀", rect.width - 24, rect.height - 17);

    return regiao.length > 0;
  }

  raiz.GraficoPL = { desenhar, cores };
})(globalThis);
