/**
 * Transforms closer_resp and vendas_resp objects into a sorted array for Tab3.
 * @param {object} closer_resp - { name: { total, ganho, perdido, aberto } }
 * @param {object} vendas_resp - { name: { qtd, receita } }
 * @returns {Array}
 */
export function closerRespToArr(closer_resp = {}, vendas_resp = {}) {
  return Object.entries(closer_resp)
    .map(([nome, d]) => ({
      nome,
      ...d,
      taxa: d.ganho + d.perdido > 0
        ? +((d.ganho / (d.ganho + d.perdido)) * 100).toFixed(1)
        : 0,
      receita: vendas_resp[nome]?.receita ?? 0,
    }))
    .sort((a, b) => b.total - a.total);
}

/**
 * Transforms sdr_resp object into a sorted array for Tab4.
 * @param {object} sdr_resp - { name: { total, conv_closer, perdido } }
 * @returns {Array}
 */
export function sdrRespToArr(sdr_resp = {}) {
  return Object.entries(sdr_resp)
    .map(([nome, d]) => ({
      nome,
      ...d,
      taxaConv:  d.total > 0 ? +((d.conv_closer / d.total) * 100).toFixed(1) : 0,
      taxaPerda: d.total > 0 ? +((d.perdido      / d.total) * 100).toFixed(1) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
