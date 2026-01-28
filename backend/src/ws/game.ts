// src/ws/game.ts
import type { Client } from '../types'
import { getAttackEffect, getDefenseValue, getHealValue, isAttackCard, isDefenseCard, isHealCard, DEFAULT_DECK_IDS } from './cards'

export type GameDeps = {
    send: (ws: Client, obj: unknown) => void
    broadcast: (obj: unknown) => void
    getPlayers: () => string[]
    getAiCardMeta: (player: string, cardId: number) => { category: 'attack' | 'defense' | 'heal'; value: number } | null
    sendTo: (player: string, obj: unknown) => void
    revealAiCard: (player: string, cardId: number) => void
}

export type TurnPhase = 'action' | 'defense'

export type PendingDefense = {
    attacker: string
    target: string
    cardId: number
    damage: number
    totalDamage: number
    blocked: number
    cardsUsed: number[]
    lastDefenseCardId?: number
    statusEffect?: { status: 'poison' | 'paralyze' | 'attackUp' | 'defenseUp'; amount: number }
}

export type GameState = {
    started: boolean
    players: string[]
    hp: Map<string, number>
    status: Map<string, StatusEffects>
    round: number
    turnIdx: number
    deck: Record<string, number[]>
    discard: Record<string, number[]>
    deckVer: number
    phase: TurnPhase
    pendingDefense?: PendingDefense
    hands: Map<string, number[]>
    lastActor?: string
    aiCardUsed: Set<string>
}

export type StatusEffects = {
    poison: number
    paralyze: number
    attackUp: number
    defenseUp: number
}

const EMPTY_STATUS: StatusEffects = {
    poison: 0,
    paralyze: 0,
    attackUp: 0,
    defenseUp: 0
}

const ATTACK_UP_BONUS = 2
const DEFENSE_UP_BONUS = 2

export class GameEngine {
    state: GameState = {
        started: false,
        players: [],
        hp: new Map(),
        status: new Map(),
        round: 1,
        turnIdx: 0,
        deck: {},
        discard: {},
        deckVer: 1,
        phase: 'action',
        pendingDefense: undefined,
        hands: new Map(),
        lastActor: undefined,
        aiCardUsed: new Set()
    }

    currentTurnName() { return this.state.players[this.state.turnIdx] ?? '' }
    alivePlayers() {
        return this.state.players.filter(p => (this.state.hp.get(p) ?? 0) > 0)
    }
    advanceTurnFrom(actor: string) {
        const idx = this.state.players.indexOf(actor)
        if (idx === -1 || this.state.players.length === 0) {
            this.state.turnIdx = 0
            return
        }
        this.state.turnIdx = (idx + 1) % this.state.players.length
        if (this.state.turnIdx === 0) this.state.round += 1
        this.state.lastActor = actor
    }
    removeDefeatedPlayers() {
        const alive = this.alivePlayers()
        const aliveSet = new Set(alive)
        if (aliveSet.size === this.state.players.length) return alive
        this.state.players = this.state.players.filter(p => aliveSet.has(p))
        if (this.state.turnIdx >= this.state.players.length) {
            this.state.turnIdx = 0
        }
        return alive
    }

