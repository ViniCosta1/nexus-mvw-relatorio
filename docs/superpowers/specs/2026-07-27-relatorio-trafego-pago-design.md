# Relatório de Campanhas de Tráfego Pago (Meta Ads + Greenn) — Design

Data: 2026-07-27

## Objetivo

Sistema web que conecta performance de campanhas do Meta Ads a vendas reais da
plataforma de checkout Greenn (via planilha, já que Greenn não tem API), e
apresenta um relatório executivo para gestores: quanto cada campanha
performou, qual performou mais, quem vendeu mais, dados dos clientes (quem
são, quem vendeu, por quanto, canal de venda), com filtros por data,
cliente e vendedor. Público-alvo não analisa dado bruto — quer conclusões
prontas.

Escopo: 1 conta de anúncio Meta única, 1 planilha Greenn única. Sem
suporte multi-cliente/multi-conta nesta versão.

## Arquitetura

Tudo dentro do monorepo Next.js atual (`apps/web`), sem serviço externo
separado:

- **Next.js API routes** fazem a sincronização (Meta Graph API + Google
  Sheets API) e gravam num banco Postgres.
- **Vercel Cron** dispara sync a cada 15 minutos.
- **Botão manual "Atualizar agora"** no dashboard chama a mesma rota de
  sync sob demanda (mesma lógica, gatilho diferente).
- **Postgres (Neon, serverless)** via **Prisma** como storage/histórico.
  Dashboard lê do Postgres — nunca chama Meta/Sheets diretamente na
  renderização.
- Sem autenticação/login nesta versão (uso interno, deploy Vercel).

Alternativas descartadas: worker separado (overkill para 1 conta única,
reavaliar se expandir pra multi-cliente); ETL externo tipo n8n (perde
controle sobre a lógica crítica de cruzamento UTM).

## Modelo de dados (Postgres via Prisma)

```
Campaign
  id                 (pk, cuid)
  meta_campaign_id   (string, unique)
  name               (string)
  objective          (string, nullable)
  status             (string)  -- ACTIVE, PAUSED, etc (espelha Meta)
  created_at, updated_at

CampaignInsightDaily
  id            (pk, cuid)
  campaign_id   (fk -> Campaign)
  date          (date)
  spend         (decimal)
  impressions   (int)
  clicks        (int)
  reach         (int)
  ctr           (decimal)
  cpc           (decimal)
  cpm           (decimal)
  synced_at     (datetime)
  @@unique([campaign_id, date])

Sale
  id             (pk, cuid)
  external_id    (string, unique)  -- chave da linha na planilha, evita duplicata
  client_name    (string)
  client_email   (string, nullable)
  client_phone   (string, nullable)
  seller_name    (string)
  product_name   (string)
  amount         (decimal)
  sale_date      (date)
  utm_source     (string, nullable)
  utm_medium     (string, nullable)
  utm_campaign   (string, nullable)
  utm_content    (string, nullable)
  channel        (string)  -- derivado (ex: "Meta Ads", "Orgânico", "Direto")
  campaign_id    (fk -> Campaign, nullable)  -- resolvido no momento do sync
  raw_row        (jsonb)  -- linha bruta da planilha, auditoria/debug
  synced_at      (datetime)

SyncRun
  id              (pk, cuid)
  source          (enum: META | SHEETS)
  started_at, finished_at
  status          (enum: SUCCESS | ERROR | RUNNING)
  rows_processed  (int)
  error_message   (string, nullable)
```

Estrutura exata das colunas da planilha Greenn e formato das UTMs serão
confirmados quando o usuário fornecer uma planilha de exemplo — o schema
acima é suficiente para acomodar o ajuste sem migração estrutural (campos
UTM já cobertos).

## Cruzamento venda → campanha

