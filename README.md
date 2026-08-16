# Mikael API-only

Esta é uma recriação **sem Tampermonkey, DOM, cliques, eventos de mouse, `MutationObserver`, frames ou automação visual**. O projeto usa HTTP/JSON para consultar o serviço Mikael, validar a licença, obter as operações e convertê-las em ações semânticas que um adaptador autorizado da Efekta pode enviar por API.

> O pacote original não contém a documentação de uma API oficial da Efekta. Ele intercepta respostas do navegador e depois envia o JSON para o serviço Mikael. Por isso, esta versão preserva o contrato observável do Mikael e deixa os requests de submissão da Efekta configuráveis, sem inventar endpoints.

## Fluxo

| Etapa | Implementação | Resultado |
|---|---|---|
| Validação | `GET https://mikael.store/api/license/check` | Confirma `ok: true` para a chave e o dispositivo configurados |
| Obtenção de operações | `POST https://mikael.store/api/agent/ops` com `{ k, d, payload }` | Recebe `ops` em JSON |
| Normalização | `src/ops.js` | Converte `match-pair`, `fill-gap`, `categorize`, `sequence` e `choose` em ações semânticas |
| Leitura da Efekta | `src/efekta-http.js` | Executa um request HTTP configurável |
| Submissão | `src/efekta-http.js` | Executa somente endpoints configurados pelo usuário; por padrão usa dry-run |

As operações semânticas não representam cliques. Elas são dados, por exemplo `matching.answer` ou `multiple-choice.answer`, e precisam ser mapeadas para o contrato HTTP autorizado da plataforma.

## Instalação

Requer Node.js 20 ou superior. Não há dependências externas de npm.

```bash
cp config.example.json config.json
npm test
npm run check
```

A chave não deve ser gravada no repositório. Prefira variáveis de ambiente:

```bash
export MIKAEL_LICENSE_KEY='sua-chave-autorizada'
export MIKAEL_DEVICE_ID='api-device-local'
```

O `deviceId` deve permanecer estável entre execuções para representar a mesma instalação lógica.

## Uso do serviço Mikael

Para validar somente a licença:

```bash
node src/cli.js license --config config.json
```

Para enviar um payload JSON já capturado de maneira autorizada:

```bash
node src/cli.js ops --payload payload.json --config config.json > operations.json
```

Para validar operações e gerar um plano API-only:

```bash
node src/cli.js normalize --ops operations.json > plan.json
```

O comando `plan` combina validação, consulta ao Mikael e normalização:

```bash
node src/cli.js plan --payload payload.json --config config.json
```

## Integração HTTP da Efekta

Preencha `config.json` somente com endpoints, headers e corpos de requisição que você esteja autorizado a usar. A configuração de exemplo contém placeholders deliberados. O campo `lessonRequest` deve retornar o JSON da lição ou atividade que será enviado ao Mikael. Os campos em `actionRequests` mapeiam cada ação semântica a um request HTTP.

O comando abaixo lê a lição, consulta o Mikael e mostra quais requests seriam enviados, sem enviar respostas:

```bash
node src/cli.js efekta --config config.json
```

Somente após revisar os endpoints e os corpos, o usuário pode habilitar envio explícito:

```bash
node src/cli.js efekta --config config.json --send
```

A versão atual não aceita login, senha, cookies ou tokens por prompt e não tenta obtê-los no navegador. Use um token de serviço, OAuth ou header de sessão fornecido pelo sistema e permitido pelo responsável da plataforma. Para sessões baseadas em cookie, mantenha o arquivo de configuração fora do Git e com permissões restritas.

## Arquitetura

`src/mikael-client.js` implementa o contrato observado no pacote para licença e operações, com timeout, erros tipados e injeção de `fetch` para testes. `src/ops.js` valida e normaliza as operações e também extrai informações de respostas JSON sem depender da página. `src/efekta-http.js` é um adaptador HTTP genérico com templates `{{campo}}`, execução dry-run e envio opcional. `src/flow.js` expõe o fluxo completo para integração em outro programa Node.js. `src/cli.js` integra os componentes em comandos reproduzíveis.

## Uso como biblioteca

```js
import { MikaelClient } from './src/mikael-client.js';
import { EfektaHttpClient } from './src/efekta-http.js';
import { executeApiOnlyFlow } from './src/flow.js';

const mikael = new MikaelClient({
  licenseKey: process.env.MIKAEL_LICENSE_KEY,
  deviceId: process.env.MIKAEL_DEVICE_ID,
});
const efekta = new EfektaHttpClient({
  baseUrl: 'https://learn.better.efekta.com',
  headers: { Authorization: `Bearer ${process.env.EFEKTA_TOKEN}` },
});

const result = await executeApiOnlyFlow({
  mikael,
  efekta,
  lessonRequest: { method: 'POST', path: '/ENDPOINT_AUTORIZADO', body: {} },
  actionRequests: {},
  send: false,
});
console.log(result.plan);
```

## Hospedagem na Vercel

O projeto já inclui funções serverless em `api/`, `vercel.json`, `.env.example` e o guia completo em [`VERCEL.md`](./VERCEL.md). O deploy pode ser feito diretamente pela CLI ou, posteriormente, por um repositório GitHub importado na Vercel.

## Limites conhecidos

A API pública da Efekta não foi encontrada nas páginas públicas consultadas. O pacote recebido não informa o método, a URL completa, os headers, o corpo ou o mecanismo de autenticação dos requests que submetem respostas à Efekta. Consequentemente, o projeto entregue está funcional para o contrato Mikael e para a transformação API-only, mas a execução ponta a ponta depende do preenchimento desses adaptadores com um contrato oficial ou autorizado.

O serviço Mikael anunciado publicamente descreve um script que roda no navegador, mas não publica neste site uma especificação do `api/agent/ops`. A implementação, portanto, trata o formato observado no arquivo como um contrato privado sujeito a mudanças e valida todas as respostas antes de usá-las.

## Referências

[1]: https://mikael.store/ "Mikael Dev — página pública do serviço"
[2]: https://www.efekta.com/en/ "Efekta — página institucional"
[3]: https://www.efekta.com/en/product/ "Efekta — página pública do produto"
[4]: https://vercel.com/docs/functions/runtimes/node-js "Vercel — runtime Node.js"
[5]: https://vercel.com/docs/environment-variables "Vercel — variáveis de ambiente"
