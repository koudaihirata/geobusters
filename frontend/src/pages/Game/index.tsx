import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { baseURL } from '../../utils/baseURL'
import styles from './styles.module.css'
import { CARD_LIBRARY, STATUS_BONUS_VALUE, type CardCategory, type CardMeta } from '../../utils/cards'
import NormalBtn from '../../components/button/NormalBtn'
import { stringToJson } from '../../utils/stringToJson'
import SelectedCard from '../../components/SelectedCard'
import { resolveCardImgSrc } from '../../utils/resolveCardImg'

// ====== 型定義 ======
type StatusEffects = { poison: number; paralyze: number; attackUp: number; defenseUp: number }
type S = {
    players: string[]
    hp: Record<string, number>
    status: Record<string, StatusEffects>
    round: number
    turn: string
}
// 初期状態
const initS: S = { players:[], hp:{}, status:{}, round:1, turn:'' }
// HP の上限
const MAX_HP = 10
// clientId 保管キー
const CLIENT_ID_STORAGE_KEY = 'rooms:clientId'
// プレイログ表示用の共有状態
type SharedPlayView = { attacker?: string | null; attackCardId?: number | null; target?: string | null; defenseCardId?: number | null }
// AIカードの受信データ
type AiCardMsg = { type: 'ai_card'; card_id: number; spot: string; card_effect: string; card_img: string; player?: string }

// ====== WS メッセージ型 ======
type DefenseSnapshot = { attacker: string; target: string; damage: number; cardId?: number; defenseCardId?: number }
type GameStartedMsg = { type: 'game_started'; players?: string[]; hp?: Record<string, number>; status?: Record<string, StatusEffects>; round?: number; turn?: string }
type StateMsg = { type: 'state'; hp?: Record<string, number>; status?: Record<string, StatusEffects>; round?: number; turn?: string; phase?: 'action' | 'defense'; defense?: DefenseSnapshot }
type PlayedMsg = { type: 'played'; by?: string; cardId?: number; target?: string; delta?: { hp?: Record<string, number> }; status?: Record<string, StatusEffects>; next?: { round?: number; turn?: string }; defense?: { by: string; cardId?: number; blocked: number; cards?: number[] } }
type GameOverMsg = { type: 'game_over'; winner?: string }
type PhaseChangedMsg = { type: 'phase_changed'; phase: 'lobby' | 'game' }
type DefenseRequestedMsg = { type: 'defense_requested'; attacker: string; target: string; damage: number; cardId: number; defenseCardId?: number }
type HandUpdateMsg = { type: 'hand_update'; hand: number[] }
type ReplayMsg = { type: 'replay'; stage: 'attack' | 'defense' | 'damage'; attacker?: string; target?: string; defender?: string; cardId?: number; value?: number; amount?: number }
type GameWsMsg = GameStartedMsg | StateMsg | PlayedMsg | GameOverMsg | PhaseChangedMsg | DefenseRequestedMsg | HandUpdateMsg | AiCardMsg
    | ReplayMsg

// WS で受け取るメッセージの簡易ガード
const isGameWsMsg = (msg: unknown): msg is GameWsMsg => {
    if (!msg || typeof msg !== 'object') return false
    const type = (msg as { type?: unknown }).type
    return type === 'game_started'
        || type === 'state'
        || type === 'played'
        || type === 'game_over'
        || type === 'phase_changed'
        || type === 'defense_requested'
        || type === 'hand_update'
        || type === 'ai_card'
        || type === 'replay'
}

// プレイヤー配列の重複を除外しつつ順序を維持
const mergePlayers = (current: string[], incoming: string[]) => {
    const ordered = current.length ? [...current] : []
    incoming.forEach(player => {
        if (!ordered.includes(player)) ordered.push(player)
    })
    return ordered.length ? ordered : incoming
}

// clientId を復元/生成
const resolveClientId = () => {
    const fallback = () => `anon-${Date.now()}-${Math.random().toString(16).slice(2)}`
    try {
        const stored = sessionStorage.getItem(CLIENT_ID_STORAGE_KEY)
        if (stored) return stored
        const generated = typeof crypto !== 'undefined' && 'randomUUID' in crypto
            ? crypto.randomUUID()
            : fallback()
        sessionStorage.setItem(CLIENT_ID_STORAGE_KEY, generated)
        return generated
    } catch {
        return fallback()
    }
}

