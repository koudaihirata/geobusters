export type CardCategory = 'attack' | 'defense' | 'heal' | 'special'
export type CardMeta = {
    id: number
    label: string
    detail: string
    category: CardCategory
    requiresTarget?: boolean
    allowSelfTarget?: boolean
    img: string
}

export const STATUS_BONUS_VALUE = {
    attackUp: 2,
    defenseUp: 2
}

export const CARD_LIBRARY: Record<number, CardMeta> = {
    /* 攻撃カード */
    101: { id: 101, label: '木の剣', detail: '1ダメージを与える', category: 'attack', requiresTarget: true, allowSelfTarget: true, img: 'cards/woodenSword' },
    102: { id: 102, label: '真剣', detail: '3ダメージを与える', category: 'attack', requiresTarget: true, allowSelfTarget: true, img: 'cards/seriously' },
    103: { id: 103, label: '毒の短剣', detail: '1ダメージを与える+1ターン毒状態にする', category: 'attack', requiresTarget: true, allowSelfTarget: true, img: 'cards/poison' },
    104: { id: 104, label: '麻痺矢', detail: '1ダメージを与える+1ターンまひ状態にする', category: 'attack', requiresTarget: true, allowSelfTarget: true, img: '' },
    105: { id: 105, label: 'ひでおの愛剣', detail: '英雄になりかけた男が所持していた剣 (6ダメージを与える)', category: 'attack', requiresTarget: true, allowSelfTarget: true, img: 'cards/hideoSword' },
    /* 防御カード */
    201: { id: 201, label: 'ボロボロの盾', detail: '1ダメージ防ぐ', category: 'defense', img: 'cards/woodenShield' },
    202: { id: 202, label: '量産型シールド', detail: '3ダメージ防ぐ', category: 'defense', img: 'cards/MassProduction' },
    203: { id: 203, label: 'ひでおの愛盾', detail: '英雄になりかけた男が所持していた盾 (6ダメージ防ぐ)', category: 'defense', img: '' },
    /* 回復カード */
    301: { id: 301, label: '癒しの薬草', detail: 'HPが1回復（HPが満タンの時最大体力が増える）', category: 'heal', requiresTarget: true, allowSelfTarget: true, img: 'cards/medicinalHerbs' },
    302: { id: 302, label: 'ヒールポーション', detail: 'HPが3回復 (HPが満タンの時、最大HPが増える)', category: 'heal', requiresTarget: true, allowSelfTarget: true, img: '' }
}
