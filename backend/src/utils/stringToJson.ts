export type AiCardCategory = 'attack' | 'defense' | 'heal'

export type AiCardDetail = {
    name: string
    category: AiCardCategory
    value: number
    effect: string
}

const defaultTarget: AiCardDetail = {
    name: 'defaultTarget',
    category: 'attack',
    value: 100000,
    effect: 'defaultTarget'
}

export const stringToJson = (aiCard?: string): AiCardDetail => {
    try {
        if (!aiCard) {
            console.log('aiCard not null');
            return defaultTarget
        }
        const trimmed = aiCard.trim()
        const jsonText = trimmed.startsWith('```')
        ? trimmed.replace(/```json\s*/i, '').replace(/```$/, '').trim()
        : trimmed
        return JSON.parse(jsonText) as AiCardDetail
    } catch (error) {
        console.warn('AI card JSON parse failed', error)
        return defaultTarget
    }
}
