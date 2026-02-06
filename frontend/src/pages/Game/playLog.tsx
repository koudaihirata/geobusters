import styles from './styles.module.css'
import SelectedCard from '../../components/SelectedCard'
import type { CardMeta, CardCategory } from '../../utils/cards'

type CardSlotProps = {
  card: CardMeta | null | undefined
  isSelf: boolean
  animate: boolean
  isDefenseTurn: boolean
  selectedTarget: string | null
  categoryClass: Record<CardCategory, string>
  resolveCardImgSrc: (card: CardMeta) => string
}

export function CardSlot({
  card,
  isSelf,
  animate,
  isDefenseTurn,
  selectedTarget,
  categoryClass,
  resolveCardImgSrc
}: CardSlotProps) {
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
            {isDefenseTurn ? '防御カードを選択してください' : isSelf ? 'カードを選択してください' : selectedTarget ? `${selectedTarget}をターゲット中` : 'ターゲットを選択してください'}
          </p>
        </div>
      )}
    </div>
  )
}
