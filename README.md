# Simplex Visual

Trabalho prático de Pesquisa Operacional (DCC035). Implementação do Simplex
primal de duas fases para o formato de entrada de TP_20261.pdf. O terminal
imprime o passo a passo e o resultado em stdout. A interface apresenta as mesmas
etapas com os detalhes visuais do tableau.

## 1. Abra no Windows

1. Extraia `Simplex_Visual.zip` usando **Extrair Tudo**. Na pasta extraída,
   dê dois cliques em `Abrir_Simplex.html`. A interface funciona no Edge
   ou Chrome mesmo sem internet. Para usar o Chrome diretamente, clique
   com o botão direito e escolha **Abrir com → Google Chrome**.
2. Para examinar ou editar o código, no VS Code abra **Arquivo → Abrir Pasta**
   e selecione a pasta extraída que contém `meusimplex.js`. Abra
   **Terminal → Novo Terminal** para rodar o modo exigido no TP.
3. Se necessário, instale a versão LTS do [Node.js](https://nodejs.org/en/download/)
   e reabra o VS Code. No terminal, confirme com `node --version`. Não há pacotes
   para instalar dentro do projeto.
4. Teste no PowerShell do VS Code. O primeiro comando mostra uma solução
   única. O segundo inclui a Fase I.

```powershell
node .\meusimplex.js .\exemplos\teste2.txt --decimals 3 --digits 7 --policy bland
node .\meusimplex.js .\exemplos\duas_fases.txt --policy largest
```

Use `node .\meusimplex.js --help` para listar as opções. Em Linux ou macOS,
use caminhos com barra, por exemplo `node meusimplex.js exemplos/teste2.txt`.

## 2. Experimente no navegador

- **Duas fases** já sai carregado. Use **Próximo passo** para chegar à PL
  auxiliar. Na primeira iteração, abra **Ver contas do pivoteamento**.
- Em **Ótimo único · teste2.txt**, a base de folgas já está disponível.
  No primeiro pivô com `largest`, entra `x0`, sai `s1` e o pivô vale 2.
- A visualização **Gráfico** acompanha o ponto viável da Fase II quando
  a PL tem duas variáveis. **Anterior** e o histórico recuperam etapas vistas.
- Em **Bloco de notas**, digite ou cole as linhas no formato do TP e clique
  em **Resolver passo a passo**. Ao carregar um exemplo, os dois modos de
  entrada já vêm preenchidos. Você também pode importar e baixar um `.txt`.
- Na etapa **Forma padrão**, veja a PL escrita como um sistema de igualdades.
  Abra **Ver forma matricial** para ver o mesmo modelo como nas notas de aula.

## 3. Formato da entrada e da saída

```text
2
2
1 1
3 2
1 1 <= 4
2 1 <= 6
```

Leia de cima para baixo. São duas variáveis, duas restrições explícitas,
os dois domínios, dois custos e as duas restrições. Os domínios aceitam
`1` para ≥ 0, `-1` para ≤ 0 e `0` para livre. Os sinais de restrição
são `<=`, `>=` e `==`. Só há maximização nesse formato. A indexação
começa em zero, como pede o TP.

A CLI usa `--policy largest` por padrão, `--decimals 3` para as casas
decimais e `--digits 7` para a largura mínima dos números. As regras
`largest` e `smallest` escolhem, respectivamente, o maior e o menor
custo reduzido positivo. `bland` usa o menor índice. Empates seguem
a ordem de Bland. Se ocorrer repetição de base, a execução anuncia
a mudança para Bland para evitar ciclagem.

| Arquivo em `exemplos/` | Último resultado esperado |
| --- | --- |
| `teste2.txt` | `Status: otimo` com z = 10, x = (2, 2), dual = (1, 1) |
| `duas_fases.txt` | `Status: otimo` com z = 10, x = (2, 2), dual = (1, 1, 0) |
| `inviavel.txt` | `Status: inviavel` |
| `teste.txt` | `Status: ilimitado` |
| `multiplos.txt` | `Status: otimo (multiplos)` com z = 4, x = (4, 0) e (0, 4) na política `largest` |
| `sinais.txt` | `Status: otimo` com z = 5, x = (−3, 2), dual = (−2, 0, 1) |

## 4. O que ler no código

| Arquivo | O que você encontra |
| --- | --- |
| `Abrir_Simplex.html` | Atalho para abrir a interface offline com um clique duplo |
| `meusimplex.js` | Leitura do arquivo, argumentos e impressão no terminal |
| `dist/assets/simplex.js` | FPI, base inicial, pivôs, PL auxiliar, dual e teste de outro ótimo |
| `dist/index.html` | Formulário, áreas dos tableaux e guia rápido |
| `dist/assets/app.js` | Eventos da tela, avanço por etapas, tabelas e destaque do pivô |
| `dist/assets/styles.css` | Paleta roxa, rosa e azul, tipografia, tamanhos e layout responsivo |
| `dist/assets/plot.js` | Desenho da região viável em duas dimensões |

Em `simplex.js`, comece por `resolver`. Cada `yield` fornece uma etapa
com os dados que os dois modos consomem. `linhaObjetivo` zera as
colunas básicas em L0. `testeDaRazao` escolhe a saída. `pivotear`
divide a linha pivô e zera o restante da coluna com Gauss-Jordan.
`valorDual` recupera um multiplicador por restrição original a partir
das operações feitas nessas linhas. A tolerância relativa de
`1e-9` reduz resíduos numéricos de cancelamento no tableau.

Se uma igualdade redundante deixar uma artificial básica de valor zero
sem coluna para substituí-la, sua linha pode ser retirada. Na busca de
outro ótimo, a comparação usa as variáveis originais. Uma troca
degenerada pode exigir mais pivôs. Em um raio de custo zero, um passo
viável já fornece o segundo ponto.

### Aproveitamento dos arquivos recebidos

- `teste.txt` é o próprio exemplo da especificação. É ilimitado e também
  exercita uma variável livre.
- `teste2.txt` tem solução única e é bom para explicar dois pivôs pequenos.
- `Symplex.py` já contém a conversão para FPI, as três políticas, o
  pivoteamento manual e o cálculo do dual. A implementação usa a mesma
  estrutura matemática em JavaScript para compartilhar o solver com a
  interface. Também trata linhas redundantes na saída da Fase I e busca
  segundos ótimos em casos degenerados ou em raios de custo zero.

## 5. Publique o código no seu GitHub pelo VS Code

1. Com a pasta do projeto aberta, confirme `git --version`. Caso
   precise, instale o [Git para Windows](https://git-scm.com/install/windows)
   e reabra o VS Code.
2. Abra **Source Control** (Controle do Código-Fonte). Clique em
   **Initialize Repository** para iniciar o histórico local.
3. Em **Changes**, use **Stage All Changes**. Digite `Implementa o Simplex
   visual` e clique em **Commit**.
4. Pressione **Ctrl+Shift+P** e escolha **Publish to GitHub**. Entre na
   sua conta se solicitado. Use o nome `simplex-visual` e escolha a
   opção de repositório privado. O [guia oficial do VS Code](https://code.visualstudio.com/docs/sourcecontrol/repos-remotes)
   mostra esse fluxo.

### Prompt para estudar o código com o Codex no VS Code

> Leia `README.md`, `meusimplex.js` e `dist/assets/simplex.js`.
> Rode `node meusimplex.js exemplos/teste2.txt --policy largest`.
> Explique em português e em cinco passos o primeiro pivô, mostrando
> os valores da coluna x0, as duas razões, quem entra, quem sai e o
> novo tableau. Depois me mostre onde a interface recebe essa etapa
> e quais três cores a destacam. Por enquanto, só explique o código.
