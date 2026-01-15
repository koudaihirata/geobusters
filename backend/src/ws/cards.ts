export const ATTACK_CARDS: Record<number, number> = {
    101: 1,
    102: 3
}

export const DEFENSE_CARDS: Record<number, number> = {
    201: 1,
    202: 3
}

export const HEAL_CARDS: Record<number, number> = {
    301: 2
}

export const isAttackCard = (id: number) => id in ATTACK_CARDS
export const isDefenseCard = (id: number) => id in DEFENSE_CARDS
export const isHealCard = (id: number) => id in HEAL_CARDS

export const getAttackDamage = (id: number) => ATTACK_CARDS[id] ?? null
export const getDefenseValue = (id: number) => DEFENSE_CARDS[id] ?? null
export const getHealValue = (id: number) => HEAL_CARDS[id] ?? null
