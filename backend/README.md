# バックエンド（GeoBusters）

ルームの管理、ゲーム進行、AIカード生成を担当する領域です。  
WebSocketでのリアルタイム通信と、Durable Objectsによる状態保持が中心です。

## ここでやっていること
- ルームの参加/退出とホスト管理
- ゲーム開始・ターン進行・勝敗判定
- 位置情報を使ったスポット検索
- AIカード生成と各プレイヤーへの配布

## 使用技術
- Cloudflare Workers
- Durable Objects（ルーム状態管理）
- WebSocket
- Hono
- Google Places API
- Gemini API（テキスト/画像生成）
- Cloudflare AI Gateway

## 主なファイル/構成
- `src/room.ts` : ルームDO本体（接続/状態/ブロードキャスト）
- `src/ws/lobby.ts` : ロビー処理（開始/AIカード生成）
- `src/ws/game.ts` : ゲーム進行ロジック
- `src/ws/cards.ts` : カードIDごとの効果定義
- `src/NearBySearch.ts` : 近隣スポット検索
- `src/gemini.ts` : AIカード生成

## 苦労した点
- WebSocketの再接続時に状態が崩れないようにする設計
- プレイヤーごとにAIカードを分けるロジック
- AIの返すJSONが不安定で、パースや正規化が必要だった点

## ここまで読んでくれた方へ
サーバーは「ゲームの正しさ」を担保する場所です。  
クライアント都合で状態が壊れないよう、できるだけここで整合性を取る設計にしています。
