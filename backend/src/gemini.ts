import { AiCardCategory, stringToJson } from "./utils/stringToJson"

type GeminiCard = {
    spotName: string
    name: string
    category: AiCardCategory
    value: number
    effect: string
    rawJson: string
    imageBase64: string | undefined
}

export async function GeminiAPI(
    geminiApiKey: string,
    spotName: string
): Promise<GeminiCard> {
    const gatewayBase = 'https://gateway.ai.cloudflare.com/v1/48ef6af2e9147afadaff54bbd425b560/geobusters_bemini/google-ai-studio'
    const url = new URL(`${gatewayBase}/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiApiKey}`)
    const imageApiUrl =new URL(`${gatewayBase}/v1beta/models/gemini-2.5-flash-image:generateContent?key=${geminiApiKey}`)

    // 1) Gemini テキスト生成
    const res = await fetch(url.toString(), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text:   `You are a card game designer.From the following spot name, create one card.\n` +
                            `Constraints:\n
                                - Category must be one of "attack" | "defense" | "heal".\n
                                - Value must be between 5 and 10.\n
                                - If the card name or effect includes words such as "最強" or "無敵", the value may be 100 or higher.\n
                                - Effect must be simple and short (within 20 characters).\n
                                - Unique name and unique effect.\n
                                - Output JSON only (no extra text).\n
                                - All text values in the output JSON must be written in Japanese.\n
                                - No multi-hit attacks or damage-over-time effects.` +
                            `Spot name: ${spotName}\n` +
                            `Output format: {"name":"Card Name","category":"attack|defense|heal","value":1,"effect":"Effect text"}`
                }]
            }]
        })
    })
    if (!res.ok) {
        const errorBody = await res.text()
        console.log(`[Gemini] status=${res.status} body=${errorBody}`)
        throw new Error(`Gemini API failed: ${res.status}`)
    }

    const geminiJson = await res.json() as {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
    }
    const text = geminiJson.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}'
    const rawJson: string | undefined = text.trim()
    console.log('rawJson確認:', rawJson);
    let parsed: { name?: string; category?: AiCardCategory; value?: number; effect?: string } = {}
    try {
        parsed = stringToJson(rawJson)
    } catch {
        parsed = { name: 'Unknown Card', effect: text }
    }
    const category: AiCardCategory =
    parsed.category === 'attack' || parsed.category === 'defense' || parsed.category === 'heal'
    ? parsed.category
    : 'attack'
    const value = typeof parsed.value === 'number' ? parsed.value : 1
    console.log('parsed確認:', JSON.stringify(parsed));

    // 2) 画像生成（Nanobanana）
    const imageRes = await fetch(imageApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{
                parts: [{
                    text: `
                        A trading card illustration of ${spotName}.
                        image size 200x230 pixels.
                        no card border.
                        no frame.
                        full-bleed illustration.
                        full-bleed / no border / no white margin.
                    `
                }]
            }]
        })
    })
    const imageBody = await imageRes.text()
    if (!imageRes.ok) {
        console.log(`[Image] status=${imageRes.status} body=${imageBody}`)
        throw new Error(`Image API failed: ${imageRes.status}`)
    }
    let imageJson: {
        candidates?: Array<{
            content?: {
                parts?: Array<{ inline_data?: { data?: string }, inlineData?: { data?: string } }>
            }
        }>
    } = {}
    try {
        imageJson = JSON.parse(imageBody)
    } catch (error) {
        console.log(`[Image] JSON parse failed body=${imageBody}`)
        throw error
    }
    const parts = imageJson.candidates?.[0]?.content?.parts ?? []
    const imagePart = parts.find(part => part.inlineData?.data || part.inline_data?.data)
    const imageBase64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data

    return {
        spotName,
        name: parsed.name ?? 'Unknown Card',
        category,
        value,
        effect: parsed.effect ?? 'No effect',
        rawJson,
        imageBase64
    }
}
