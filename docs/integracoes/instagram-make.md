# Instagram → Relatório (cenário Make.com)

Cenário: **[RELATORIO] | CAPTURA DE DADOS INSTAGRAM**

## Módulos

1. **Instagram for Business (Facebook login) — Get user insights**
   - Page: `rafavendrami (@rafavendrami)`
   - Period: `Day`
   - Metrics: Reach, Views, Total interactions, Accounts engaged, Likes,
     Comments, Saves, Shares, Replies, Follows and unfollows, Profile links taps,
     Reposts.
2. **Transform to JSON** — monta o corpo no contrato abaixo.
3. **HTTP — Make a request**
   - Method: `POST`
   - URL: `https://<domínio>/api/webhooks/instagram`
   - Header: `x-webhook-secret: <INSTAGRAM_WEBHOOK_SECRET>`
   - Body type: `Raw`, content type `application/json`

## Contrato

Um objeto, um array de objetos, ou `{ "data": [ ... ] }`.

```json
{
  "ig_user_id": "17841400000000000",
  "username": "rafavendrami",
  "date": "2026-07-29",
  "reach": 1234,
  "views": 5678,
  "total_interactions": 210,
  "accounts_engaged": 180,
  "likes": 150,
  "comments": 20,
  "saves": 25,
  "shares": 15,
  "replies": 5,
  "reposts": 2,
  "profile_links_taps": 12,
  "follows": 30,
  "unfollows": 4
}
```

- `ig_user_id` e `date` (`YYYY-MM-DD`) são obrigatórios; sem eles a linha é
  recusada e aparece em `errors[]` na resposta.
- Qualquer métrica ausente vira `0`. Nunca derruba o lote.
- `follows_net` é opcional; sem ele o sistema calcula `follows - unfollows`.
- Data futura é recusada. Datas passadas são aceitas (backfill).
- Reenviar o mesmo dia sobrescreve o registro — pode rodar o cenário à vontade.

## Resposta

```json
{ "ok": true, "processed": 3, "totalRows": 4, "errors": ["linha 2: ig_user_id ausente"] }
```

`401` = segredo errado ou ausente. `400` = corpo não é JSON válido.

Cada execução grava um registro em `sync_runs` com `source = INSTAGRAM`.
