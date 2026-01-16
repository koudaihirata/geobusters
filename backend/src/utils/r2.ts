export const base64ToBytes = (base64: string) => {
    const clean = base64.includes('base64,')
        ? base64.split('base64,').pop() ?? base64
        : base64
    const binary = atob(clean)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) {
        bytes[i] = binary.charCodeAt(i)
    }
    return bytes
}

export const buildAiImageKey = (spotName: string) => {
    const safeSpot = spotName.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 60) || 'spot'
    return `ai-cards/${Date.now()}_${safeSpot}.png`
}

export const saveAiImageToR2 = async (bucket: R2Bucket, base64: string, key: string) => {
    const bytes = base64ToBytes(base64)
    await bucket.put(key, bytes, {
        httpMetadata: { contentType: 'image/png' },
        customMetadata: { source: 'ai-card' }
    })
    return key
}
