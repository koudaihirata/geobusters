type GeminiCard = {
    spotName: string
    name: string
    effect: string
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
                                - Category must be one of "attack" | "defense" | "heal"\n
                                - Value must be between 5 and 10\n
                                - If the card name or effect includes words such as "最強" or "無敵", the value may be 100 or higher.\n
                                - Effect must be simple and short (within 20 characters)\n
                                - Unique name and unique effect\n
                                - Output JSON only (no extra text)\n
                                - All text values in the output JSON must be written in Japanese.\n` +
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
    let parsed: { name?: string; effect?: string } = {}
    try {
        parsed = JSON.parse(text)
    } catch {
        parsed = { name: 'Unknown Card', effect: text }
    }

    // 2) 画像生成（Nanobanana）
    // const imageRes = await fetch(imageApiUrl, {
    //     method: 'POST',
    //     headers: {
    //         'Content-Type': 'application/json',
    //     },
    //     body: JSON.stringify({
    //         prompt: `A trading card illustration of ${spotName}`,
    //         size: '200x230'
    //     })
    // })
    // if (!imageRes.ok) {
    //     throw new Error(`Image API failed: ${imageRes.status}`)
    // }
    // const imageJson = await imageRes.json() as {
    //     candidates?: Array<{
    //         content?: {
    //             parts?: Array<{ inline_data?: { data?: string } }>
    //         }
    //     }>
    // }
    // const part = imageJson.candidates?.[0]?.content?.parts?.[0]
    // const imageBase64 = part?.inline_data?.data // base64
    const imageBase64 = undefined

    return {
        spotName,
        name: parsed.name ?? 'Unknown Card',
        effect: parsed.effect ?? 'No effect',
        imageBase64
    }
}
