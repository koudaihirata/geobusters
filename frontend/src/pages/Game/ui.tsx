import styles from './styles.module.css'
import { STATUS_BONUS_VALUE } from '../../utils/cards'
import type { StatusEffects } from './types'

export const hpPercent = (hp: Record<string, number>, player: string, maxHp: number) => {
  const value = hp[player] ?? 0
  return Math.max(0, Math.min(100, (value / maxHp) * 100))
}

export const hpBarClass = (hp: Record<string, number>, player: string, maxHp: number) => {
  const percent = hpPercent(hp, player, maxHp)
  if (percent <= 30) return styles.hpLow
  if (percent <= 50) return styles.hpHalf
  return styles.hpFull
}

export const buildPlayersToDisplay = (players: string[], hp: Record<string, number>, name: string) => {
  const ordered = players.length ? [...players] : [...Object.keys(hp)]
  const idx = ordered.indexOf(name)
  if (idx > 0) {
    ordered.splice(idx, 1)
    ordered.unshift(name)
  }
  return ordered
}

const resolveStatus = (status: Record<string, StatusEffects>, player: string): StatusEffects => (
  status[player] ?? { poison: 0, paralyze: 0, attackUp: 0, defenseUp: 0 }
)

export const renderStatusBadges = (status: Record<string, StatusEffects>, player: string) => {
  const current = resolveStatus(status, player)
  const badges: Array<{ key: string; label: string; className: string }> = []
  if (current.poison > 0) badges.push({ key: 'poison', label: `毒${current.poison}`, className: styles.statusPoison })
  if (current.paralyze > 0) badges.push({ key: 'paralyze', label: `まひ${current.paralyze}`, className: styles.statusParalyze })
  if (current.attackUp > 0) {
    badges.push({
      key: 'attackUp',
      label: `攻+${current.attackUp * STATUS_BONUS_VALUE.attackUp}`,
      className: styles.statusAttack
    })
  }
  if (current.defenseUp > 0) {
    badges.push({
      key: 'defenseUp',
      label: `防+${current.defenseUp * STATUS_BONUS_VALUE.defenseUp}`,
      className: styles.statusDefense
    })
  }
  if (badges.length === 0) return null
  return (
    <div className={styles.statusBadges}>
      {badges.map(badge => (
        <span key={badge.key} className={`${styles.statusBadge} ${badge.className}`}>
          {badge.label}
        </span>
      ))}
    </div>
  )
}
