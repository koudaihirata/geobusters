import { useEffect, useState } from 'react'
import type { CardMeta } from '../../utils/cards'
import styles from './styles.module.css'
import { trimImage } from '../../utils/trimImage'

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
  const [trimmedSrc, setTrimmedSrc] = useState<string | null>(null)
  const rawSrc = resolveCardImgSrc(card)

  useEffect(() => {
    let isActive = true
    setTrimmedSrc(null)

    if (!rawSrc.startsWith('data:image/')) return

    const img = new Image()
    img.onload = () => {
      if (!isActive) return
      const result = trimImage(img)
      if (result) setTrimmedSrc(result)
    }
    img.src = rawSrc

    return () => {
      isActive = false
    }
  }, [rawSrc])

  return (
    <>
      <div className={styles.cardImg}>
        <img src={trimmedSrc ?? rawSrc} />
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
