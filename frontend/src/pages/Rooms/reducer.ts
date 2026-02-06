// src/pages/Rooms/reducer.ts

import type { CardMeta } from "../../utils/cards"
import { type WsAction } from "./action"

export type State = {
    roomId: string,
    name: string,
    connected: boolean,
    joined: boolean,
    input: string,
    logs: string[],
    members: string[],
    hostId: string | null,
    loading: boolean,
    aiCardDetail: CardMeta,
    errorMess: string
}

export const defaultState: State = {
    roomId: '',
    name: '',
    connected: false,
    joined: false,
    input: '',
    logs: [],
    members: [],
    hostId: null,
    loading: false,
    aiCardDetail: {
        id: 9999,
        label: '生成の巻',
        category: 'special',
        detail: 'AIにカードを生成してもらっています',
        img: ''
    },
    errorMess: ''
}

export function Reducer(state: State, action: WsAction): State {
    switch (action.type) {
        case 'SET_ROOM':
            if (state.connected) return state
            return {
                ...state, 
                roomId: action.roomId,
                errorMess: action.roomId.trim() ? '' : state.errorMess
            }
        case 'SET_NAME':
            if (state.connected) return state
            return {
                ...state,
                name: action.name,
                errorMess: action.name.trim() ? '' : state.errorMess
            }
        case 'CONNECTING':
            return {
                ...state,
                connected: false
            }
        case 'CONNECTED':
            return {
                ...state,
                connected: true
            }
        case 'DISCONNECTED':
            return {
                ...state,
                connected: false,
                joined: false,
                loading: false
            }
        case 'JOINED':
            return {
                ...state,
                joined: true,
                roomId: action.roomId
            }
        case 'SET_INPUT':
            return {
                ...state,
                input: action.input
            }
        case 'SET_LOADING':
            return {
                ...state,
                loading: action.loading
            }
        case 'APPEND_LOG':
            return {
                ...state,
                logs: [
                    ...state.logs,
                    action.line
                ]
            }
        case 'SET_MEMBERS': {
            const nextState: State = {
                ...state,
                members: action.members
            }
            if (Object.prototype.hasOwnProperty.call(action, 'hostId')) {
                nextState.hostId = action.hostId ?? null
            }
            return nextState
        }
        case 'AI_CARD_DETAIL': {
            return {
                ...state,
                aiCardDetail: {
                    id: state.aiCardDetail.id,
                    label: action.name,
                    category: action.category,
                    detail: action.effect,
                    img: action.img
                }
            }
        }
        case 'ERROR_MESSAGE': {
            return {
                ...state,
                errorMess: action.payload.errorMess
            }
        }
    }
    throw new (class SystemException {})()
}
