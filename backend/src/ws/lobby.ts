// src/ws/lobby.ts
import { GeminiAPI } from '../gemini'
import { nearBySearch } from '../NearBySearch'
import type { Client } from '../types'

export type LobbyDeps = {
    send: (ws: Client, obj: unknown) => void
    broadcast: (obj: unknown) => void
    sendTo: (player: string, obj: unknown) => void
    getMembers: () => string[]
    getHostId: () => string | null
    isHost: (clientId?: string) => boolean
}

export function onLobbyConnect(deps: LobbyDeps, ws: Client, name: string, roomName: string) {
    const members = deps.getMembers()
    const hostClientId = deps.getHostId() ?? undefined
    deps.send(ws, { type: 'joined', roomId: roomName, at: Date.now(), members, hostClientId })
    deps.broadcast({ type: 'members', members, hostClientId })
    deps.broadcast({ type: 'system', text: `🔔 ${name} が「${roomName}」に入室しました`, at: Date.now() })
}

export async function handleLobbyMessage(
    deps: LobbyDeps,
    ws: Client,
    name: string,
    clientId: string | undefined,
    env: { 
        GOOGLE_PLACES_API_KEY?: string,
        GEMINI_API_KEY?: string
    },
    parsed: any,                 // 受信メッセージ（JSON）
    promoteToGame: () => void    // フェーズ切替コールバック
) {
    if (parsed.type === 'chat') {
        deps.broadcast({ type: 'chat', from: name, text: String(parsed.text ?? ''), at: Date.now() })
        return
    }
    if (parsed.type === 'ping') {
        deps.send(ws, { type: 'pong', at: Date.now() })
        return
    }
    if (parsed.type === 'start') {
        // console.log('start received')
        if (!clientId || !deps.isHost(clientId)) {
            deps.send(ws, { type: 'error', text: 'ゲームの開始はホストのみが実行できます' })
            return
        }

        const latitude = typeof parsed.lat === 'number' ? parsed.lat : null
        const longitude = typeof parsed.lng === 'number' ? parsed.lng : null
        if (latitude === null || longitude === null) {
            deps.send(ws, { type: 'error', text: '位置情報が取得できません' })
            return
        }
        const apiKey = env.GOOGLE_PLACES_API_KEY
        if (!apiKey) {
            deps.send(ws, { type: 'error', text: '位置情報用のAPIキーが設定されていません' })
            return
        }
        const results = await nearBySearch(latitude, longitude, apiKey)
        console.log(results)

        const members = deps.getMembers()
        if (results.length > 0) {
            const geminiApiKey = env.GEMINI_API_KEY
            if (!geminiApiKey) {
                deps.send(ws, { type: 'error', text: 'GeminiのAPIキーが設定されていません' })
                return
            }
            for (const player of members) {
                const idx = Math.floor(Math.random() * results.length)
                const pick = results[idx]
                if (!pick) continue
                // 1人ずつ別のカードを生成
                const geminiCard = await GeminiAPI(geminiApiKey, pick.name)
                deps.sendTo(player, {
                    type: 'ai_card',
                    spot: geminiCard.spotName,
                    card_name: geminiCard.name,
                    card_effect: geminiCard.effect,
                    card_img: geminiCard.imageBase64 ?? 'not null'
                })
            }
        }

        // フロントにフェーズ変更を通知
        deps.broadcast({ type: 'phase_changed', phase: 'game' })
        promoteToGame()
        return
    }
    if (parsed.type === 'join') return

    deps.send(ws, { type: 'error', text: `未知のtype: ${parsed.type}` })
}

export function onLobbyDisconnect(deps: LobbyDeps, name: string) {
    const members = deps.getMembers()
    const hostClientId = deps.getHostId() ?? undefined
    deps.broadcast({ type: 'system', text: `👋 ${name} が退室しました`, at: Date.now() })
    deps.broadcast({ type: 'members', members, hostClientId })
}