export default function Game() {
    // ====== ルーター / WS / 状態 ======
    const [sp] = useSearchParams()
    const navigate = useNavigate()
    // 画面クエリ
    const room = sp.get('room') ?? ''
    const name = sp.get('name') ?? ''
    // WebSocket参照
    const wsRef = useRef<WebSocket|null>(null)
    const playersRef = useRef<string[]>(initS.players)
    // ゲーム状態
    const [st, setSt] = useState<S>(initS)
    const [hand, setHand] = useState<number[]>([])
    const [phase, setPhase] = useState<'action' | 'defense'>('action')
    const [selectedCardIndex, setSelectedCardIndex] = useState<number|null>(null)
    const [defensePrompt, setDefensePrompt] = useState<DefenseSnapshot | null>(null)
    const [aiCardId, setAiCardId] = useState<number | null>(null)
    const [aiCardMap, setAiCardMap] = useState<Record<number, CardMeta>>({})
    const [aiCardUsed, setAiCardUsed] = useState(false)
    const [finish, setFinish] = useState<{
        results: boolean
        winner: string | undefined
    }>({ results: false, winner: '' })
    const aiCardUsedRef = useRef(false)
    const aiCardIdRef = useRef<number | null>(null)
    const navigatedRef = useRef(false)
    const finishRef = useRef(false)
    // ターン/ターゲット関連
    const isMyTurn = st.turn === name
    const [selectedTarget, setSelectedTarget] = useState<string | null>(null)
    const clientIdRef = useRef<string>(resolveClientId())
    const isDefenseTurn = phase === 'defense' && defensePrompt?.target === name
    const canPlayAttackCard = phase === 'action' && isMyTurn
    const canSelectTarget = phase === 'action'
    const isParalyzed = (st.status[name]?.paralyze ?? 0) > 0
    // プレイログの表示用
    const [playView, setPlayView] = useState<SharedPlayView>({ attacker: null, attackCardId: null, target: null, defenseCardId: null })
    const [replayStage, setReplayStage] = useState<'attack' | 'defense' | 'damage' | null>(null)
    const [damagePopup, setDamagePopup] = useState<{ target?: string | null; amount: number } | null>(null)
    const replayTimerRef = useRef<number | null>(null)
    const damageTimerRef = useRef<number | null>(null)
    // 手札引き直し関係
    // const allDefenseHand = hand.length === 3 && hand.every(cardId => CARD_LIBRARY[cardId]?.category === 'defense')
    // const canMulligan = canPlayAttackCard && allDefenseHand

    // ====== 参照同期 ======
    useEffect(() => {
        playersRef.current = st.players
    }, [st.players])

    useEffect(() => {
        aiCardUsedRef.current = aiCardUsed
    }, [aiCardUsed])

    useEffect(() => {
        aiCardIdRef.current = aiCardId
    }, [aiCardId])

    // ====== WS 接続 / 受信 ======
    useEffect(() => {
        const ws = new WebSocket(`${baseURL}?room=${encodeURIComponent(room)}&name=${encodeURIComponent(name)}&cid=${encodeURIComponent(clientIdRef.current)}`)
        wsRef.current = ws
        let navigated = false

        // ルームへ戻る遷移
        const returnToRooms = () => {
            if (navigated) return
            navigated = true
            setDefensePrompt(null)
            setPhase('action')
            setHand([])
            const navState = {
                joined: true,
                roomId: room,
                name,
                members: playersRef.current
            }
            try { ws.close() } catch (error) { console.log(error) }
            navigate('/rooms', {
                replace: true,
                state: navState
            })
        }

        ws.onopen = () => ws.send(JSON.stringify({ type:'sync' }))
        ws.onmessage = async (e) => {
            try {
                let text = ''
                if (typeof e.data === 'string') {
                    text = e.data
                } else if (e.data instanceof Blob) {
                    text = await e.data.text()
                } else if (e.data instanceof ArrayBuffer) {
                    text = new TextDecoder().decode(e.data)
                } else if (ArrayBuffer.isView(e.data)) {
                    const view = e.data as ArrayBufferView
                    text = new TextDecoder().decode(view.buffer)
                } else {
                    console.warn('未対応のフレーム形式を受信', e.data)
                    return
                }
                if (!text) return

                const msg = JSON.parse(text)
                if (!isGameWsMsg(msg)) {
                    console.warn('不明なメッセージ形式を受信しました', text)
                    return
                }
                const typedMsg = msg
                switch (typedMsg.type) {
                    case 'game_started':
                        setSt({
                            players: typedMsg.players ?? [],
                            hp: typedMsg.hp ?? {},
                            status: typedMsg.status ?? {},
                            round: typedMsg.round ?? 1,
                            turn: typedMsg.turn ?? ''
                        })
                        setHand([])
                        setPhase('action')
                        setDefensePrompt(null)
                        setPlayView({ attacker: null, attackCardId: null, target: null, defenseCardId: null })
                        setReplayStage(null)
                        setDamagePopup(null)
                        setSelectedTarget(null)
                        setSelectedCardIndex(null)
                        setAiCardUsed(false)
                        break
                    case 'state':
                        setSt(prev => {
                            const hp = typedMsg.hp ?? {}
                            const players = mergePlayers(prev.players, Object.keys(hp))
                            return {
                                ...prev,
                                players,
                                hp,
                                status: typedMsg.status ?? prev.status,
                                round: typedMsg.round ?? prev.round,
                                turn: typedMsg.turn ?? prev.turn
                            }
                        })
                        setPhase(typedMsg.phase ?? 'action')
                        setDefensePrompt(typedMsg.defense ?? null)
                        if (typedMsg.defense) {
                            setPlayView({
                                attacker: typedMsg.defense.attacker,
                                attackCardId: typedMsg.defense.cardId ?? null,
                                target: typedMsg.defense.target,
                                defenseCardId: typedMsg.defense.defenseCardId ?? null
                            })
                        }
                        break
                    case 'played':
                        setSt(prev => {
                            const delta: Record<string, number> = typedMsg.delta?.hp ?? {}
                            const nextHp = { ...prev.hp }
                            const deltaEntries = Object.entries(delta) as Array<[string, number]>
                            for (const [player, amount] of deltaEntries) {
                                const base = nextHp[player] ?? MAX_HP
                                nextHp[player] = Math.max(0, base + amount)
                            }
                            const players = mergePlayers(prev.players, Object.keys(nextHp))
                            return {
                                ...prev,
                                players,
                                hp: nextHp,
                                status: typedMsg.status ?? prev.status,
                                round: typedMsg.next?.round ?? prev.round,
                                turn: typedMsg.next?.turn ?? prev.turn
                            }
                        })
                        setPhase('action')
                        setDefensePrompt(null)
                        setPlayView({
                            attacker: typedMsg.by ?? null,
                            attackCardId: typedMsg.cardId ?? null,
                            target: typedMsg.target ?? null,
                            defenseCardId: typedMsg.defense?.cardId ?? (
                                typedMsg.defense?.cards && typedMsg.defense.cards.length > 0
                                    ? typedMsg.defense.cards[typedMsg.defense.cards.length - 1]
                                    : null
                            )
                        })
                        setSelectedTarget(null)
                        setSelectedCardIndex(null)
                        break
                    case 'game_over':
                        finishRef.current = true
                        setFinish({
                            results: true,
                            winner: typedMsg.winner
                        })
                        setDefensePrompt(null)
                        break
                    case 'phase_changed':
                        if (typedMsg.phase === 'lobby') {
                            if (finishRef.current) break
                            returnToRooms()
                        }
                        setDefensePrompt(null)
                        setPhase('action')
                        setPlayView({ attacker: null, attackCardId: null, target: null, defenseCardId: null })
                        setSelectedCardIndex(null)
                        break
                    case 'defense_requested':
                        setDefensePrompt({
                            attacker: typedMsg.attacker,
                            target: typedMsg.target,
                            damage: typedMsg.damage,
                            cardId: typedMsg.cardId,
                            defenseCardId: typedMsg.defenseCardId
                        })
                        setPhase('defense')
                        setPlayView({
                            attacker: typedMsg.attacker,
                            attackCardId: typedMsg.cardId,
                            target: typedMsg.target,
                            defenseCardId: typedMsg.defenseCardId ?? null
                        })
                        setSelectedTarget(null)
                        setSelectedCardIndex(null)
                        break
                    case 'replay':
                        if (replayTimerRef.current !== null) {
                            window.clearTimeout(replayTimerRef.current)
                        }
                        setReplayStage(typedMsg.stage)
                        replayTimerRef.current = window.setTimeout(() => {
                            setReplayStage(null)
                        }, 600)
                        if (typedMsg.stage === 'attack') {
                            setPlayView(prev => ({
                                ...prev,
                                attacker: typedMsg.attacker ?? prev.attacker ?? null,
                                target: typedMsg.target ?? prev.target ?? null,
                                attackCardId: typedMsg.cardId ?? prev.attackCardId ?? null
                            }))
                        }
                        if (typedMsg.stage === 'defense') {
                            setPlayView(prev => ({
                                ...prev,
                                defenseCardId: typedMsg.cardId ?? prev.defenseCardId ?? null
                            }))
                        }
                        if (typedMsg.stage === 'damage') {
                            if (damageTimerRef.current !== null) {
                                window.clearTimeout(damageTimerRef.current)
                            }
                            setDamagePopup({
                                target: typedMsg.target ?? null,
                                amount: typedMsg.amount ?? 0
                            })
                            damageTimerRef.current = window.setTimeout(() => {
                                setDamagePopup(null)
                            }, 900)
                        }
                        break
                    case 'hand_update':
                        console.log('hand_update', typedMsg.hand)
                        {
                            const incoming = typedMsg.hand ?? []
                            // 本来の3枚に、位置連動のオリジナルカード（非デッキ由来）を1枚追加表示する
                            const aiId = aiCardIdRef.current
                            setHand(aiId && !aiCardUsedRef.current ? [...incoming, aiId] : incoming)
                            if (incoming.length < 3 && wsRef.current?.readyState === WebSocket.OPEN) {
                                wsRef.current.send(JSON.stringify({ type: 'sync' }))
                            }
                        }
                        setSelectedCardIndex(null)
                        break
                    case 'ai_card':
                        parseAiCardDetail(typedMsg.card_id, typedMsg.card_effect, typedMsg.card_img)
                        if (!typedMsg.player || typedMsg.player === name) {
                            if (aiCardUsedRef.current) break
                            aiCardIdRef.current = typedMsg.card_id
                            setAiCardId(typedMsg.card_id)
                            setAiCardUsed(false)
                            aiCardUsedRef.current = false
                            setHand(prev => (
                                prev.includes(typedMsg.card_id)
                                    ? prev
                                    : [...prev, typedMsg.card_id]
                            ))
                        }
                        break
                    default:
                        console.warn('未処理のタイプを受信', typedMsg)
                }
            } catch (error) {
                console.log(error);
            }
        }
        return () => {
            if (replayTimerRef.current !== null) {
                window.clearTimeout(replayTimerRef.current)
            }
            if (damageTimerRef.current !== null) {
                window.clearTimeout(damageTimerRef.current)
            }
            try { ws.close() } catch(error) { console.log(error) }
        }
    }, [room, name, navigate])

    // ====== ターン状態に応じたクリア処理 ======
    useEffect(() => {
        if (!canPlayAttackCard) {
            setSelectedTarget(null)
            setSelectedCardIndex(null)
        }
    }, [canPlayAttackCard])

    // === 決着したかを同期的に伝える ===
    useEffect(() => { finishRef.current = finish.results }, [finish.results])

    // ====== カード判定 ======
    const requiresTarget = (cardId: number) => CARD_LIBRARY[cardId]?.requiresTarget ?? false
    const isDefenseCard = (cardId: number) => {
        const aiMeta = aiCardMap[cardId]
        if (aiMeta) return aiMeta.category === 'defense'
        return CARD_LIBRARY[cardId]?.category === 'defense'
    }
    const isAiCard = (cardId: number) => aiCardId !== null && cardId === aiCardId

    // ====== カード実行 ======
    const play = (cardId: number) => {
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        if (phase === 'defense') {
            if (!isDefenseTurn) return
            if (!isDefenseCard(cardId)) return
        } else {
            if (!canPlayAttackCard) return
            if (isDefenseCard(cardId)) return
        }
        const payload: { type: 'play'; cardId: number; target?: string } = { type: 'play', cardId }
        if (phase === 'action' && requiresTarget(cardId)) {
            const meta: CardMeta | undefined = aiCardMap[cardId] ?? CARD_LIBRARY[cardId]
            let targetChoice = selectedTarget
            if (!targetChoice) {
                if (meta?.category === 'heal') {
                    targetChoice = name
                } else if (meta?.category === 'attack') {
                    targetChoice = defaultAttackTarget(name)
                } else if (meta?.category === 'special') {
                    targetChoice = meta.allowSelfTarget ? name : defaultAttackTarget(name)
                } else if (meta?.allowSelfTarget) {
                    targetChoice = name
                }
            }
            if (!targetChoice) return
            payload.target = targetChoice
        }
        wsRef.current.send(JSON.stringify(payload))
    }

    // ====== 行動決定 ======
    const commitAction = () => {
        if (finishRef.current) return
        if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
        const selectedCardId = selectedCardIndex !== null ? hand[selectedCardIndex] : null
        if (phase === 'defense') {
            if (!isDefenseTurn) return
            if (selectedCardId !== null) {
                if (!isDefenseCard(selectedCardId)) return
                setPlayView(prev => ({
                    attacker: defensePrompt?.attacker ?? prev.attacker ?? st.turn,
                    attackCardId: defensePrompt?.cardId ?? prev.attackCardId ?? null,
                    target: defensePrompt?.target ?? prev.target ?? null,
                    defenseCardId: selectedCardId
                }))
                play(selectedCardId)
                if (isAiCard(selectedCardId) && selectedCardIndex !== null) {
                    setHand(prev => prev.filter(id => id !== selectedCardId))
                    setAiCardUsed(true)
                    aiCardUsedRef.current = true
                }
                setSelectedCardIndex(null)
            } else {
                wsRef.current.send(JSON.stringify({ type:'end_turn' }))
            }
            return
        }
        // action phase
        if (!canPlayAttackCard) return
        if (selectedCardId !== null) {
            play(selectedCardId)
            if (requiresTarget(selectedCardId)) setSelectedTarget(null)
            if (isAiCard(selectedCardId) && selectedCardIndex !== null) {
                setHand(prev => prev.filter(id => id !== selectedCardId))
                setAiCardUsed(true)
                aiCardUsedRef.current = true
            }
            setSelectedCardIndex(null)
        } else {
            wsRef.current.send(JSON.stringify({ type:'end_turn' }))
        }
    }
    // const endTurn = () => {
    //     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    //     if (!canPlayAttackCard) return
    //     wsRef.current.send(JSON.stringify({ type:'end_turn' }))
    // }

    // const skipDefense = () => {
    //     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    //     if (!isDefenseTurn) return
    //     wsRef.current.send(JSON.stringify({ type:'end_turn' }))
    // }

    // 手札引き直し
    // const mulligan = () => {
    //     if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return
    //     if (!canMulligan) return
    //     wsRef.current.send(JSON.stringify({ type:'mulligan' }))
    // }

    // ====== HP 表示 ======
    const hpPercent = (player: string) => {
        const value = st.hp[player] ?? 0
        return Math.max(0, Math.min(100, (value / MAX_HP) * 100))
    }

    const hpBarClass = (player: string) => {
        const percent = hpPercent(player)
        if (percent <= 30) return styles.hpLow
        if (percent <= 50) return styles.hpHalf
        return styles.hpFull
    }

    const resolveStatus = (player: string): StatusEffects => (
        st.status[player] ?? { poison: 0, paralyze: 0, attackUp: 0, defenseUp: 0 }
    )

    const renderStatusBadges = (player: string) => {
        const status = resolveStatus(player)
        const badges: Array<{ key: string; label: string; className: string }> = []
        if (status.poison > 0) badges.push({ key: 'poison', label: `毒${status.poison}`, className: styles.statusPoison })
        if (status.paralyze > 0) badges.push({ key: 'paralyze', label: `まひ${status.paralyze}`, className: styles.statusParalyze })
        if (status.attackUp > 0) {
            badges.push({
                key: 'attackUp',
                label: `攻+${status.attackUp * STATUS_BONUS_VALUE.attackUp}`,
                className: styles.statusAttack
            })
        }
        if (status.defenseUp > 0) {
            badges.push({
                key: 'defenseUp',
                label: `防+${status.defenseUp * STATUS_BONUS_VALUE.defenseUp}`,
                className: styles.statusDefense
            })
        }
        if (badges.length === 0) return null
        return (
            <div className={styles.statusBadges}>
                {badges.map(badge => (
                    <span key={badge.key} className={`${styles.statusBadge} ${badge.className}`}>
                        {badge.label}
                    </span>
                ))}
            </div>
        )
    }

    // ====== プレイヤー並び ======
    const playersToDisplay = (() => {
        const ordered = st.players.length ? [...st.players] : [...Object.keys(st.hp)]
        const idx = ordered.indexOf(name)
        if (idx > 0) {
            ordered.splice(idx, 1)
            ordered.unshift(name)
        }
        return ordered
    })()
    const defenseTarget = defensePrompt?.target
    // カードIDから表示用メタを解決
    const resolveCardMetaById = (cardId: number | null | undefined): CardMeta | undefined => {
        if (cardId === null || cardId === undefined) return undefined
        return aiCardMap[cardId] ?? CARD_LIBRARY[cardId]
    }

    const selectedCardId = selectedCardIndex !== null ? hand[selectedCardIndex] : null
    const selectedCardMeta = resolveCardMetaById(selectedCardId)

    // ====== ターゲットの既定選択 ======
    const defaultAttackTarget = (current: string) => {
        const order = st.players.length ? st.players : Object.keys(st.hp)
        const idx = order.indexOf(current)
        if (idx === -1 || order.length === 0) return null
        for (let i = 1; i <= order.length; i++) {
            const candidate = order[(idx + i) % order.length]
            if ((st.hp[candidate] ?? 0) > 0) {
                return candidate
            }
        }
        return null
    }

    // ====== プレイログ表示用のカード/名前 ======
    const attackCardIdForDisplay = (() => {
        if (phase === 'defense' && defensePrompt) {
            return defensePrompt.cardId ?? playView.attackCardId
        }
        if (canPlayAttackCard && selectedCardId !== null) return selectedCardId
        return playView.attackCardId ?? null
    })()

    const defenseCardIdForDisplay = (() => {
        if (phase === 'defense') {
            if (isDefenseTurn && selectedCardId !== null) return selectedCardId
            if (defensePrompt?.defenseCardId !== undefined) return defensePrompt.defenseCardId
            return playView.defenseCardId ?? null
        }
        return playView.defenseCardId ?? null
    })()

    const leftPlayerName = (() => {
        if (phase === 'defense' && defensePrompt) return defensePrompt.attacker
        if (canPlayAttackCard) return st.turn
        return playView.attacker ?? st.turn
    })()

    const rightPlayerName = (() => {
        if (phase === 'defense' && defensePrompt) return defensePrompt.target
        if (canPlayAttackCard) return selectedTarget
        return playView.target ?? selectedTarget
    })()

    const leftCardMeta = resolveCardMetaById(attackCardIdForDisplay)
    const rightCardMeta = (() => {
        if (phase === 'defense') return resolveCardMetaById(defenseCardIdForDisplay)
        if (canPlayAttackCard) return selectedTarget ? selectedCardMeta : null
        return resolveCardMetaById(playView.defenseCardId ?? null)
    })()

    // let turnInfoMessage = ''
    // if (phase === 'defense') {
    //     if (defensePrompt) {
    //         if (isDefenseTurn) {
    //             turnInfoMessage = `${defensePrompt.attacker} の攻撃(${defensePrompt.damage})を防御してください`
    //         } else {
    //             turnInfoMessage = `${defensePrompt.target} が防御処理中です`
    //         }
    //     } else {
    //         turnInfoMessage = '防御処理中…'
    //     }
    // } else if (canPlayAttackCard) {
    //     turnInfoMessage = selectedTarget
    //         ? `あなたのターン: ${selectedTarget} をターゲット中`
    //         : 'あなたのターンです。攻撃対象を選んでください'
    // } else {
    //     turnInfoMessage = `${st.turn || '---'} のターンです。`
    // }

    // ====== カードカテゴリごとのクラス ======
    const categoryClass: Record<CardCategory, string> = {
        attack: styles.attack,
        defense: styles.defense,
        heal: styles.heal,
        special: styles.special
    }

    // AI生成カードをstringからJSONに復元
    const parseAiCardDetail = (cardId: number, aiCardText?: string, img?: string) => {
        const parsed = stringToJson(aiCardText)
        if (!parsed) return
        const meta: CardMeta = {
            id: cardId,
            label: parsed.name,
            detail: parsed.effect,
            category: parsed.category,
            img: img ?? ''
        }
        setAiCardMap(prev => ({ ...prev, [cardId]: meta }))
    }

    // ルームへ戻る遷移
    const gameToRooms = (con: boolean) => {
        if (navigatedRef.current) return
        navigatedRef.current = true

        setDefensePrompt(null)
        setPhase('action')
        setHand([])

        const navState = {
            joined: con,
            roomId: room,
            name,
            members: playersRef.current
        }
        try { wsRef.current?.close() } catch (error) { console.log(error) }
        navigate('/rooms', {
            replace: true,
            state: navState
        })
    }


    // ====== プレイログのカード表示 ======
    const CardSlot = ({
        card,
        isSelf,
        animate
    }: {
        card: typeof selectedCardMeta | null | undefined
        isSelf: boolean
        animate: boolean
    }) => {
        const showCard = card && (card.category !== 'attack' || isSelf)
        return (
            <div className={styles.cardSlot}>
                {showCard ? (
                    <div className={`${styles.selectedCardBar} ${categoryClass[card.category] ?? ''} ${animate ? styles.replayRise : ''}`}>
                        <SelectedCard
                            card={card}
                            resolveCardImgSrc={resolveCardImgSrc}
                            small={false}
                            />
                    </div>
                ) : (
                    <div className={styles.selectedCardBar}>
                        <p className={styles.selectedCardDetail}>
                            {
                                isDefenseTurn ? '防御カードを選択してください' : isSelf ? 'カードを選択してください' : selectedTarget ? `${selectedTarget}をターゲット中` :'ターゲットを選択してください'
                            }
                        </p>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <div className={styles.resultArea}>
                <div className={styles.pc}>
                    <div className={styles.header}>
                        <p><span>ターン {st.round}</span></p>
                    </div>
                    <div className={styles.playArea}>
                        <div className={styles.playLabelArea}>
                            <div className={styles.leftPlayerName}><p>{leftPlayerName ?? '---'}</p></div>
                            <div className={styles.arrow}><img src={`arrow.svg`}/></div>
                            <div className={styles.rightPlayerName}><p>{rightPlayerName ?? '---'}</p></div>
                        </div>
                        <div className={styles.playCardArea}>
                            <div className={styles.leftCard}><CardSlot card={leftCardMeta} isSelf={true} animate={replayStage === 'attack'} /></div>
                            <div style={{opacity: 0}}><img src={`arrow.svg`}/></div>
                            <div className={styles.rightCard}><CardSlot card={rightCardMeta ?? null} isSelf={false} animate={replayStage === 'defense'} /></div>
                        </div>
                        {damagePopup && damagePopup.amount > 0 && (
                            <div className={styles.damagePopup} key={`${damagePopup.target ?? 'target'}-${damagePopup.amount}`}>
                                -{damagePopup.amount}
                            </div>
                        )}
                    </div>
                </div>
                <section className={styles.playersBoard}>
                    {playersToDisplay.length === 0 && (
                        <p className={styles.placeholder}>プレイヤー情報を待機中...</p>
                    )}
                    {playersToDisplay.map(player => {
                        const hp = st.hp[player] ?? 0
                        if (player === name) {
                            const classes = [
                                styles.playerCard,
                                styles.myPlayerCard,
                                player === st.turn ? styles.cardIsTurn : '',
                                (st.status[player]?.paralyze ?? 0) > 0 ? styles.cardParalyzed : '',
                                defenseTarget === player ? styles.cardIsTarget : '',
                                canSelectTarget && hp > 0 ? styles.cardSelectable : '',
                                selectedTarget === player ? styles.cardSelected : ''
                            ].join(' ').trim()
                            return (
                                <div
                                    key={player}
                                    className={classes}
                                    onClick={() => {
                                        if (!canSelectTarget) return
                                        if (hp <= 0) return
                                        setSelectedTarget(prev => prev === player ? null : player)
                                    }}
                                    role={canSelectTarget && hp > 0 ? 'button' : undefined}
                                    aria-pressed={canSelectTarget && selectedTarget === player}
                                >
                                    <div className={styles.playerHeader}>
                                        <div className={styles.playerTitleRow}>
                                            <p className={styles.playerName}>
                                                {player}
                                            </p>
                                            <div className={styles.hpRow}>
                                                {/* {player === st.turn && <span className={styles.turnBadge}>現在のターン</span>} */}
                                                <span className={styles.hpValue}>HP {hp}</span>
                                            </div>
                                        </div>
                                        {renderStatusBadges(player)}
                                    </div>
                                    <div className={styles.hpBarTrack}>
                                        <div className={`${styles.hpBar} ${hpBarClass(player)}`} style={{ width: `${hpPercent(player)}%` }} />
                                    </div>
                                </div>
                            )
                        }
                    })}
                    <div className={styles.enemyPlayersBoard}>
                        {playersToDisplay.map(player => {
                            const hp = st.hp[player] ?? 0
                            if (player !== name) {
                            const classes = [
                                styles.playerCard,
                                styles.enemyPlayerCard,
                                player === st.turn ? styles.cardIsTurn : '',
                                player === name ? styles.cardIsSelf : '',
                                (st.status[player]?.paralyze ?? 0) > 0 ? styles.cardParalyzed : '',
                                defenseTarget === player ? styles.cardIsTarget : '',
                                canSelectTarget && hp > 0 ? styles.cardSelectable : '',
                                selectedTarget === player ? styles.cardSelected : ''
                                ].join(' ').trim()
                                return (
                                    <div
                                        key={player}
                                        className={classes}
                                        onClick={() => {
                                            if (!canSelectTarget) return
                                            if (hp <= 0) return
                                            setSelectedTarget(prev => prev === player ? null : player)
                                        }}
                                        role={canSelectTarget && hp > 0 ? 'button' : undefined}
                                        aria-pressed={canSelectTarget && selectedTarget === player}
                                    >
                                    <div className={styles.playerHeader}>
                                        <div className={styles.playerTitleRow}>
                                            <p className={styles.playerName}>
                                                {player}
                                            </p>
                                            <div className={styles.hpRow}>
                                                {/* {player === st.turn && <span className={styles.turnBadge}>現在のターン</span>} */}
                                                <span className={styles.hpValue}>HP {hp}</span>
                                            </div>
                                        </div>
                                        {renderStatusBadges(player)}
                                    </div>
                                        <div className={styles.hpBarTrack}>
                                        <div className={`${styles.hpBar} ${hpBarClass(player)}`} style={{ width: `${hpPercent(player)}%` }} />
                                    </div>
                                </div>
                            )
                        }
                        })}
                    </div>
                </section>
            </div>

            <div className={styles.selectArea}>
                <section className={styles.actions}>
                    <div className={styles.handCards}>
                        {hand.length === 0 && <span className={styles.emptyHand}>カードなし</span>}
                        {hand.map((cardId, idx) => {
                            const meta: CardMeta | undefined = aiCardMap[cardId] ?? CARD_LIBRARY[cardId]
                            if (!meta) return null
                            const perCardCategoryClass = categoryClass[meta.category] ?? ''
                            const usable = !isParalyzed
                                && (isAiCard(cardId) ? !aiCardUsed : true)
                                && (meta.category === 'defense'
                                    ? isDefenseTurn
                                    : canPlayAttackCard)
                            return (
                                <button
                                    key={`${cardId}-${idx}`}
                                    className={`${styles.cardToken} ${selectedCardIndex === idx ? styles.cardTokenSelected : ''} ${perCardCategoryClass} ${isParalyzed ? styles.cardParalyzed : ''}`}
                                    disabled={!usable}
                                    onClick={() => {
                                        if (!usable) return
                                        setSelectedCardIndex(prev => prev === idx ? null : idx)
                                    }}
                                >
                                    <SelectedCard
                                        card={meta}
                                        resolveCardImgSrc={resolveCardImgSrc}
                                        small={true}
                                        />
                                </button>
                            )
                        })}
                    </div>
                    {/* <div className={styles.mulliganRow}>
                        <button className={styles.mulliganBtn} disabled={!canMulligan} onClick={mulligan}>
                            手札を引き直す
                        </button>
                        <span className={styles.mulliganHint}>防御カード3枚のときのみ使用可（ターン終了）</span>
                    </div> */}
                </section>
                <div className={`${styles.cardButtons} ${playersToDisplay.length <= 4 ? styles.btnStyleAdjustment : ''}`}>
                    <NormalBtn 
                        label={selectedCardIndex !== null ? '行動決定' : phase === 'defense' ? '防御しない' : 'ターンエンド'}
                        disabled={phase === 'defense' ? !isDefenseTurn : !canPlayAttackCard}
                        onClick={commitAction}
                    /> 
                </div>
            </div>
            {finish.results && (  
            <div className={styles.matchResults}>
                <div className={styles.matchResultsWinnerWrap}>
                    <div className={styles.winnerBadge}>
                        <img className={styles.winner} src={`winner.svg`} alt="勝者" />
                        <img className={styles.bigLight} src={`bigLight.svg`}/>
                        <img className={styles.miniLight} src={`miniLight.svg`}/>
                    </div>
                    <p className={styles.winnerName}>{finish.winner}</p>
                </div>
                <div className={styles.matchResultsBtnWrap}>
                    <div className={styles.stopGame}>
                        <NormalBtn label='やめる' bg='#c7c7c7ff' onClick={() => {
                            gameToRooms(false)
                        }} />
                    </div>
                    <div className={styles.continueGame}>
                        <NormalBtn label='続ける' onClick={() => {
                            gameToRooms(true)
                        }} />
                    </div>
                </div>
            </div>
            )}
        </div>
    )
}
