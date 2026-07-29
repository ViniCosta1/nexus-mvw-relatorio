/**
 * Sales have no UTM attribution, so the channel is inferred from the seller who
 * handled the sale (each seller works one acquisition channel). Update the map
 * here if a seller changes channel or a new seller is added.
 */
export function channelForSeller(sellerName: string): string {
  const s = sellerName.trim().toLowerCase()
  if (s.startsWith("naty")) return "WhatsApp"
  if (s.startsWith("karol")) return "Instagram"
  if (s.startsWith("carol")) return "Live"
  if (s.startsWith("lavinia")) return "Tráfego"
  return "Não atribuído"
}

/**
 * Product names share a long prefix ("MVW - Máquina de Vendas… | 2ª Edição …");
 * only the part after "Edição" distinguishes the tickets, so show just that.
 * Falls back to the full name when the marker isn't present.
 */
export function shortProductName(name: string): string {
  const marker = /edição/i
  const idx = name.search(marker)
  if (idx === -1) return name
  const after = name.slice(idx + "edição".length).trim()
  return after.length > 0 ? after : name
}
