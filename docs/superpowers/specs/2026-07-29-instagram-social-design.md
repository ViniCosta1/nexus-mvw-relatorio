# Instagram — Coleta Diária e Página Social — Design

Data: 2026-07-29

## Objetivo

Receber métricas diárias do perfil de Instagram (enviadas por um cenário do
Make.com), armazená-las com a data de cada registro, e apresentá-las numa
página `/social` separada do relatório de tráfego pago: KPIs do período,
gráfico de evolução dia a dia e tabela diária.

A página deixa explícito que a coleta diária começou em **2026-07-29** e que
dias anteriores vieram de uma carga única do histórico da API do Instagram
(a Graph API retém insights de conta por ~30 dias).

Escopo: 1 perfil de Instagram (`@rafavendrami`), métricas de conta agregadas
por dia.

Fora de escopo (decidido explicitamente):

- Métricas por publicação/mídia (likes por post, ranking de melhores posts).
- Total absoluto de seguidores — `followers_count` não é métrica de insights
  e o cenário atual do Make não a envia. Guardamos só o saldo diário
  (`follows`/`unfollows`), e a página reporta "seguidores ganhos no período",
  nunca um total absoluto.
- Atribuição de venda a conteúdo orgânico do Instagram. Não existe rastreio
  que ligue os dois; mesma regra que já vale entre Meta Ads e Greenn — os
  números convivem lado a lado, sem métrica cruzada.

## Arquitetura

Mesmo padrão do webhook Meta já existente (`app/api/webhooks/meta/route.ts`):

- Cenário no Make roda o módulo **Instagram for Business — Get user
  insights** com `Period = Day`, transforma o resultado no contrato JSON
  abaixo (módulo "Transform to JSON") e faz `POST` para
  `/api/webhooks/instagram`.
- A rota valida o segredo, normaliza as linhas, faz upsert por
  `(ig_user_id, date)` e registra um `SyncRun`.
- A página `/social` lê exclusivamente do Postgres — nunca chama a Graph API
  na renderização.
- O agendamento é do Make. Nosso lado é passivo: se o cenário não rodar, não
  há dado novo, e o dia simplesmente não existe na tabela.

## Contrato do webhook

`POST /api/webhooks/instagram`

Autenticação: header `x-webhook-secret: $INSTAGRAM_WEBHOOK_SECRET` ou
query `?secret=`. Sem segredo configurado no servidor → `401` (mesma
postura fail-closed do webhook Meta). Segredo próprio, separado do
`META_WEBHOOK_SECRET`.

Corpo: um objeto único, um array, ou `{ "data": [ ... ] }` com N dias.

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

Regras de validação e normalização:

| Situação | Comportamento |
|---|---|
| `ig_user_id` ausente/vazio | Linha rejeitada, mensagem em `errors[]` |
| `date` ausente ou fora de `YYYY-MM-DD` | Linha rejeitada, mensagem em `errors[]` |
| `date` no futuro (> hoje, UTC) | Linha rejeitada, mensagem em `errors[]` |
| Métrica ausente, `null` ou não numérica | Vira `0` |
| Métrica com valor fracionário | Arredondada (`Math.round`) |
| `follows_net` ausente | Calculado como `follows - unfollows` |
| `follows_net` presente | Usado como veio; `follows`/`unfollows` gravados como vierem |
| Duas linhas para o mesmo `(ig_user_id, date)` no mesmo POST | Dedupe antes do upsert, última vence |
| Linha repetida em POST posterior | Upsert sobrescreve, não duplica |

Não há piso de data: o backfill dos ~30 dias que a API retém é aceito e
gravado. `ACCOUNT_START_DATE` (2026-06-01, regra do Meta Ads) **não** se
aplica ao Instagram — é uma regra sobre verba de outra gestão, não sobre
conteúdo orgânico.

Resposta (sempre `200` quando o corpo é JSON válido e autenticado):

```json
{ "ok": true, "processed": 3, "totalRows": 4, "errors": ["linha 2: date ausente"] }
```

Erros por linha nunca derrubam o lote inteiro. `400` só para JSON inválido,
`401` só para segredo errado/ausente.

## Modelo de dados (Prisma)

Enum existente ganha um valor:

```prisma
enum SyncSource {
  META
  SHEETS
  INSTAGRAM
}
```

Tabela nova:

```prisma
model InstagramDailyStat {
  id                String   @id @default(cuid())
  igUserId          String   @map("ig_user_id")
  username          String?
  date              DateTime @db.Date
  reach             Int      @default(0)
  views             Int      @default(0)
  totalInteractions Int      @default(0) @map("total_interactions")
  accountsEngaged   Int      @default(0) @map("accounts_engaged")
  likes             Int      @default(0)
  comments          Int      @default(0)
  saves             Int      @default(0)
  shares            Int      @default(0)
  replies           Int      @default(0)
  reposts           Int      @default(0)
  profileLinksTaps  Int      @default(0) @map("profile_links_taps")
  follows           Int      @default(0)
  unfollows         Int      @default(0)
  followsNet        Int      @default(0) @map("follows_net")
  raw               Json
  syncedAt          DateTime @default(now()) @map("synced_at")

  @@unique([igUserId, date])
  @@index([date])
  @@map("instagram_daily_stats")
}
```

