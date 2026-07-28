# Fundação: Banco de Dados, Dados Mockados, Tema e Página Visão Geral — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up the Postgres schema, seed it with realistic mock data, apply the MVW (verde/branco/preto) theme, and ship a working "Visão Geral" report page with real KPIs, deterministic insights, a spend-vs-sales chart, and campaign/seller rankings — fully testable today, with zero external credentials (Meta/Google) required.

**Architecture:** Prisma + Postgres (Neon, already provisioned in `.env` as `DATABASE_URL`) inside `apps/web`. Server Components query Prisma directly (no API routes needed for reads in this plan). A pure, unit-tested rules engine (`lib/insights.ts`) turns aggregated numbers into manager-readable insight sentences. Theme colors are derived from the real MVW logo (extracted via OKLCH conversion of the dominant green, documented below) applied to the existing shadcn CSS variables.

**Tech Stack:** Next.js 16 (App Router, already in repo), Prisma + `@prisma/client`, PostgreSQL (Neon), Recharts, Vitest (unit tests for the insights engine), Tailwind v4 + shadcn (`radix-lyra` style, already configured), `tsx` for running the seed script, `date-fns`.

## Global Constraints

- DB connection string already exists at `/Users/laviniasiviero/Projetos/nexus-relatorio-mvw/.env` as `DATABASE_URL` — do not overwrite it.
- No authentication in this plan (per spec, out of scope).
- No Meta/Google integration in this plan — all data comes from the seed script. Real sync is a separate later plan.
- Money fields use Prisma `Decimal`; convert with `Number(value)` before doing JS arithmetic.
- Package manager is `bun` (see root `package.json` `packageManager: "bun@1.3.14"`). Use `bun add` / `bun run`, not `npm`/`pnpm`.
- shadcn components are added via `bunx shadcn@latest add <name>` run from `apps/web/` (uses `apps/web/components.json`, style `radix-lyra`, icon library `phosphor`).
- Follow existing alias conventions: `@/components`, `@/lib`, `@/hooks` (app-local) vs `@workspace/ui/*` (shared package).

---

### Task 1: Install dependencies and initialize Prisma

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/prisma/schema.prisma` (placeholder datasource only, models come in Task 2)

**Interfaces:**
- Produces: `DATABASE_URL` env binding used by every later task; `bun run db:push`, `bun run db:seed`, `bun run db:studio` scripts.

- [ ] **Step 1: Install dependencies**

Run from `apps/web/`:
```bash
bun add @prisma/client recharts date-fns
bun add -d prisma tsx vitest
```

- [ ] **Step 2: Initialize Prisma schema file**

Create `apps/web/prisma/schema.prisma`:
```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

- [ ] **Step 3: Add scripts to `apps/web/package.json`**

Add inside `"scripts"`:
```json
"db:push": "prisma db push",
"db:seed": "tsx prisma/seed.ts",
"db:studio": "prisma studio"
```

Add a top-level key (sibling of `"scripts"`) so `prisma db seed` and tooling can find the seed command:
```json
"prisma": {
  "seed": "tsx prisma/seed.ts"
}
```

- [ ] **Step 4: Verify Prisma can reach the database**

Run from `apps/web/`:
```bash
bunx prisma validate
```
Expected: `The schema at prisma/schema.prisma is valid 🚀`

- [ ] **Step 5: Commit**

```bash
git add apps/web/package.json apps/web/prisma/schema.prisma bun.lock
git commit -m "chore: init prisma with postgres datasource"
```

---

### Task 2: Define the Prisma schema (Campaign, CampaignInsightDaily, Sale, SyncRun)

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

**Interfaces:**
- Produces: Prisma models `Campaign`, `CampaignInsightDaily`, `Sale`, `SyncRun`, enums `SyncSource`, `SyncStatus` — consumed by seed script (Task 4) and query layer (Task 6).

- [ ] **Step 1: Append models to `apps/web/prisma/schema.prisma`**

```prisma
model Campaign {
  id             String   @id @default(cuid())
  metaCampaignId String   @unique @map("meta_campaign_id")
  name           String
  objective      String?
  status         String
  createdAt      DateTime @default(now()) @map("created_at")
  updatedAt      DateTime @updatedAt @map("updated_at")

  insights CampaignInsightDaily[]
  sales    Sale[]

  @@map("campaigns")
}

model CampaignInsightDaily {
  id          String   @id @default(cuid())
  campaignId  String   @map("campaign_id")
  campaign    Campaign @relation(fields: [campaignId], references: [id])
  date        DateTime @db.Date
  spend       Decimal  @db.Decimal(12, 2)
  impressions Int
  clicks      Int
  reach       Int
  ctr         Decimal  @db.Decimal(6, 4)
  cpc         Decimal  @db.Decimal(10, 4)
  cpm         Decimal  @db.Decimal(10, 4)
  syncedAt    DateTime @default(now()) @map("synced_at")

  @@unique([campaignId, date])
  @@map("campaign_insights_daily")
}

model Sale {
  id          String    @id @default(cuid())
  externalId  String    @unique @map("external_id")
  clientName  String    @map("client_name")
  clientEmail String?   @map("client_email")
  clientPhone String?   @map("client_phone")
  sellerName  String    @map("seller_name")
  productName String    @map("product_name")
  amount      Decimal   @db.Decimal(12, 2)
  saleDate    DateTime  @db.Date @map("sale_date")
  utmSource   String?   @map("utm_source")
  utmMedium   String?   @map("utm_medium")
  utmCampaign String?   @map("utm_campaign")
  utmContent  String?   @map("utm_content")
  channel     String
  campaignId  String?   @map("campaign_id")
  campaign    Campaign? @relation(fields: [campaignId], references: [id])
  rawRow      Json      @map("raw_row")
  syncedAt    DateTime  @default(now()) @map("synced_at")

  @@map("sales")
}

enum SyncSource {
  META
  SHEETS
}

enum SyncStatus {
  SUCCESS
  ERROR
  RUNNING
}

model SyncRun {
  id            String     @id @default(cuid())
  source        SyncSource
  startedAt     DateTime   @default(now()) @map("started_at")
  finishedAt    DateTime?  @map("finished_at")
  status        SyncStatus
  rowsProcessed Int        @default(0) @map("rows_processed")
  errorMessage  String?    @map("error_message")

  @@map("sync_runs")
}
```