    buildDeck() {
        // === デッキ一覧 ===
        const ids = DEFAULT_DECK_IDS
        for (let i = ids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1))
            ;[ids[i], ids[j]] = [ids[j], ids[i]]
        }
        return ids
    }

    drawCards(player: string, count: number) {
        this.state.deck[player] = this.state.deck[player] ?? this.buildDeck()
        this.state.discard[player] = this.state.discard[player] ?? []
        const deck = this.state.deck[player]
        const discard = this.state.discard[player]
        const hand = this.state.hands.get(player) ?? []
        const drawn: number[] = []
        for (let i = 0; i < count; i++) {
            if (deck.length === 0) {
                if (discard.length === 0) break
                while (discard.length) deck.push(discard.pop()!)
                for (let k = deck.length - 1; k > 0; k--) {
                    const j = Math.floor(Math.random() * (k + 1))
                    ;[deck[k], deck[j]] = [deck[j], deck[k]]
                }
            }
            const card = deck.shift()
            if (typeof card === 'number') {
                drawn.push(card)
                hand.push(card)
            }
        }
        this.state.hands.set(player, hand)
        return drawn
    }

    removeCardFromHand(player: string, cardId: number) {
        const hand = this.state.hands.get(player) ?? []
        const idx = hand.indexOf(cardId)
        if (idx === -1) return false
        hand.splice(idx, 1)
        this.state.hands.set(player, hand)
        this.state.discard[player] = this.state.discard[player] ?? []
        this.state.discard[player].push(cardId)
        return true
    }

    private sendHand(deps: GameDeps, player: string) {
        const hand = [...(this.state.hands.get(player) ?? [])]
        deps.sendTo(player, { type: 'hand_update', hand })
    }

    sendHandSnapshot(deps: GameDeps, player: string) {
        this.sendHand(deps, player)
    }

    private sendError(deps: GameDeps, player: string, text: string) {
        deps.sendTo(player, { type: 'error', text })
    }

    private useCard(deps: GameDeps, player: string, cardId: number): boolean {
        if (!this.removeCardFromHand(player, cardId)) {
            this.sendError(deps, player, '指定したカードは手札にありません')
            return false
        }
        this.drawCards(player, 1)
        this.sendHand(deps, player)
        return true
    }

    ensureStarted(deps: GameDeps) {
        if (this.state.started) return
        const players = deps.getPlayers()
        if (players.length < 2) return
        this.state.started = true
        this.state.players = players
        this.state.hp = new Map(players.map(n => [n, 10]))
        this.state.status = new Map(players.map(n => [n, { ...EMPTY_STATUS }]))
        this.state.round = 1
        this.state.turnIdx = 0
        this.state.deck = {}
        this.state.discard = {}
        this.state.hands = new Map()
        this.state.aiCardUsed = new Set()
        for (const player of players) {
            this.state.deck[player] = this.buildDeck()
            this.state.discard[player] = []
            this.state.hands.set(player, [])
            this.drawCards(player, 3)
        }
        this.state.phase = 'action'
        this.state.pendingDefense = undefined
        deps.broadcast({
            type: 'game_started',
            players: this.state.players,
            hp: Object.fromEntries(this.state.hp),
            status: this.statusSnapshot(),
            round: this.state.round,
            turn: this.currentTurnName(),
            deckVer: this.state.deckVer,
        })
        for (const player of players) {
            this.sendHandSnapshot(deps, player)
        }
    }

    handleMessage(deps: GameDeps, ws: Client, actor: string, parsed: any): 'game_over' | void {
        if (parsed.type === 'sync') {
            deps.send(ws, {
                type: 'state',
                hp: Object.fromEntries(this.state.hp),
                status: this.statusSnapshot(),
                round: this.state.round,
                turn: this.currentTurnName(),
                phase: this.state.phase,
                defense: this.state.pendingDefense ? {
                    attacker: this.state.pendingDefense.attacker,
                    target: this.state.pendingDefense.target,
                    damage: this.state.pendingDefense.damage,
                    cardId: this.state.pendingDefense.cardId,
                    defenseCardId: this.state.pendingDefense.lastDefenseCardId
                } : undefined
            })
            this.sendHandSnapshot(deps, actor)
            return
        }

        if (parsed.type === 'play') {
            if (this.state.phase === 'defense') {
                return this.handleDefensePlay(deps, ws, actor, parsed)
            }
            return this.handleActionPlay(deps, ws, actor, parsed)
        }

        if (parsed.type === 'end_turn') {
            if (this.state.phase === 'defense') {
                if (this.state.pendingDefense && this.state.pendingDefense.target === actor) {
                    return this.finishPendingDefense(deps)
                }
                return
            }
            if (!this.state.started) return
            if (actor !== this.currentTurnName()) return
            this.consumeStatusTurn(actor)
            const nextInfo = this.advanceTurnInfoWithStatus(deps, actor)
            if (nextInfo === 'game_over') return 'game_over'
            deps.broadcast({
                type:'state',
                hp: Object.fromEntries(this.state.hp),
                status: this.statusSnapshot(),
                round: this.state.round,
                turn: this.currentTurnName(),
                phase: this.state.phase,
                defense: this.state.pendingDefense ? {
                    attacker: this.state.pendingDefense.attacker,
                    target: this.state.pendingDefense.target,
                    damage: this.state.pendingDefense.damage,
                    cardId: this.state.pendingDefense.cardId,
                    defenseCardId: this.state.pendingDefense.lastDefenseCardId
                } : undefined
            })
            return
        }

        if (parsed.type === 'mulligan') {
            if (!this.state.started) { deps.send(ws, { type:'error', text:'ゲーム未開始' }); return }
            if (this.state.phase !== 'action') { deps.send(ws, { type:'error', text:'防御ターンでは使用できません' }); return }
            if (actor !== this.currentTurnName()) { deps.send(ws, { type:'error', text:'あなたのターンではありません' }); return }
            this.handleMulligan(deps, actor)
            return
        }
    }
    

    private handleActionPlay(deps: GameDeps, ws: Client, actor: string, parsed: { cardId: number; target?: string }): 'game_over' | void {
        if (!this.state.started) { deps.send(ws, { type:'error', text:'ゲーム未開始' }); return }
        if (actor !== this.currentTurnName()) { deps.send(ws, { type:'error', text:'あなたのターンではありません' }); return }
        if (this.isParalyzed(actor)) { deps.send(ws, { type:'error', text:'まひ状態のためカードを使用できません' }); return }

        const { cardId, target } = parsed

        /* AIカード（プレイヤー専用のID） */
        const aiMeta = deps.getAiCardMeta(actor, cardId)
        console.log('aiMeta攻撃確認', JSON.stringify(aiMeta))
        if (aiMeta) {
            if (this.state.aiCardUsed.has(actor)) { deps.send(ws, { type:'error', text:'AIカードは既に使用済みです' }); return }

            if (aiMeta.category === 'attack') {
                const targetName = this.resolveTarget(actor, target)
                if (!targetName) { deps.send(ws, { type:'error', text:'攻撃可能なターゲットがいません' }); return }
                const damage = aiMeta.value + this.consumeAttackBonus(actor)
                deps.revealAiCard(actor, cardId)
                deps.broadcast({
                    type: 'replay',
                    stage: 'attack',
                    attacker: actor,
                    target: targetName,
                    cardId,
                    value: damage
                })
                this.state.aiCardUsed.add(actor)
                this.state.pendingDefense = { attacker: actor, target: targetName, cardId, damage, totalDamage: damage, blocked: 0, cardsUsed: [], lastDefenseCardId: undefined }
                this.state.phase = 'defense'
                deps.broadcast({
                    type: 'defense_requested',
                    attacker: actor,
                    target: targetName,
                    damage,
                    cardId,
                    defenseCardId: undefined
                })
                return
            }

            if (aiMeta.category === 'heal') {
                const targetName = target ?? actor
                const healValue = aiMeta.value
                const cur = this.state.hp.get(targetName) ?? 0
                this.state.hp.set(targetName, cur + healValue)
                deps.revealAiCard(actor, cardId)
                this.state.aiCardUsed.add(actor)
                this.consumeStatusTurn(actor)
                const nextInfo = this.advanceTurnInfoWithStatus(deps, actor)
                if (nextInfo === 'game_over') return 'game_over'
                deps.broadcast({
                    type:'played',
                    by: actor,
                    cardId,
                    target: targetName,
                    delta:{ hp: { [targetName]: healValue } },
                    status: this.statusSnapshot(),
                    next: nextInfo
                })
                return
            }

            deps.send(ws, { type:'error', text:'防御AIカードは防御ターンでのみ使用できます' })
            return
        }

        /* 攻撃カード */
        if (isAttackCard(cardId)) {
            const targetName = this.resolveTarget(actor, target)
            if (!targetName) { deps.send(ws, { type:'error', text:'攻撃可能なターゲットがいません' }); return }
            if (!this.useCard(deps, actor, cardId)) return
            const attackEffect = getAttackEffect(cardId)
            if (!attackEffect) {
                deps.send(ws, { type:'error', text:`未知の攻撃カード: ${cardId}` })
                return
            }

            const totalDamage = attackEffect.damage + this.consumeAttackBonus(actor)
            deps.broadcast({
                type: 'replay',
                stage: 'attack',
                attacker: actor,
                target: targetName,
                cardId,
                value: totalDamage
            })

            this.state.pendingDefense = {
                attacker: actor,
                target: targetName,
                cardId,
                damage: totalDamage,
                totalDamage: totalDamage,
                blocked: 0,
                cardsUsed: [],
                lastDefenseCardId: undefined,
                statusEffect: attackEffect.statusEffect
            }
            this.state.phase = 'defense'
            deps.broadcast({
                type: 'defense_requested',
                attacker: actor,
                target: targetName,
                damage: totalDamage,
                cardId,
                defenseCardId: undefined
            })
            return
        }

        /* 回復カード */
        if (isHealCard(cardId)) {
            if (!this.useCard(deps, actor, cardId)) return
            const healValue = getHealValue(cardId)
            if (healValue === null) {
                deps.send(ws, { type:'error', text:`未知の回復カード: ${cardId}` })
                return
            }

            const targetName = target ?? actor
            const cur = this.state.hp.get(targetName) ?? 0
            this.state.hp.set(targetName, cur + healValue)
            this.consumeStatusTurn(actor)
            const nextInfo = this.advanceTurnInfoWithStatus(deps, actor)
            if (nextInfo === 'game_over') return 'game_over'
            deps.broadcast({
                type:'played',
                by: actor,
                cardId,
                target: targetName,
                delta:{ hp: { [targetName]: healValue } },
                status: this.statusSnapshot(),
                next: nextInfo
            })
            return
        }

        /* 防御カード */
        if (isDefenseCard(cardId)) {
            deps.send(ws, { type:'error', text:'防御カードは攻撃を受けたターンのみ使用できます' })
            return
        }

        deps.send(ws, { type:'error', text:`未知のカード: ${cardId}` })
    }

    private handleDefensePlay(deps: GameDeps, ws: Client, actor: string, parsed: { cardId: number }): 'game_over' | void {
        const pending = this.state.pendingDefense
        if (!pending) {
            this.state.phase = 'action'
            return
        }
        if (this.isParalyzed(actor)) {
            deps.send(ws, { type:'error', text:'まひ状態のためカードを使用できません' })
            return
        }
        if (actor !== pending.target) {
            deps.send(ws, { type:'error', text:'現在の防御ターンではありません' })
            return
        }
        if (!isDefenseCard(parsed.cardId)) {
            const aiMeta = deps.getAiCardMeta(actor, parsed.cardId)
            console.log('aiMeta防御確認', JSON.stringify(aiMeta))
            if (!aiMeta || aiMeta.category !== 'defense') {
                deps.send(ws, { type:'error', text:'使用できるのは防御カードのみです' })
                return
            }
            if (this.state.aiCardUsed.has(actor)) { deps.send(ws, { type:'error', text:'AIカードは既に使用済みです' }); return }
            deps.revealAiCard(actor, parsed.cardId)

            // 1攻撃につき防御カードは1枚だけ使用可
            if (pending.cardsUsed.length >= 1) {
                deps.send(ws, { type:'error', text:'この攻撃にはこれ以上防御カードを使えません' })
                return
            }

            const defenseValue = aiMeta.value + this.consumeDefenseBonus(actor)
            deps.broadcast({
                type: 'replay',
                stage: 'defense',
                defender: actor,
                cardId: parsed.cardId,
                value: defenseValue
            })
            this.state.aiCardUsed.add(actor)
            pending.damage = Math.max(0, pending.damage - defenseValue)
            pending.blocked += defenseValue
            pending.cardsUsed.push(parsed.cardId)
            pending.lastDefenseCardId = parsed.cardId

            // 防御カードは1枚のみ使用可とするため、この時点で防御処理を完了する
            return this.finishPendingDefense(deps)
        }
        // 1攻撃につき防御カードは1枚だけ使用可
        if (pending.cardsUsed.length >= 1) {
            deps.send(ws, { type:'error', text:'この攻撃にはこれ以上防御カードを使えません' })
            return
        }
        if (!this.useCard(deps, actor, parsed.cardId)) return
        const defenseValue = getDefenseValue(parsed.cardId)
        if (defenseValue === null) {
            deps.send(ws, { type:'error', text:`未知の防御カード: ${parsed.cardId}` })
            return
        }

        const totalDefense = defenseValue + this.consumeDefenseBonus(actor)
        deps.broadcast({
            type: 'replay',
            stage: 'defense',
            defender: actor,
            cardId: parsed.cardId,
            value: totalDefense
        })

        pending.damage = Math.max(0, pending.damage - totalDefense)
        pending.blocked += totalDefense
        pending.cardsUsed.push(parsed.cardId)
        pending.lastDefenseCardId = parsed.cardId

        // 防御カードは1枚のみ使用可とするため、この時点で防御処理を完了する
        return this.finishPendingDefense(deps)
    }

    private finishPendingDefense(deps: GameDeps): 'game_over' | void {
        const pending = this.state.pendingDefense
        if (!pending) return
        const blocked = Math.min(pending.blocked, pending.totalDamage)
        const netDamage = Math.max(0, pending.totalDamage - blocked)
        const delta: Record<string, number> = {}
        if (netDamage > 0) {
            const cur = this.state.hp.get(pending.target) ?? 0
            this.state.hp.set(pending.target, Math.max(0, cur - netDamage))
            delta[pending.target] = -netDamage
            deps.broadcast({
                type: 'replay',
                stage: 'damage',
                target: pending.target,
                amount: netDamage
            })
        }
        this.state.pendingDefense = undefined
        this.state.phase = 'action'
        this.consumeStatusTurn(pending.target)

        // === 毒のステータスを所持 ===
        if (pending.statusEffect && netDamage > 0) {
            const remainingHp = this.state.hp.get(pending.target) ?? 0
            if (remainingHp > 0) {
                this.applyStatus(pending.target, pending.statusEffect.status, pending.statusEffect.amount)
            }
        }
        const alive = this.removeDefeatedPlayers()
        if (this.state.players.length === 0) {
            this.state.started = false
            return
        }

        const nextInfo = this.advanceTurnInfoWithStatus(deps, pending.attacker)
        if (nextInfo === 'game_over') return 'game_over'

        deps.broadcast({
            type:'played',
            by: pending.attacker,
            cardId: pending.cardId,
            target: pending.target,
            delta:{ hp: delta },
            status: this.statusSnapshot(),
            next: nextInfo,
            defense: {
                by: pending.target,
                blocked,
                cardId: pending.lastDefenseCardId,
                cards: pending.cardsUsed
            }
        })

        if (alive.length === 1) {
            deps.broadcast({ type:'game_over', winner: alive[0] })
            this.state.started = false
            return 'game_over'
        }
    }

    private advanceTurnInfoWithStatus(deps: GameDeps, actor: string): { round: number; turn: string } | 'game_over' {
        let nextActor = actor
        const visited = new Set<string>()
        while (true) {
            this.advanceTurnFrom(nextActor)
            const current = this.currentTurnName()
            if (!current || visited.has(current)) {
                return { round: this.state.round, turn: this.currentTurnName() }
            }
            visited.add(current)
            const { statusChanged } = this.applyStartOfTurnEffects(deps, current)
            const alive = this.removeDefeatedPlayers()
            if (this.state.players.length === 0) {
                this.state.started = false
                return 'game_over'
            }
            if (alive.length === 1) {
                deps.broadcast({ type:'game_over', winner: alive[0] })
                this.state.started = false
                return 'game_over'
            }
            if (statusChanged) {
                deps.broadcast({
                    type:'state',
                    hp: Object.fromEntries(this.state.hp),
                    status: this.statusSnapshot(),
                    round: this.state.round,
                    turn: this.currentTurnName(),
                    phase: this.state.phase,
                    defense: this.state.pendingDefense ? {
                        attacker: this.state.pendingDefense.attacker,
                        target: this.state.pendingDefense.target,
                        damage: this.state.pendingDefense.damage,
                        cardId: this.state.pendingDefense.cardId,
                        defenseCardId: this.state.pendingDefense.lastDefenseCardId
                    } : undefined
                })
            }
            return { round: this.state.round, turn: this.currentTurnName() }
        }
    }

    private statusSnapshot(): Record<string, StatusEffects> {
        const entries = Array.from(this.state.status.entries()).map(([player, status]) => [player, { ...status }])
        return Object.fromEntries(entries)
    }

    private ensureStatus(player: string): StatusEffects {
        const existing = this.state.status.get(player)
        if (existing) return existing
        const next = { ...EMPTY_STATUS }
        this.state.status.set(player, next)
        return next
    }

    private applyStatus(player: string, status: keyof StatusEffects, amount: number) {
        const current = this.ensureStatus(player)
        current[status] = Math.max(0, current[status] + amount)
        this.state.status.set(player, current)
    }

    private consumeAttackBonus(player: string) {
        const current = this.ensureStatus(player)
        if (current.attackUp <= 0) return 0
        current.attackUp = Math.max(0, current.attackUp - 1)
        this.state.status.set(player, current)
        return ATTACK_UP_BONUS
    }

    private consumeDefenseBonus(player: string) {
        const current = this.ensureStatus(player)
        if (current.defenseUp <= 0) return 0
        current.defenseUp = Math.max(0, current.defenseUp - 1)
        this.state.status.set(player, current)
        return DEFENSE_UP_BONUS
    }

    private applyStartOfTurnEffects(deps: GameDeps, player: string) {
        const current = this.ensureStatus(player)
        let statusChanged = false

        // === 毒のダメージ処理 ====
        if (current.poison > 0) {
            const curHp = this.state.hp.get(player) ?? 0
            this.state.hp.set(player, Math.max(0, curHp - 1))
            statusChanged = true
            deps.broadcast({
                type: 'replay',
                stage: 'damage',
                target: player,
                amount: 1
            })
        }

        this.state.status.set(player, current)
        return { statusChanged }
    }

    // === まひ中かどうかの判定 ===
    private isParalyzed(player: string) {
        const current = this.ensureStatus(player)
        return current.paralyze > 0
    }

    private consumeStatusTurn(player: string) {
        const current = this.ensureStatus(player)
        if (current.paralyze <= 0 && current.poison <= 0) return
        // === 毒とまひのターン数減少 ===
        current.paralyze = Math.max(0, current.paralyze - 1)
        current.poison = Math.max(0, current.poison - 1)
        this.state.status.set(player, current)
    }

    private resolveTarget(actor: string, target?: string): string | null {
        const candidate = target ?? this.defaultTarget(actor)
        if (!candidate) return null
        const hp = this.state.hp.get(candidate) ?? 0
        if (hp <= 0) return null
        return candidate
    }

    private defaultTarget(actor: string): string | null {
        if (this.state.players.length <= 1) return null
        const idx = this.state.players.indexOf(actor)
        if (idx === -1) return null
        for (let i = 1; i < this.state.players.length + 1; i++) {
            const candidate = this.state.players[(idx + i) % this.state.players.length]
            if ((this.state.hp.get(candidate) ?? 0) > 0) {
                return candidate
            }
        }
        return null
    }

    private handleMulligan(deps: GameDeps, actor: string) {
        const hand = [...(this.state.hands.get(actor) ?? [])]
        if (hand.length !== 3) {
            this.sendError(deps, actor, '手札が3枚揃っていません')
            return
        }
        const allDefense = hand.every(card => isDefenseCard(card))
        if (!allDefense) {
            this.sendError(deps, actor, '防御カード3枚のときだけ引き直しできます')
            return
        }
        this.state.hands.set(actor, [])
        this.state.discard[actor] = this.state.discard[actor] ?? []
        this.state.discard[actor].push(...hand)
        this.drawCards(actor, hand.length)
        this.sendHand(deps, actor)

        deps.broadcast({
            type: 'system',
            text: `♻️ ${actor} が手札を引き直しました`,
            at: Date.now()
        })

        const nextInfo = this.advanceTurnInfoWithStatus(deps, actor)
        if (nextInfo === 'game_over') return
        deps.broadcast({
            type:'state',
            hp: Object.fromEntries(this.state.hp),
            status: this.statusSnapshot(),
            round: this.state.round,
            turn: this.currentTurnName(),
            phase: this.state.phase
        })
    }
}