Decisões:

- **Tabela larga, uma coluna por métrica** — em vez de EAV
  (`date, metric, value`) ou só um blob JSON. São ~12 métricas fixas; coluna
  tipada dá soma direta no Prisma, KPI e gráfico sem pivot manual. Métrica
  nova custa uma migração de uma coluna.
- **`raw Json`** guarda o payload cru recebido (mesmo papel de
  `Sale.rawRow`). Se amanhã quisermos uma métrica que hoje descartamos, dá
  para backfillar da coluna `raw` sem reprocessar o Make.
- **Sem FK** para `Campaign` ou `Sale`. Fluxo independente.
- **`syncedAt`** é o instante da primeira gravação — distingue backfill
  (gravado hoje, data antiga) de coleta corrente.

## Página `/social`

Rota: `app/(dashboard)/social/page.tsx`, mesmo esqueleto de `/campanhas`
(header + `FilterBar` + `Suspense` com skeleton + componente async de
conteúdo).

Navegação: quarto item na `DashboardNav`, rótulo "Social", ícone
`InstagramLogo` do Phosphor, depois de "Vendas & Clientes".

### Aviso de coleta

Componente `SocialCollectionNote`, irmão de `TrafficStartNote`, renderizado
no header da página:

> Coleta diária do Instagram iniciada em **29 de julho de 2026**. Dias
> anteriores vieram de uma carga única do histórico da API (limite de ~30
> dias).

A data vem de `SOCIAL_COLLECTION_START_DATE` em `lib/config.ts`, com
override por `SOCIAL_START_DATE` (`YYYY-MM-DD`), espelhando
`ACCOUNT_START_DATE`.

### KPIs

Quatro `KpiCard` (componente existente), cada um com comparação contra o
período anterior via `previousPeriod()`:

| Card | Cálculo |
|---|---|
| Seguidores ganhos | `Σ followsNet` (hint mostra `Σ follows` e `Σ unfollows`) |
| Alcance | `Σ reach` |
| Visualizações | `Σ views` |
| Interações | `Σ totalInteractions` |

### Gráfico de evolução

Client component com `recharts` (`ComposedChart`, já nas dependências):
linhas de alcance e visualizações + barras de seguidores ganhos por dia,
eixo X por data.

Dia sem registro fica como lacuna na linha (`null`), não como zero — falha do
cenário no Make não pode virar "alcance zero" no relatório.

### Tabela diária

Ordenada por data decrescente. Colunas: data, alcance, visualizações,
interações, contas engajadas, likes, comentários, salvos, compartilhamentos,
seguidores (saldo com sinal).

### Estado vazio

Sem nenhum registro no período: card explicando que a automação ainda não
enviou dados, com a data de início da coleta. Sem gráfico nem tabela vazios.

## Queries

`lib/queries/social.ts`, seguindo o estilo de `lib/queries/overview.ts`:

- `getSocialSummary(range): Promise<SocialSummary>` — totais do período e do
  período anterior (`previousPeriod`).
- `getSocialDaily(range): Promise<SocialDailyRow[]>` — linhas por dia,
  ordenadas por data.

Interpretação de `?from=&to=`: o `resolveRange` atual aplica `clampFrom`
internamente, elevando o início para `ACCOUNT_START_DATE`. Esse clamp existe
para a verba do Meta sob outra gestão e não se aplica ao Instagram, então
`resolveRange` ganha um parâmetro opcional `{ clamp = true }`; a página
social chama com `clamp: false`. Comportamento das páginas existentes não
muda (default continua clampando), e o teste atual de `resolveRange`
permanece válido, com casos novos para `clamp: false`.

## Tratamento de erro

- Webhook: erros por linha viram strings em `errors[]`, gravados truncados
  em `SyncRun.errorMessage` (10 primeiros, mesmo padrão do webhook Meta), com
  `status: ERROR` se houve qualquer erro, `SUCCESS` se nenhum.
- Página: erro de query propaga para o error boundary do Next; ausência de
  dados é estado vazio, não erro.

## Testes

Vitest, no padrão de `lib/queries/overview.test.ts`:

- Normalização do payload: objeto único, array e `{data:[...]}`; métrica
  ausente → `0`; valor string numérica → número; `followsNet` derivado de
  `follows - unfollows` quando ausente e preservado quando presente.
- Rejeição: `ig_user_id` ausente, `date` ausente, `date` mal formatada,
  `date` futura — cada uma produz erro e não conta em `processed`.
- Dedupe: duas linhas do mesmo `(ig_user_id, date)` no mesmo lote resultam em
  uma gravação, a última.
- `getSocialSummary`: soma correta e período anterior correto para um range
  conhecido.

## Configuração

| Variável | Uso |
|---|---|
| `INSTAGRAM_WEBHOOK_SECRET` | Segredo do webhook. Sem ele, a rota responde 401. |
| `SOCIAL_START_DATE` | Opcional, `YYYY-MM-DD`. Default `2026-07-29`. Só afeta o texto do aviso, não filtra dados. |

No Make, o módulo HTTP aponta hoje para `mvw-report.free.beeceptor.com`
(teste). Ao subir, trocar para `https://<domínio>/api/webhooks/instagram` com
o header `x-webhook-secret`.