- [ ] **Step 2: Push schema to the database and generate the client**

Run from `apps/web/`:
```bash
bunx prisma db push
```
Expected: ends with `Your database is now in sync with your Prisma schema.` and `Generated Prisma Client`.

- [ ] **Step 3: Verify tables exist and are queryable**

Run from `apps/web/`:
```bash
bunx tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
Promise.all([
  prisma.campaign.count(),
  prisma.campaignInsightDaily.count(),
  prisma.sale.count(),
  prisma.syncRun.count(),
]).then((counts) => {
  console.log('counts', counts)
  process.exit(0)
})
"
```
Expected: `counts [ 0, 0, 0, 0 ]` (tables exist, empty — no error thrown).

- [ ] **Step 4: Commit**

```bash
git add apps/web/prisma/schema.prisma
git commit -m "feat: define campaign, sale and sync_run prisma models"
```

---

### Task 3: Prisma client singleton

**Files:**
- Create: `apps/web/lib/db.ts`

**Interfaces:**
- Produces: `prisma` (singleton `PrismaClient` instance) — imported by seed verification, query layer (Task 6), and all future API routes.

- [ ] **Step 1: Create the singleton**

`apps/web/lib/db.ts`:
```ts
import { PrismaClient } from "@prisma/client"

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient }

export const prisma = globalForPrisma.prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
```

- [ ] **Step 2: Verify it compiles**

Run from `apps/web/`:
```bash
bunx tsc --noEmit
```
Expected: no errors referencing `lib/db.ts`.

- [ ] **Step 3: Commit**

```bash
git add apps/web/lib/db.ts
git commit -m "feat: add prisma client singleton"
```

---

### Task 4: Seed script with realistic mock data

**Files:**
- Create: `apps/web/prisma/seed.ts`

**Interfaces:**
- Consumes: Prisma models from Task 2 (`Campaign`, `CampaignInsightDaily`, `Sale`, `SyncRun`, `SyncSource`, `SyncStatus`).
- Produces: seeded rows consumed by the query layer (Task 6) and the Visão Geral page (Task 10-13). 6 campaigns, 30 days of daily insights each (180 rows), 150 sales (~85% attributed to a campaign via `utmCampaign` matching `slugify(campaign.name)`, ~15% `channel: "Orgânico/Direto"` with `campaignId: null`).

- [ ] **Step 1: Write the seed script**

