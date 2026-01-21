export type StatusKey = 'poison' | 'paralyze' | 'attackUp' | 'defenseUp'
export type StatusEffect = {
    status: StatusKey
    amount: number
}
export type AttackCardEffect = {
    damage: number
    statusEffect?: StatusEffect
}

export const ATTACK_CARDS: Record<number, AttackCardEffect> = {
    101: { damage: 1 },
    102: { damage: 3 },
    103: { damage: 1, statusEffect: { status: 'poison', amount: 1 } },
    104: { damage: 1, statusEffect: { status: 'paralyze', amount: 1 } }
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

export const getAttackEffect = (id: number) => ATTACK_CARDS[id] ?? null
export const getAttackDamage = (id: number) => ATTACK_CARDS[id]?.damage ?? null
export const getDefenseValue = (id: number) => DEFENSE_CARDS[id] ?? null
export const getHealValue = (id: number) => HEAL_CARDS[id] ?? null
