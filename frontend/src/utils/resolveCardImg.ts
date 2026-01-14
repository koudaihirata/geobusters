import type { CardMeta } from "./cards"

// カード画像の参照先を解決（base64/asset）
export const resolveCardImgSrc = (card: CardMeta) => {
    if (card.img && card.img.startsWith('data:')) return card.img
    if (card.img && card.img.length > 100) return `data:image/png;base64,${card.img}`
    if (card.img) return `${card.img}.svg`
    return 'Group.svg'
}