`apps/web/prisma/seed.ts`:
```ts
import { PrismaClient, SyncSource, SyncStatus } from "@prisma/client"

const prisma = new PrismaClient()

function mulberry32(seed: number) {
  return function random() {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rand = mulberry32(20260727)

function slugify(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
}

const CAMPAIGNS = [
  { name: "Lançamento Método X - Topo", objective: "OUTCOME_LEADS" },
  { name: "Retargeting - Carrinho Abandonado", objective: "OUTCOME_SALES" },
  { name: "Prospecção Lookalike 1%", objective: "OUTCOME_LEADS" },
  { name: "Institucional - Reconhecimento", objective: "OUTCOME_AWARENESS" },
  { name: "Webinar Gratuito - Captação", objective: "OUTCOME_LEADS" },
  { name: "Black Friday - Conversão", objective: "OUTCOME_SALES" },
] as const

const PRODUCTS = ["Curso Método X", "Mentoria Individual", "Assinatura Anual", "Ebook Avançado"]
const SELLERS = ["Ana Souza", "Bruno Lima", "Carla Mendes", "Diego Alves"]
const FIRST_NAMES = ["Mariana", "João", "Fernanda", "Lucas", "Patrícia", "Rafael", "Camila", "Thiago", "Juliana", "Eduardo"]
const LAST_NAMES = ["Oliveira", "Santos", "Costa", "Pereira", "Ferreira", "Almeida", "Ribeiro", "Carvalho"]

const DAYS = 30
const TOTAL_SALES = 150

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)]
}

async function main() {
  await prisma.sale.deleteMany()
  await prisma.campaignInsightDaily.deleteMany()
  await prisma.syncRun.deleteMany()
  await prisma.campaign.deleteMany()

  const campaigns = []
  for (let i = 0; i < CAMPAIGNS.length; i++) {
    const c = CAMPAIGNS[i]
    const campaign = await prisma.campaign.create({
      data: {
        metaCampaignId: `12080000000${i}`,
        name: c.name,
        objective: c.objective,
        status: i === CAMPAIGNS.length - 1 ? "PAUSED" : "ACTIVE",
      },
    })
    campaigns.push(campaign)
  }

  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  for (const campaign of campaigns) {
    const baseSpend = 80 + rand() * 220
    for (let d = DAYS - 1; d >= 0; d--) {
      const date = new Date(today)
      date.setUTCDate(date.getUTCDate() - d)
      const spend = Math.round((baseSpend + (rand() - 0.5) * 40) * 100) / 100
      const impressions = Math.round(spend * (30 + rand() * 20))
      const clicks = Math.round(impressions * (0.008 + rand() * 0.02))
      const reach = Math.round(impressions * (0.6 + rand() * 0.2))
      const ctr = impressions > 0 ? clicks / impressions : 0
      const cpc = clicks > 0 ? spend / clicks : 0
      const cpm = impressions > 0 ? (spend / impressions) * 1000 : 0

      await prisma.campaignInsightDaily.create({
        data: {
          campaignId: campaign.id,
          date,
          spend,
          impressions,
          clicks,
          reach,
          ctr: Number(ctr.toFixed(4)),
          cpc: Number(cpc.toFixed(4)),
          cpm: Number(cpm.toFixed(4)),
        },
      })
    }
  }

  for (let i = 0; i < TOTAL_SALES; i++) {
    const attributed = rand() < 0.85
    const campaign = attributed ? pick(campaigns) : null
    const daysAgo = Math.floor(rand() * DAYS)
    const saleDate = new Date(today)
    saleDate.setUTCDate(saleDate.getUTCDate() - daysAgo)

    const clientName = `${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`
    const seller = pick(SELLERS)
    const product = pick(PRODUCTS)
    const amount = Math.round((150 + rand() * 1850) * 100) / 100
    const utmCampaign = campaign ? slugify(campaign.name) : "organico-direto"

    await prisma.sale.create({
      data: {
        externalId: `greenn-mock-${i + 1}`,
        clientName,
        clientEmail: `${slugify(clientName)}@example.com`,
        clientPhone: `+55 11 9${String(Math.floor(rand() * 100000000)).padStart(8, "0")}`,
        sellerName: seller,
        productName: product,
        amount,
        saleDate,
        utmSource: campaign ? "facebook" : "direct",
        utmMedium: campaign ? "paid-social" : "none",
        utmCampaign,
        channel: campaign ? "Meta Ads" : "Orgânico/Direto",
        campaignId: campaign?.id ?? null,
        rawRow: {
          "Nome do Cliente": clientName,
          Vendedor: seller,
          Produto: product,
          Valor: amount,
          Data: saleDate.toISOString().slice(0, 10),
          utm_campaign: utmCampaign,
        },
      },
    })
  }

  await prisma.syncRun.create({
    data: {
      source: SyncSource.META,
      finishedAt: new Date(),
      status: SyncStatus.SUCCESS,
      rowsProcessed: campaigns.length * DAYS,
    },
  })
  await prisma.syncRun.create({
    data: {
      source: SyncSource.SHEETS,
      finishedAt: new Date(),
      status: SyncStatus.SUCCESS,
      rowsProcessed: TOTAL_SALES,
    },
  })

  console.log(
    `Seed ok: ${campaigns.length} campanhas, ${campaigns.length * DAYS} insights, ${TOTAL_SALES} vendas`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

- [ ] **Step 2: Run the seed and verify the printed counts**

Run from `apps/web/`:
```bash
bun run db:seed
```
Expected: `Seed ok: 6 campanhas, 180 insights, 150 vendas`

- [ ] **Step 3: Verify referential invariants**

Run from `apps/web/`:
```bash
bunx tsx -e "
import { PrismaClient } from '@prisma/client'
const prisma = new PrismaClient()
async function main() {
  const total = await prisma.sale.count()
  const unattributed = await prisma.sale.count({ where: { campaignId: null } })
  const orphaned = await prisma.sale.count({ where: { campaignId: { not: null }, campaign: null } })
  console.log({ total, unattributed, orphaned })
  if (orphaned !== 0) throw new Error('orphaned sales found')
  if (unattributed === 0 || unattributed === total) throw new Error('unattributed ratio looks wrong')
}
main().finally(() => prisma.\$disconnect())
"
```
Expected: prints counts with `orphaned: 0` and `unattributed` roughly 15% of `total` (~22 of 150), no thrown error.

- [ ] **Step 4: Commit**

```bash
git add apps/web/prisma/seed.ts
git commit -m "feat: add mock data seed script for campaigns, insights and sales"
```

---

### Task 5: Insights engine (pure, unit-tested)

**Files:**
- Create: `apps/web/lib/insights.ts`
- Test: `apps/web/lib/insights.test.ts`
- Modify: `apps/web/package.json` (add `"test": "vitest run"` script)

**Interfaces:**
- Produces: `buildInsights(input: BuildInsightsInput): Insight[]`, types `CampaignPerformance`, `Insight`, `BuildInsightsInput` — consumed by the Visão Geral page (Task 11) via the query layer (Task 6).

- [ ] **Step 1: Add the test script**

Add to `apps/web/package.json` `"scripts"`:
```json
"test": "vitest run"
```

- [ ] **Step 2: Write the failing test**

`apps/web/lib/insights.test.ts`:
```ts
import { describe, expect, it } from "vitest"
import { buildInsights } from "./insights"

const baseCampaigns = [
  { campaignId: "1", name: "Campanha A", spend: 1000, revenue: 4000 },
  { campaignId: "2", name: "Campanha B", spend: 3000, revenue: 1500 },
  { campaignId: "3", name: "Campanha C", spend: 500, revenue: 900 },
]

describe("buildInsights", () => {
  it("aponta a campanha com melhor ROAS", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 0,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 6400,
    })
    const best = insights.find((i) => i.id === "best-roas")
    expect(best).toBeDefined()
    expect(best?.message).toContain("Campanha A")
    expect(best?.message).toContain("4.0x")
  })

  it("alerta campanha com gasto alto e retorno baixo", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 0,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 6400,
    })
    const warning = insights.find((i) => i.id === "low-return-high-spend")
    expect(warning).toBeDefined()
    expect(warning?.message).toContain("Campanha B")
  })

  it("calcula variacao percentual vs periodo anterior", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 0,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 3200,
    })
    const trend = insights.find((i) => i.id === "period-trend")
    expect(trend?.message).toContain("100%")
    expect(trend?.tone).toBe("positive")
  })

  it("alerta quando vendas nao atribuidas passam do limiar", () => {
    const insights = buildInsights({
      campaigns: baseCampaigns,
      unattributedRevenue: 2000,
      totalRevenue: 6400,
      currentPeriodRevenue: 6400,
      previousPeriodRevenue: 6400,
    })
    const unattributed = insights.find((i) => i.id === "unattributed-share")
    expect(unattributed).toBeDefined()
  })
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run from `apps/web/`:
```bash
bun run test
```
Expected: FAIL — `Cannot find module './insights'` (file doesn't exist yet).

- [ ] **Step 4: Implement the insights engine**

`apps/web/lib/insights.ts`:
```ts
export interface CampaignPerformance {
  campaignId: string
  name: string
  spend: number
  revenue: number
}

export interface Insight {
  id: string
  tone: "positive" | "warning" | "neutral"
  message: string
}

export interface BuildInsightsInput {
  campaigns: CampaignPerformance[]
  unattributedRevenue: number
  totalRevenue: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

const HIGH_SPEND_SHARE_THRESHOLD = 0.25
const LOW_RETURN_SHARE_RATIO = 0.5
const UNATTRIBUTED_SHARE_THRESHOLD = 0.2

export function buildInsights(input: BuildInsightsInput): Insight[] {
  const insights: Insight[] = []
  const { campaigns, unattributedRevenue, totalRevenue, currentPeriodRevenue, previousPeriodRevenue } = input

  const withRoas = campaigns
    .filter((c) => c.spend > 0)
    .map((c) => ({ ...c, roas: c.revenue / c.spend }))

  if (withRoas.length > 0) {
    const best = withRoas.reduce((a, b) => (b.roas > a.roas ? b : a))
    insights.push({
      id: "best-roas",
      tone: "positive",
      message: `"${best.name}" teve o melhor ROAS do período (${best.roas.toFixed(1)}x).`,
    })
  }

  const totalSpend = campaigns.reduce((sum, c) => sum + c.spend, 0)
  if (totalSpend > 0 && totalRevenue > 0) {
    for (const c of campaigns) {
      const spendShare = c.spend / totalSpend
      const revenueShare = c.revenue / totalRevenue
      if (spendShare >= HIGH_SPEND_SHARE_THRESHOLD && revenueShare < spendShare * LOW_RETURN_SHARE_RATIO) {
        insights.push({
          id: "low-return-high-spend",
          tone: "warning",
          message: `"${c.name}" consumiu ${(spendShare * 100).toFixed(0)}% do investimento mas gerou só ${(revenueShare * 100).toFixed(0)}% das vendas.`,
        })
        break
      }
    }
  }

  if (previousPeriodRevenue > 0) {
    const change = ((currentPeriodRevenue - previousPeriodRevenue) / previousPeriodRevenue) * 100
    insights.push({
      id: "period-trend",
      tone: change >= 0 ? "positive" : "warning",
      message: `Faturamento ${change >= 0 ? "subiu" : "caiu"} ${Math.abs(change).toFixed(0)}% em relação ao período anterior.`,
    })
  }

  if (totalRevenue > 0 && unattributedRevenue / totalRevenue >= UNATTRIBUTED_SHARE_THRESHOLD) {
    insights.push({
      id: "unattributed-share",
      tone: "warning",
      message: `${((unattributedRevenue / totalRevenue) * 100).toFixed(0)}% das vendas do período não têm campanha de origem identificada.`,
    })
  }

  return insights
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run from `apps/web/`:
```bash
bun run test
```
Expected: `4 passed`

- [ ] **Step 6: Commit**

```bash
git add apps/web/lib/insights.ts apps/web/lib/insights.test.ts apps/web/package.json
git commit -m "feat: add deterministic insights engine with unit tests"
```

---

### Task 6: Query layer (KPIs, rankings, chart series)

**Files:**
- Create: `apps/web/lib/queries/overview.ts`
- Create: `apps/web/lib/queries/overview.verify.ts` (manual verification script, deleted at end of task — see Step 4)

**Interfaces:**
- Consumes: `prisma` from `apps/web/lib/db.ts` (Task 3), models from Task 2.
- Produces: `getDefaultDateRange()`, `getKpiSummary(range)`, `getCampaignRanking(range)`, `getSellerRanking(range)`, `getSpendVsSalesSeries(range)` — all consumed by the Visão Geral page (Tasks 10-13). Shared type `DateRange = { from: Date; to: Date }`.

- [ ] **Step 1: Write the query module**

`apps/web/lib/queries/overview.ts`:
```ts
import { prisma } from "@/lib/db"

export interface DateRange {
  from: Date
  to: Date
}

export function getDefaultDateRange(days = 30): DateRange {
  const to = new Date()
  to.setUTCHours(0, 0, 0, 0)
  const from = new Date(to)
  from.setUTCDate(from.getUTCDate() - (days - 1))
  return { from, to }
}

function previousPeriod(range: DateRange): DateRange {
  const lengthMs = range.to.getTime() - range.from.getTime()
  const to = new Date(range.from.getTime() - 24 * 60 * 60 * 1000)
  const from = new Date(to.getTime() - lengthMs)
  return { from, to }
}

export interface KpiSummary {
  totalSpend: number
  totalRevenue: number
  roas: number
  avgTicket: number
  salesCount: number
  unattributedRevenue: number
  currentPeriodRevenue: number
  previousPeriodRevenue: number
}

export async function getKpiSummary(range: DateRange): Promise<KpiSummary> {
  const [insights, sales, previousSales] = await Promise.all([
    prisma.campaignInsightDaily.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { spend: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: range.from, lte: range.to } },
      select: { amount: true, campaignId: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: previousPeriod(range).from, lte: previousPeriod(range).to } },
      select: { amount: true },
    }),
  ])

  const totalSpend = insights.reduce((sum, i) => sum + Number(i.spend), 0)
  const totalRevenue = sales.reduce((sum, s) => sum + Number(s.amount), 0)
  const unattributedRevenue = sales
    .filter((s) => s.campaignId === null)
    .reduce((sum, s) => sum + Number(s.amount), 0)
  const previousPeriodRevenue = previousSales.reduce((sum, s) => sum + Number(s.amount), 0)

  return {
    totalSpend,
    totalRevenue,
    roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
    avgTicket: sales.length > 0 ? totalRevenue / sales.length : 0,
    salesCount: sales.length,
    unattributedRevenue,
    currentPeriodRevenue: totalRevenue,
    previousPeriodRevenue,
  }
}

