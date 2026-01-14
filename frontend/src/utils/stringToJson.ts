import type { CardCategory } from './cards'

export type AiCardDetail = {
    name: string
    category: CardCategory
    value: number
    effect: string
}

export const stringToJson = (aiCard?: string): AiCardDetail | null => {
    try {
        if (!aiCard) {
            console.log('aiCard not null');
            return null
        }
        const trimmed = aiCard.trim()
        const jsonText = trimmed.startsWith('```')
        ? trimmed.replace(/```json\s*/i, '').replace(/```$/, '').trim()
        : trimmed
        return JSON.parse(jsonText) as AiCardDetail
    } catch (error) {
        console.warn('AI card JSON parse failed', error)
        return null
    }
}
