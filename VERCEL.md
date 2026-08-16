# Deploy na Vercel

O projeto está preparado para o runtime Node.js da Vercel. Cada arquivo em `api/` é uma função serverless independente; não é necessário iniciar um servidor com `listen()`.[1]

## Opção A: deploy direto pelo computador

Instale ou execute a CLI da Vercel e faça login:

```bash
pnpm dlx vercel login
pnpm dlx vercel link
```

Adicione as variáveis fora do código. A chave Mikael deve ser cadastrada nos ambientes em que será usada:

```bash
pnpm dlx vercel env add MIKAEL_LICENSE_KEY production
pnpm dlx vercel env add MIKAEL_DEVICE_ID production
pnpm dlx vercel env add MIKAEL_BUILD production
pnpm dlx vercel env add MIKAEL_COMPONENT production
pnpm dlx vercel env add MIKAEL_BASE_URL production
pnpm dlx vercel env add CORS_ORIGIN production
```

Depois publique:

```bash
pnpm dlx vercel --prod
```

Não execute `git add .env`, `git add config.json` ou qualquer comando que publique valores reais. Variáveis da Vercel ficam fora do código-fonte e podem ser separadas entre Development, Preview e Production.[2]

## Opção B: GitHub e importação pela Vercel

Crie um repositório vazio no GitHub, extraia o ZIP e execute:

```bash
git init
git add .
git commit -m "Preparar API-only para Vercel"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git
git push -u origin main
```

Na Vercel, escolha **New Project**, importe o repositório e mantenha o diretório raiz na pasta do projeto. Depois cadastre as variáveis em **Project Settings → Environment Variables** e faça um novo deploy. O arquivo `vercel.json` limita as funções a 30 segundos e a Vercel detecta os handlers em `api/`.

## Endpoints publicados

| Método | Rota | Finalidade |
|---|---|---|
| `GET` | `/api/health` | Verifica se o deployment está ativo sem consultar o Mikael |
| `GET` ou `POST` | `/api/license` | Consulta o status da licença no Mikael |
| `POST` | `/api/normalize` | Valida uma lista de operações e gera um plano semântico |
| `POST` | `/api/solve` | Consulta licença, envia o payload ao Mikael e devolve operações e plano |

Teste o deployment sem credenciais:

```bash
curl https://SEU-PROJETO.vercel.app/api/health
```

Teste `/api/normalize` com um arquivo local de operações:

```bash
curl -X POST https://SEU-PROJETO.vercel.app/api/normalize \
  -H 'content-type: application/json' \
  --data @test/fixtures/operations.json
```

Para `/api/solve`, envie somente um payload que você esteja autorizado a processar:

```bash
curl -X POST https://SEU-PROJETO.vercel.app/api/solve \
  -H 'content-type: application/json' \
  --data @payload.json
```

A rota `/api/solve` não submete respostas à Efekta nem executa cliques. Ela apenas consulta o Mikael e devolve ações declarativas. Os endpoints autorizados de submissão da Efekta continuam sendo uma configuração separada, pois não foram fornecidos no pacote original.

## Segurança mínima

Em produção, troque `CORS_ORIGIN=*` pelo domínio real que consumirá a API. Não exponha `MIKAEL_LICENSE_KEY` em frontend, logs, respostas JSON, README ou repositório público. Se a chave for substituída, atualize a variável no ambiente correto e faça um novo deployment, pois alterações nas variáveis se aplicam a novas implantações.[2]

## Referências

[1]: https://vercel.com/docs/functions/runtimes/node-js "Vercel — Using the Node.js Runtime with Vercel Functions"
[2]: https://vercel.com/docs/environment-variables "Vercel — Environment variables"