export interface CampaignRankingRow {
  campaignId: string
  name: string
  status: string
  spend: number
  revenue: number
  roas: number
  salesCount: number
}

export async function getCampaignRanking(range: DateRange): Promise<CampaignRankingRow[]> {
  const campaigns = await prisma.campaign.findMany({
    include: {
      insights: { where: { date: { gte: range.from, lte: range.to } } },
      sales: { where: { saleDate: { gte: range.from, lte: range.to } } },
    },
  })

  return campaigns
    .map((c) => {
      const spend = c.insights.reduce((sum, i) => sum + Number(i.spend), 0)
      const revenue = c.sales.reduce((sum, s) => sum + Number(s.amount), 0)
      return {
        campaignId: c.id,
        name: c.name,
        status: c.status,
        spend,
        revenue,
        roas: spend > 0 ? revenue / spend : 0,
        salesCount: c.sales.length,
      }
    })
    .sort((a, b) => b.revenue - a.revenue)
}

export interface SellerRankingRow {
  sellerName: string
  revenue: number
  salesCount: number
}

export async function getSellerRanking(range: DateRange): Promise<SellerRankingRow[]> {
  const sales = await prisma.sale.findMany({
    where: { saleDate: { gte: range.from, lte: range.to } },
    select: { sellerName: true, amount: true },
  })

  const bySeller = new Map<string, SellerRankingRow>()
  for (const s of sales) {
    const current = bySeller.get(s.sellerName) ?? { sellerName: s.sellerName, revenue: 0, salesCount: 0 }
    current.revenue += Number(s.amount)
    current.salesCount += 1
    bySeller.set(s.sellerName, current)
  }

  return [...bySeller.values()].sort((a, b) => b.revenue - a.revenue)
}

