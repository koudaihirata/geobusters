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

export type StatusKey = 'poison' | 'paralyze' | 'attackUp' | 'defenseUp'
export type SpecialCardEffect = {
    status: StatusKey
    amount: number
    target: 'self' | 'enemy'
}

export const SPECIAL_CARDS: Record<number, SpecialCardEffect> = {
    401: { status: 'poison', amount: 2, target: 'enemy' },
    402: { status: 'paralyze', amount: 1, target: 'enemy' },
    403: { status: 'attackUp', amount: 1, target: 'self' },
    404: { status: 'defenseUp', amount: 1, target: 'self' }
}

export const isAttackCard = (id: number) => id in ATTACK_CARDS
export const isDefenseCard = (id: number) => id in DEFENSE_CARDS
export const isHealCard = (id: number) => id in HEAL_CARDS
export const isSpecialCard = (id: number) => id in SPECIAL_CARDS

export const getAttackDamage = (id: number) => ATTACK_CARDS[id] ?? null
export const getDefenseValue = (id: number) => DEFENSE_CARDS[id] ?? null
export const getHealValue = (id: number) => HEAL_CARDS[id] ?? null
export const getSpecialCardEffect = (id: number) => SPECIAL_CARDS[id] ?? null
