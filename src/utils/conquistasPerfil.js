// Preferências antigas continuam usando o tier atual. Se um tier deixar de
// estar disponível, o perfil exibe o maior tier que continua desbloqueado.
export function nivelConquistaNoPerfil(conquista, tiers = {}) {
  const escolhido = tiers?.[conquista.codigo];
  return conquista.tiers?.some(
    (tier) => tier.nivel === escolhido && tier.desbloqueado,
  )
    ? escolhido
    : conquista.tierAtual;
}