export interface SpendVsSalesPoint {
  date: string
  spend: number
  revenue: number
}

export async function getSpendVsSalesSeries(range: DateRange): Promise<SpendVsSalesPoint[]> {
  const [insights, sales] = await Promise.all([
    prisma.campaignInsightDaily.findMany({
      where: { date: { gte: range.from, lte: range.to } },
      select: { date: true, spend: true },
    }),
    prisma.sale.findMany({
      where: { saleDate: { gte: range.from, lte: range.to } },
      select: { saleDate: true, amount: true },
    }),
  ])

  const byDate = new Map<string, SpendVsSalesPoint>()
  const key = (d: Date) => d.toISOString().slice(0, 10)

  for (const i of insights) {
    const k = key(i.date)
    const point = byDate.get(k) ?? { date: k, spend: 0, revenue: 0 }
    point.spend += Number(i.spend)
    byDate.set(k, point)
  }
  for (const s of sales) {
    const k = key(s.saleDate)
    const point = byDate.get(k) ?? { date: k, spend: 0, revenue: 0 }
    point.revenue += Number(s.amount)
    byDate.set(k, point)
  }

  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 2: Write a manual verification script**

`apps/web/lib/queries/overview.verify.ts`:
```ts
import { getCampaignRanking, getDefaultDateRange, getKpiSummary, getSellerRanking, getSpendVsSalesSeries } from "./overview"

async function main() {
  const range = getDefaultDateRange()
  const [kpis, campaigns, sellers, series] = await Promise.all([
    getKpiSummary(range),
    getCampaignRanking(range),
    getSellerRanking(range),
    getSpendVsSalesSeries(range),
  ])

  console.log("kpis", kpis)
  console.log("campaigns", campaigns.length, campaigns[0])
  console.log("sellers", sellers.length, sellers[0])
  console.log("series points", series.length)

  if (kpis.salesCount === 0) throw new Error("expected sales in default range")
  if (campaigns.length !== 6) throw new Error("expected 6 campaigns")
  if (sellers.length === 0) throw new Error("expected sellers")
  if (series.length === 0) throw new Error("expected series points")
}

main()
  .then(() => console.log("verify ok"))
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
```

- [ ] **Step 3: Run the verification script**

Run from `apps/web/`:
```bash
bunx tsx lib/queries/overview.verify.ts
```
Expected: prints kpis/campaigns/sellers/series, ends with `verify ok`.

- [ ] **Step 4: Delete the verification script (its job was to prove Step 3 passed, not to ship)**

```bash
rm apps/web/lib/queries/overview.verify.ts
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/queries/overview.ts
git commit -m "feat: add overview query layer (kpis, rankings, spend-vs-sales series)"
```

---

### Task 7: Apply the MVW theme (verde/branco/preto) to `globals.css`

**Files:**
- Modify: `packages/ui/src/styles/globals.css`

**Interfaces:**
- Produces: CSS variables consumed by every shadcn component already wired in the repo (no code changes needed elsewhere — same variable names as today).

Colors below were derived from the real logo at `apps/web/public/logo-mvw.webp` (dominant green sampled as `#01b828`, converted to OKLCH: `oklch(0.68 0.219 144)`). A darker shade of the same hue (`L≈0.48`) is used for `--primary` so white button text meets WCAG AA contrast (~5:1); the vivid brand shade is reserved for accents/charts/sidebar highlights where it sits on white or near-black, which passes contrast easily in both directions.

- [ ] **Step 1: Replace the `:root` block**

In `packages/ui/src/styles/globals.css`, replace the existing `:root { ... }` block with:
```css
:root {
    --background: oklch(1 0 0);
    --foreground: oklch(0.145 0 0);
    --card: oklch(1 0 0);
    --card-foreground: oklch(0.145 0 0);
    --popover: oklch(1 0 0);
    --popover-foreground: oklch(0.145 0 0);
    --primary: oklch(0.48 0.17 144);
    --primary-foreground: oklch(0.99 0 0);
    --secondary: oklch(0.97 0 0);
    --secondary-foreground: oklch(0.145 0 0);
    --muted: oklch(0.97 0 0);
    --muted-foreground: oklch(0.5 0 0);
    --accent: oklch(0.94 0.05 144);
    --accent-foreground: oklch(0.3 0.1 144);
    --destructive: oklch(0.577 0.245 27.325);
    --border: oklch(0.922 0 0);
    --input: oklch(0.922 0 0);
    --ring: oklch(0.6 0.15 144);
    --chart-1: oklch(0.68 0.219 144);
    --chart-2: oklch(0.48 0.17 144);
    --chart-3: oklch(0.3 0.1 144);
    --chart-4: oklch(0.556 0 0);
    --chart-5: oklch(0.145 0 0);
    --radius: 0.625rem;
    --sidebar: oklch(0.145 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.68 0.219 144);
    --sidebar-primary-foreground: oklch(0.145 0 0);
    --sidebar-accent: oklch(0.25 0.03 144);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.68 0.219 144);
}
```

- [ ] **Step 2: Replace the `.dark` block**

Replace the existing `.dark { ... }` block with:
```css
.dark {
    --background: oklch(0.145 0 0);
    --foreground: oklch(0.985 0 0);
    --card: oklch(0.205 0 0);
    --card-foreground: oklch(0.985 0 0);
    --popover: oklch(0.205 0 0);
    --popover-foreground: oklch(0.985 0 0);
    --primary: oklch(0.68 0.219 144);
    --primary-foreground: oklch(0.145 0 0);
    --secondary: oklch(0.269 0 0);
    --secondary-foreground: oklch(0.985 0 0);
    --muted: oklch(0.269 0 0);
    --muted-foreground: oklch(0.708 0 0);
    --accent: oklch(0.3 0.08 144);
    --accent-foreground: oklch(0.985 0 0);
    --destructive: oklch(0.704 0.191 22.216);
    --border: oklch(1 0 0 / 10%);
    --input: oklch(1 0 0 / 15%);
    --ring: oklch(0.68 0.219 144);
    --chart-1: oklch(0.68 0.219 144);
    --chart-2: oklch(0.55 0.19 144);
    --chart-3: oklch(0.4 0.14 144);
    --chart-4: oklch(0.708 0 0);
    --chart-5: oklch(0.985 0 0);
    --sidebar: oklch(0.1 0 0);
    --sidebar-foreground: oklch(0.985 0 0);
    --sidebar-primary: oklch(0.68 0.219 144);
    --sidebar-primary-foreground: oklch(0.145 0 0);
    --sidebar-accent: oklch(0.25 0.05 144);
    --sidebar-accent-foreground: oklch(0.985 0 0);
    --sidebar-border: oklch(1 0 0 / 10%);
    --sidebar-ring: oklch(0.68 0.219 144);
}
```

- [ ] **Step 3: Verify the app builds**

Run from repo root:
```bash
bun run --cwd apps/web build
```
Expected: build succeeds (no CSS/Tailwind errors).

- [ ] **Step 4: Commit**

```bash
git add packages/ui/src/styles/globals.css
git commit -m "feat: apply MVW green/white/black theme derived from logo"
```

---

### Task 8: Install additional shadcn components

**Files:**
- Create: `packages/ui/src/components/card.tsx`, `packages/ui/src/components/table.tsx`, `packages/ui/src/components/badge.tsx`, `packages/ui/src/components/separator.tsx`, `packages/ui/src/components/sheet.tsx`, `packages/ui/src/components/skeleton.tsx` (all generated by the CLI into the shared `packages/ui` package — same place `button.tsx` already lives — exact content decided by shadcn, not hand-written)

**Interfaces:**
- Produces: `Card`/`CardHeader`/`CardTitle`/`CardContent`, `Table` primitives, `Badge`, `Separator`, `Sheet`, `Skeleton` — consumed by Tasks 9-13.

- [ ] **Step 1: Run the shadcn CLI**

Run from `apps/web/`:
```bash
bunx shadcn@latest add card table badge separator sheet skeleton
```
Expected: CLI reports each component added without error.

- [ ] **Step 2: Verify the app still type-checks**

Run from `apps/web/`:
```bash
bunx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add packages/ui/src/components
git commit -m "chore: add shadcn card, table, badge, separator, sheet, skeleton"
```

---

### Task 9: Dashboard shell (nav + route group)

**Files:**
- Create: `apps/web/app/(dashboard)/layout.tsx`
- Create: `apps/web/app/(dashboard)/campanhas/page.tsx` (placeholder, replaced in a later plan)
- Create: `apps/web/app/(dashboard)/vendas/page.tsx` (placeholder, replaced in a later plan)
- Delete: `apps/web/app/page.tsx` (replaced by `app/(dashboard)/page.tsx` in Task 10 — same `/` route, route groups don't affect the URL)
- Create: `apps/web/components/dashboard-nav.tsx`

**Interfaces:**
- Produces: `<DashboardNav />` (client component, highlights active route via `usePathname`) — used only by `app/(dashboard)/layout.tsx`.

- [ ] **Step 1: Delete the placeholder root page**

```bash
rm apps/web/app/page.tsx
```

- [ ] **Step 2: Create the nav component**

`apps/web/components/dashboard-nav.tsx`:
```tsx
"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import { ChartBar, Megaphone, Users } from "@phosphor-icons/react"
import { cn } from "@workspace/ui/lib/utils"

const NAV_ITEMS = [
  { href: "/", label: "Visão Geral", icon: ChartBar },
  { href: "/campanhas", label: "Campanhas", icon: Megaphone },
  { href: "/vendas", label: "Vendas & Clientes", icon: Users },
]

export function DashboardNav() {
  const pathname = usePathname()

  return (
    <nav className="bg-sidebar text-sidebar-foreground flex h-full w-60 shrink-0 flex-col gap-1 p-4">
      <div className="mb-6 flex items-center gap-2 px-2">
        <Image src="/logo-mvw.webp" alt="MVW" width={120} height={36} className="h-9 w-auto" />
      </div>
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href
        const Icon = item.icon
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-primary text-sidebar-primary-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            )}
          >
            <Icon size={18} weight={active ? "fill" : "regular"} />
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
```

- [ ] **Step 3: Create the dashboard layout**

`apps/web/app/(dashboard)/layout.tsx`:
```tsx
import { DashboardNav } from "@/components/dashboard-nav"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh">
      <DashboardNav />
      <main className="flex-1 overflow-x-hidden p-6 md:p-8">{children}</main>
    </div>
  )
}
```

- [ ] **Step 4: Create placeholder pages**

`apps/web/app/(dashboard)/campanhas/page.tsx`:
```tsx
export default function CampanhasPage() {
  return (
    <div className="text-muted-foreground text-sm">
      Página de Campanhas — em construção.
    </div>
  )
}
```

`apps/web/app/(dashboard)/vendas/page.tsx`:
```tsx
export default function VendasPage() {
  return (
    <div className="text-muted-foreground text-sm">
      Página de Vendas & Clientes — em construção.
    </div>
  )
}
```

- [ ] **Step 5: Verify it type-checks (page.tsx for `/` comes in Task 10, so a build isn't expected to fully succeed yet — type-check is enough here)**

Run from `apps/web/`:
```bash
bunx tsc --noEmit
```
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/dashboard-nav.tsx "apps/web/app/(dashboard)" apps/web/app/page.tsx
git commit -m "feat: add dashboard shell with sidebar nav"
```

---

### Task 10: KPI cards + `lib/format.ts`

**Files:**
- Create: `apps/web/lib/format.ts`
- Create: `apps/web/components/dashboard/kpi-card.tsx`
- Create: `apps/web/app/(dashboard)/page.tsx` (Visão Geral — this task wires only the KPI row; chart/insights/rankings added in Tasks 11-13)

**Interfaces:**
- Produces: `formatCurrencyBRL(value: number): string`, `formatPercent(value: number): string` (from `lib/format.ts`); `<KpiCard title, value, hint? />` — consumed by this task's page and reused as-is by Tasks 11-13.
- Consumes: `getKpiSummary`, `getDefaultDateRange` from `lib/queries/overview.ts` (Task 6).

- [ ] **Step 1: Formatting helpers**

`apps/web/lib/format.ts`:
```ts
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value)
}

export function formatPercent(value: number): string {
  return `${value.toFixed(0)}%`
}

export function formatRoas(value: number): string {
  return `${value.toFixed(1)}x`
}
```

- [ ] **Step 2: KPI card component**

`apps/web/components/dashboard/kpi-card.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"

export function KpiCard({ title, value, hint }: { title: string; value: string; hint?: string }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold">{value}</div>
        {hint ? <p className="text-muted-foreground mt-1 text-xs">{hint}</p> : null}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 3: Visão Geral page (KPI row only for now)**

`apps/web/app/(dashboard)/page.tsx`:
```tsx
import { KpiCard } from "@/components/dashboard/kpi-card"
import { formatCurrencyBRL, formatRoas } from "@/lib/format"
import { getDefaultDateRange, getKpiSummary } from "@/lib/queries/overview"

export default async function VisaoGeralPage() {
  const range = getDefaultDateRange()
  const kpis = await getKpiSummary(range)

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">
          Últimos 30 dias · {range.from.toLocaleDateString("pt-BR")} – {range.to.toLocaleDateString("pt-BR")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard title="Investido" value={formatCurrencyBRL(kpis.totalSpend)} />
        <KpiCard title="Vendido" value={formatCurrencyBRL(kpis.totalRevenue)} />
        <KpiCard title="ROAS" value={formatRoas(kpis.roas)} hint="retorno por real investido" />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(kpis.avgTicket)} />
        <KpiCard title="Vendas" value={String(kpis.salesCount)} />
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run the dev server and verify visually**

Run from `apps/web/`:
```bash
bun run dev
```
Visit `http://localhost:3000/`. Expected: sidebar with MVW logo + nav (green theme visible), 5 KPI cards with real numbers (not zero — matches the seeded 150 sales / 6 campaigns).

- [ ] **Step 5: Commit**

```bash
git add apps/web/lib/format.ts apps/web/components/dashboard/kpi-card.tsx "apps/web/app/(dashboard)/page.tsx"
git commit -m "feat: add visao geral page with kpi cards"
```

---

### Task 11: Insights panel

**Files:**
- Create: `apps/web/components/dashboard/insights-panel.tsx`
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `buildInsights` from `lib/insights.ts` (Task 5), `getCampaignRanking`/`getKpiSummary` from `lib/queries/overview.ts` (Task 6).
- Produces: `<InsightsPanel insights={Insight[]} />` — consumed only by this page.

- [ ] **Step 1: Insights panel component**

`apps/web/components/dashboard/insights-panel.tsx`:
```tsx
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { cn } from "@workspace/ui/lib/utils"
import type { Insight } from "@/lib/insights"

const TONE_STYLES: Record<Insight["tone"], string> = {
  positive: "border-l-4 border-l-primary",
  warning: "border-l-4 border-l-destructive",
  neutral: "border-l-4 border-l-border",
}

export function InsightsPanel({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Insights do período</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {insights.map((insight) => (
          <p key={insight.id} className={cn("py-1 pl-3 text-sm", TONE_STYLES[insight.tone])}>
            {insight.message}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into the page**

In `apps/web/app/(dashboard)/page.tsx`, add imports:
```tsx
import { InsightsPanel } from "@/components/dashboard/insights-panel"
import { buildInsights } from "@/lib/insights"
import { getCampaignRanking } from "@/lib/queries/overview"
```

Replace the function body with:
```tsx
export default async function VisaoGeralPage() {
  const range = getDefaultDateRange()
  const [kpis, campaigns] = await Promise.all([getKpiSummary(range), getCampaignRanking(range)])

  const insights = buildInsights({
    campaigns: campaigns.map((c) => ({ campaignId: c.campaignId, name: c.name, spend: c.spend, revenue: c.revenue })),
    unattributedRevenue: kpis.unattributedRevenue,
    totalRevenue: kpis.totalRevenue,
    currentPeriodRevenue: kpis.currentPeriodRevenue,
    previousPeriodRevenue: kpis.previousPeriodRevenue,
  })

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-xl font-semibold">Visão Geral</h1>
        <p className="text-muted-foreground text-sm">
          Últimos 30 dias · {range.from.toLocaleDateString("pt-BR")} – {range.to.toLocaleDateString("pt-BR")}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <KpiCard title="Investido" value={formatCurrencyBRL(kpis.totalSpend)} />
        <KpiCard title="Vendido" value={formatCurrencyBRL(kpis.totalRevenue)} />
        <KpiCard title="ROAS" value={formatRoas(kpis.roas)} hint="retorno por real investido" />
        <KpiCard title="Ticket médio" value={formatCurrencyBRL(kpis.avgTicket)} />
        <KpiCard title="Vendas" value={String(kpis.salesCount)} />
      </div>
      <InsightsPanel insights={insights} />
    </div>
  )
}
```

- [ ] **Step 3: Verify visually**

Run from `apps/web/`: `bun run dev`, visit `/`. Expected: card "Insights do período" below the KPIs, with 2-4 sentences (best ROAS campaign, possibly a warning, trend vs previous period — previous period will have 0 revenue since it's mock data with only 30 days seeded, so the trend line may not appear; that's expected, not a bug).

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/dashboard/insights-panel.tsx "apps/web/app/(dashboard)/page.tsx"
git commit -m "feat: add insights panel to visao geral page"
```

---

### Task 12: Spend vs Sales chart

**Files:**
- Create: `apps/web/components/dashboard/spend-vs-sales-chart.tsx`
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `getSpendVsSalesSeries` from `lib/queries/overview.ts` (Task 6), `recharts`.
- Produces: `<SpendVsSalesChart data={SpendVsSalesPoint[]} />` (client component) — consumed only by this page.

- [ ] **Step 1: Chart component**

`apps/web/components/dashboard/spend-vs-sales-chart.tsx`:
```tsx
"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import type { SpendVsSalesPoint } from "@/lib/queries/overview"
import { formatCurrencyBRL } from "@/lib/format"

export function SpendVsSalesChart({ data }: { data: SpendVsSalesPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Investimento × Vendas</CardTitle>
      </CardHeader>
      <CardContent className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 8, right: 8 }}>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
            <XAxis
              dataKey="date"
              tickFormatter={(d: string) => new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}
              className="text-xs"
            />
            <YAxis tickFormatter={(v: number) => formatCurrencyBRL(v)} width={90} className="text-xs" />
            <Tooltip
              formatter={(value: number) => formatCurrencyBRL(value)}
              labelFormatter={(d: string) => new Date(d).toLocaleDateString("pt-BR")}
            />
            <Line type="monotone" dataKey="spend" name="Investido" stroke="var(--color-chart-2)" strokeWidth={2} dot={false} />
            <Line type="monotone" dataKey="revenue" name="Vendido" stroke="var(--color-chart-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into the page**

In `apps/web/app/(dashboard)/page.tsx`, add import:
```tsx
import { SpendVsSalesChart } from "@/components/dashboard/spend-vs-sales-chart"
import { getSpendVsSalesSeries } from "@/lib/queries/overview"
```

Update the `Promise.all` and JSX:
```tsx
const [kpis, campaigns, series] = await Promise.all([
  getKpiSummary(range),
  getCampaignRanking(range),
  getSpendVsSalesSeries(range),
])
```

Add right after `<InsightsPanel insights={insights} />`:
```tsx
<SpendVsSalesChart data={series} />
```

- [ ] **Step 3: Verify visually**

Run from `apps/web/`: `bun run dev`, visit `/`. Expected: line chart below insights, two lines (Investido, Vendido) over ~30 days, green/dark-green colors, tooltip shows BRL-formatted values on hover.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/dashboard/spend-vs-sales-chart.tsx "apps/web/app/(dashboard)/page.tsx"
git commit -m "feat: add spend vs sales chart to visao geral page"
```

---

### Task 13: Campaign and seller ranking tables

**Files:**
- Create: `apps/web/components/dashboard/ranking-table.tsx`
- Modify: `apps/web/app/(dashboard)/page.tsx`

**Interfaces:**
- Consumes: `CampaignRankingRow[]`, `SellerRankingRow[]` from `lib/queries/overview.ts` (Task 6), `Table` primitives (Task 8), `Badge`.
- Produces: `<CampaignRankingTable rows={CampaignRankingRow[]} />`, `<SellerRankingTable rows={SellerRankingRow[]} />` — consumed only by this page.

- [ ] **Step 1: Ranking table components**

`apps/web/components/dashboard/ranking-table.tsx`:
```tsx
import { Badge } from "@workspace/ui/components/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@workspace/ui/components/table"
import { formatCurrencyBRL, formatRoas } from "@/lib/format"
import type { CampaignRankingRow, SellerRankingRow } from "@/lib/queries/overview"

export function CampaignRankingTable({ rows }: { rows: CampaignRankingRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Campanhas — quem performou mais</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Campanha</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Investido</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="text-right">ROAS</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.campaignId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>
                  <Badge variant={row.status === "ACTIVE" ? "default" : "secondary"}>
                    {row.status === "ACTIVE" ? "Ativa" : "Pausada"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right">{formatCurrencyBRL(row.spend)}</TableCell>
                <TableCell className="text-right">{formatCurrencyBRL(row.revenue)}</TableCell>
                <TableCell className="text-right">{formatRoas(row.roas)}</TableCell>
                <TableCell className="text-right">{row.salesCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

export function SellerRankingTable({ rows }: { rows: SellerRankingRow[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Vendedores — quem vendeu mais</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vendedor</TableHead>
              <TableHead className="text-right">Vendido</TableHead>
              <TableHead className="text-right">Vendas</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.sellerName}>
                <TableCell className="font-medium">{row.sellerName}</TableCell>
                <TableCell className="text-right">{formatCurrencyBRL(row.revenue)}</TableCell>
                <TableCell className="text-right">{row.salesCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
```

- [ ] **Step 2: Wire into the page**

In `apps/web/app/(dashboard)/page.tsx`, add imports:
```tsx
import { CampaignRankingTable, SellerRankingTable } from "@/components/dashboard/ranking-table"
import { getSellerRanking } from "@/lib/queries/overview"
```

Update `Promise.all`:
```tsx
const [kpis, campaigns, series, sellers] = await Promise.all([
  getKpiSummary(range),
  getCampaignRanking(range),
  getSpendVsSalesSeries(range),
  getSellerRanking(range),
])
```

Add at the end of the returned JSX, after `<SpendVsSalesChart data={series} />`:
```tsx
<div className="grid gap-6 lg:grid-cols-2">
  <CampaignRankingTable rows={campaigns} />
  <SellerRankingTable rows={sellers} />
</div>
```

- [ ] **Step 3: Verify visually end-to-end**

Run from `apps/web/`: `bun run dev`, visit `/`. Expected full page top-to-bottom: sidebar nav (green/black theme, MVW logo) → title + date range → 5 KPI cards → insights panel → spend-vs-sales chart → campaign ranking table (6 rows, sorted by revenue desc) → seller ranking table (4 rows, sorted by revenue desc). Resize the window narrow (mobile width) and confirm cards/tables reflow without horizontal overflow of the page (tables may scroll internally).

- [ ] **Step 4: Full verification pass**

Run from `apps/web/`:
```bash
bunx tsc --noEmit && bun run test && bun run build
```
Expected: all three succeed with no errors.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/dashboard/ranking-table.tsx "apps/web/app/(dashboard)/page.tsx"
git commit -m "feat: add campaign and seller ranking tables to visao geral page"
```

---

## What comes after this plan

Separate plans (not part of this one):
- **Campanhas page** — full `DataTable` (TanStack Table) with sort/filter + drill-down `Sheet` showing sales attributed to a clicked campaign.
- **Vendas & Clientes page** — full sales table (cliente, vendedor, valor, produto, canal, data, campanha) + CSV export.
- **Global filter bar** — date range picker, cliente/vendedor/campanha combobox search, wired via URL search params across all three pages.
- **Meta Ads real sync** — API route + Vercel Cron replacing the seed data for `Campaign`/`CampaignInsightDaily`, using the System User token once available.
- **Google Sheets real sync + matching + manual refresh button** — API route reading the Greenn sheet via `googleapis`, UTM-based matching against `Campaign`, `SyncRun` logging, wired to the 15-min cron and the manual "Atualizar agora" button.
