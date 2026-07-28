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
    .replace(/[̀-ͯ]/g, "")
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
  const item = arr[Math.floor(rand() * arr.length)]
  if (item === undefined) throw new Error("pick: empty array")
  return item
}

async function main() {
  if (process.env.ALLOW_DESTRUCTIVE_SEED !== "1") {
    throw new Error(
      "Refusing to run seed: this script wipes sale, campaignInsightDaily, syncRun and campaign tables. " +
        "Set ALLOW_DESTRUCTIVE_SEED=1 to confirm you want to run it (use `bun run db:seed`, which sets this for you).",
    )
  }

  await prisma.sale.deleteMany()
  await prisma.campaignInsightDaily.deleteMany()
  await prisma.syncRun.deleteMany()
  await prisma.campaign.deleteMany()

  const campaigns = []
  for (let i = 0; i < CAMPAIGNS.length; i++) {
    const c = CAMPAIGNS[i]
    if (!c) throw new Error("campaign not found")
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
