## Tutorial
* Importante que frontend e sdk deve estar no mesmo nível.
* Clonar o repossitório do jeliel em que ele colocou tudo.
* Clona o repositório no frontend do cesar e vai ao branch adaptacao:
> git clone https://github.com/ICC453/frontend
> git checkout adaptacao

* No frontend, no index.html coloca:
> <script>src = "<novo_nome>"<\script>.

* No package.json, em compile 2 coloca o <novo-nome>.
* Mudar email e password em dist2/myapp.js para:
  * Email: nabson.paiva@icomp.ufam.edu.br
  * Senha: 
* Executar na pasta sdk:
> npm i
> npm run compile1
> npm run compile2

## Sobre o trabalho
* No evaluator.evaluate eu ponho o algoritmo de adaptação no arquivo **dist2/myapp.js**.
* Sempre que mudar algum arquivo tem que dar o compile2, caso seja JS.
 * Se for ts, roda o compile1 antes.

* Já está com a banda atual, aí preciso pesquisar para pôr o bufer e outras.
* Nos eventos de log, verificar se o Logger tá setado, como o primeiro.
* Quando tiver pronto, altera a url no enviroment.js para poder falar com a API direito.
* O buffer funciona pegando o intervalo em segundos do vídeo guardado, então se for pequeno, diminui a qualidade.

# Servidor para API:
* Clonar o repositório do backend e rodar:
> npm install
> tsc
> node dist/main.js