`Sale.utm_campaign` é comparado contra `Campaign.name` (ou
`meta_campaign_id`, se a UTM carregar o id numérico) no momento do sync de
vendas. Quando não há correspondência, a venda fica com `campaign_id =
null` e é agrupada como **"Não atribuído"** no relatório — não desaparece,
fica visível como categoria própria (permite auditar UTM quebrada/campanha
pausada).

## Integrações

**Meta Ads (Graph API / Marketing API)**
- Nível de dado: **campanha** (não desce a conjunto de anúncios ou anúncio
  individual nesta versão).
- Métricas: spend, impressions, clicks, reach, ctr, cpc, cpm — por
  campanha, por dia (`CampaignInsightDaily`).
- Autenticação: token de acesso System User com permissão `ads_read`,
  App ID/Secret. **Pendente do usuário**: App ID, App Secret, token,
  ID da conta de anúncio.

**Google Sheets**
- Leitura **live via API** (não upload manual), usando `googleapis` +
  credencial de service account.
- Planilha precisa ser compartilhada (permissão de leitura) com o e-mail
  da service account gerada. **Pendente do usuário**: ID da planilha,
  planilha de exemplo com as colunas reais.

## Sincronização

- Cron a cada 15 minutos (Vercel Cron) roda sync Meta + sync Sheets.
- Botão manual no dashboard dispara a mesma rota sob demanda, com estado
  de loading e mensagem de resultado (sucesso/erro).
- Cada execução grava um `SyncRun` — dashboard mostra timestamp da última
  sync bem-sucedida por fonte. Se sync falhar (rate limit, planilha
  renomeada/inacessível), dashboard **não quebra**: continua mostrando o
  último dado bom, com aviso de erro visível.

## Dashboard / UI

**Páginas:**
1. **Visão Geral** (home) — KPIs no topo (investido total, vendido total,
   ROAS geral, ticket médio, nº vendas), bloco de Insights automáticos,
   gráfico investimento × vendas ao longo do período, ranking de campanhas
   (tabela ordenável), ranking de vendedores (quem vendeu mais / quanto).
2. **Campanhas** — tabela detalhada por campanha, com drill-down (painel
   lateral com as vendas atribuídas àquela campanha).
3. **Vendas / Clientes** — tabela de vendas: cliente, vendedor, valor,
   produto, canal, data, campanha de origem. Exportável (CSV).

**Filtros globais** (barra fixa, válidos em todas as páginas): período
(date range), cliente (busca por nome), vendedor (busca por nome),
campanha (select). Ficam na URL (query params) para permitir link direto
a uma visão filtrada.

**Insights automáticos** (regras sobre os dados já calculados, não IA
generativa): melhor ROAS do período, campanha com gasto alto e conversão
baixa, variação percentual vs período anterior, alerta de "Não atribuído"
acima de um limiar.

**Componentes (shadcn, style `radix-lyra`, ícones Phosphor já configurados):**
`Card`, `DataTable` (TanStack Table), gráficos (Recharts via shadcn
charts), `DateRangePicker`, `Combobox` (cliente/vendedor), `Sheet`/`Drawer`
(drill-down), `Button` (refresh manual com loading state).

**Tema:** verde / branco / preto extraído do logo MVW
(`apps/web/public/logo-mvw.webp`) — paleta oklch derivada das cores reais
do logo, aplicada em `packages/ui/src/styles/globals.css` (substitui o
tema neutro atual), suportando light/dark.

## Fora de escopo (esta versão)

- Login/autenticação
- Múltiplas contas de anúncio / múltiplos clientes
- Granularidade de conjunto de anúncios ou anúncio individual
- Upload manual de Excel (fica só via Google Sheets API)
- Geração de insights por IA generativa (fica em regras determinísticas)

## Pendências do usuário (bloqueiam implementação real, não o plano)

- Meta: App ID, App Secret, token de acesso System User (`ads_read`), ID
  da conta de anúncio
- Google Sheets: ID da planilha, e planilha de exemplo com colunas reais
  (a estrutura assumida acima pode mudar)
