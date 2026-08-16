# Validação

A versão Vercel foi validada localmente em 16 de agosto de 2026.

| Verificação | Resultado |
|---|---|
| Testes unitários e de rotas | 7 aprovados, 0 falhas |
| Verificação sintática | Todos os módulos de `src/` e `api/` aprovados |
| Rota `/api/health` | Aprovada sem chamada externa |
| Rota `/api/normalize` | Aprovada com validação e plano semântico |
| Rota `/api/solve` | Aprovada com mocks de `license/check` e `agent/ops` |
| APIs de navegador/Tampermonkey no código | Nenhuma ocorrência em `api`, `src` e `test` |
| Chave de licença do arquivo original embutida | Não encontrada |
| Dry-run do adaptador HTTP | Aprovado; não envia request quando desabilitado |
| Configuração de deploy | `vercel.json`, `.env.example` e `VERCEL.md` incluídos |

Os testes não fazem chamada real ao Mikael e não usam a chave que estava no arquivo original. Isso evita consumir, expor ou invalidar uma licença real. A integração real deve ser executada somente com credenciais autorizadas configuradas como variáveis de ambiente na Vercel.

A auditoria confirmou que a implementação não contém `GM_*`, `unsafeWindow`, `document`, `window`, `querySelector`, `MutationObserver`, `dispatchEvent`, `click`, `XMLHttpRequest`, `localStorage`, `sessionStorage` ou `postMessage` no código de produção e nos testes.
