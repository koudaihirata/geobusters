import type { CardMeta } from '../../utils/cards'
import styles from './styles.module.css'

type Props = {
  card: CardMeta
  resolveCardImgSrc: (card: CardMeta) => string
  small: boolean 
}

export default function SelectedCard({
  card,
  resolveCardImgSrc,
  small 
}: Props) {
  return (
    <>
      <div className={styles.cardImg}>
        <img src={resolveCardImgSrc(card)} />
      </div>
      <div className={styles.cardWrap}>
        <p className={styles.selectedCardName}>
          {small ?
          <span className={card.label.length > 8 ? styles.selectedCardNameLabelSmall : styles.selectedCardNameLabelNormal}>
              {card.label}
          </span>
          :
          <span className={card.label.length > 8 ? styles.selectedCardNameLabelNormal : styles.selectedCardNameLabel}>
            {card.label}
          </span>
          }
        </p>
        <p className={styles.selectedCardDetail}>{card.detail}</p>
      </div>
    </>
  )
}
