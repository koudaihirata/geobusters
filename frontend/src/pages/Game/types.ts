import type { CardCategory } from '../../utils/cards'

export type StatusEffects = { poison: number; paralyze: number; attackUp: number; defenseUp: number }

export type S = {
  players: string[]
  hp: Record<string, number>
  status: Record<string, StatusEffects>
  round: number
  turn: string
}

export type SharedPlayView = {
  attacker?: string | null
  attackCardId?: number | null
  target?: string | null
  defenseCardId?: number | null
}

export type DefenseSnapshot = { attacker: string; target: string; damage: number; cardId?: number; defenseCardId?: number }

export type AiCardMsg = {
  type: 'ai_card'
  card_id: number
  spot: string
  card_effect: string
  card_img: string
  player?: string
}

export type GameStartedMsg = {
  type: 'game_started'
  players?: string[]
  hp?: Record<string, number>
  status?: Record<string, StatusEffects>
  round?: number
  turn?: string
}

export type StateMsg = {
  type: 'state'
  hp?: Record<string, number>
  status?: Record<string, StatusEffects>
  round?: number
  turn?: string
  phase?: 'action' | 'defense'
  defense?: DefenseSnapshot
}

export type PlayedMsg = {
  type: 'played'
  by?: string
  cardId?: number
  target?: string
  delta?: { hp?: Record<string, number> }
  status?: Record<string, StatusEffects>
  next?: { round?: number; turn?: string }
  defense?: { by: string; cardId?: number; blocked: number; cards?: number[] }
}

export type GameOverMsg = { type: 'game_over'; winner?: string }
export type PhaseChangedMsg = { type: 'phase_changed'; phase: 'lobby' | 'game' }
export type DefenseRequestedMsg = { type: 'defense_requested'; attacker: string; target: string; damage: number; cardId: number; defenseCardId?: number }
export type HandUpdateMsg = { type: 'hand_update'; hand: number[] }

export type ReplayMsg = {
  type: 'replay'
  stage: 'attack' | 'defense' | 'damage'
  attacker?: string
  target?: string
  defender?: string
  cardId?: number
  value?: number
  amount?: number
}

export type GameWsMsg =
  | GameStartedMsg
  | StateMsg
  | PlayedMsg
  | GameOverMsg
  | PhaseChangedMsg
  | DefenseRequestedMsg
  | HandUpdateMsg
  | AiCardMsg
  | ReplayMsg

export type CategoryClass = Record<CardCategory, string>
