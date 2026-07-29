/**
 * Costs and design deliveries, typed in by hand — neither has an integration to
 * sync from. Idempotent on purpose (upsert by natural key), unlike the mock
 * sales seed: this one holds real numbers and is meant to be re-run whenever a
 * value changes.
 *
 * Run: cd apps/web && bun run prisma/seed-operacao.ts
 */
import { CostKind, DeliveryKind, PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

/** 1st of the month, UTC midnight — the whole cost model works in whole months. */
function month(year: number, monthNumber: number): Date {
  return new Date(Date.UTC(year, monthNumber - 1, 1))
}

const JUNHO = month(2026, 6)

const COSTS = [
  {
    name: "Lavinia",
    category: "Equipe",
    amount: 7000,
    kind: CostKind.MONTHLY,
    startMonth: JUNHO,
    endMonth: null,
    hasVariable: false,
    note: null,
  },
  {
    name: "Grupo Nexus",
    category: "Equipe",
    amount: 4000,
    kind: CostKind.MONTHLY,
    startMonth: JUNHO,
    endMonth: null,
    hasVariable: false,
    note: null,
  },
  {
    name: "Karol SS",
    category: "Equipe",
    amount: 1500,
    kind: CostKind.MONTHLY,
    startMonth: JUNHO,
    endMonth: null,
    hasVariable: true,
    note: "Fixo de R$ 1.500 mais comissão variável, que não entra nos totais.",
  },
  {
    name: "CRM",
    category: "Ferramenta",
    amount: 700,
    kind: CostKind.MONTHLY,
    startMonth: JUNHO,
    endMonth: null,
    hasVariable: false,
    note: null,
  },
  {
    name: "ManyChat Pro",
    category: "Ferramenta",
    amount: 249,
    kind: CostKind.MONTHLY,
    startMonth: JUNHO,
    endMonth: null,
    hasVariable: false,
    note: null,
  },
  {
    name: "Make Pro",
    category: "Ferramenta",
    amount: 60,
    kind: CostKind.MONTHLY,
    startMonth: JUNHO,
    endMonth: null,
    hasVariable: false,
    note: null,
  },
  {
    name: "Meppy",
    category: "Ferramenta",
    amount: 1000,
    kind: CostKind.ONE_OFF,
    startMonth: JUNHO,
    endMonth: JUNHO,
    hasVariable: false,
    note: "Cobrado só em junho — a ferramenta não terá sequência.",
  },
  {
    name: "Domínio Rafa",
    category: "Infra",
    amount: 65,
    kind: CostKind.ONE_OFF,
    startMonth: JUNHO,
    endMonth: JUNHO,
    hasVariable: false,
    note: "Anual, pago em junho de 2026. Próxima renovação em junho de 2027.",
  },
]

const DELIVERIES = [
  { key: "site-oficial", label: "Site oficial", kind: DeliveryKind.MARCO, month: null, quantity: null },
  { key: "logos", label: "Reestilização das logos", kind: DeliveryKind.MARCO, month: null, quantity: null },
  { key: "artes-2026-06", label: "Artes", kind: DeliveryKind.ARTE, month: month(2026, 6), quantity: 47 },
  { key: "videos-2026-06", label: "Vídeos", kind: DeliveryKind.VIDEO, month: month(2026, 6), quantity: 5 },
  {
    key: "artes-oficiais-evento-2026-07",
    label: "Artes oficiais do evento",
    kind: DeliveryKind.ARTE,
    month: month(2026, 7),
    quantity: 22,
  },
  { key: "artes-2026-07", label: "Artes", kind: DeliveryKind.ARTE, month: month(2026, 7), quantity: 129 },
  { key: "videos-2026-07", label: "Vídeos", kind: DeliveryKind.VIDEO, month: month(2026, 7), quantity: 15 },
]

async function main() {
  for (const cost of COSTS) {
    await prisma.cost.upsert({
      where: { name: cost.name },
      update: cost,
      create: cost,
    })
  }

  for (const delivery of DELIVERIES) {
    // Keyed by slug, so "Artes" in June and in July stay separate rows while a
    // re-run overwrites rather than duplicates.
    await prisma.designDelivery.upsert({
      where: { key: delivery.key },
      update: delivery,
      create: delivery,
    })
  }

  console.log(`Seed operação ok: ${COSTS.length} custos, ${DELIVERIES.length} entregas`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
