import styles from './styles.module.css'

type Type = {
    label: string,
    bg?: string,
    onClick: () => void,
    disabled?: boolean
}

/**
 * 通常のボタンコンポーネント
 * @param {string} label - ボタンに表示する文字
 * @param {string | undefined} bg - 背景の指定
 * @param {() => void} onClick - 処理内容
 * @param {boolean | undefined} disabled - 押せなくする
 */
export default function NormalBtn(props: Type) {
    const { label, bg, onClick, disabled } = props
    return(
        <>
            <button
                className={styles.btn}
                style={{backgroundColor: bg}}
                onClick={onClick}
                disabled={disabled}
            >
                {label}
            </button>
        </>
    )
}
