import { Link } from "react-router-dom"
import styles from "./styles.module.css"
import NormalBtn from "../../components/button/NormalBtn"
import stepOne from "../../assets/stepOne.png"
import stepTue from "../../assets/stepTue.png"
import stepTre from "../../assets/stepTre.png"

export default function Home() {
    return(
        <>
            <title>待ち時間の暇つぶしに最適！友達とできるブラウザ対戦カードゲーム｜ジオバスターズ</title>
            <main className={styles.page}>
                <header className={styles.hero}>
                    <div className={styles.heroInner}>
                    <p className={styles.kicker}>登録不要・無料・ブラウザで即対戦</p>

                    <h1 className={styles.h1}>
                        待ち時間を遊び時間に変える、友達とできる対戦カードゲーム
                    </h1>

                    <p className={styles.lead}>
                        飲食店の順番待ち、テーマパークの行列、集合待ち。
                        “各自スマホ”の時間を、会話と心理戦が生まれるバトルに。
                    </p>

                    <div className={styles.ctaRow}>
                        <Link to="/rooms" className={styles.primaryBtn}>
                            <NormalBtn label='今すぐ遊ぶ（ルームへ）' onClick={() => {}} />
                        </Link>
                        <a href="#about">
                            <NormalBtn label='どんなゲーム？' bg="#34d399" onClick={() => {}} />
                        </a>
                    </div>

                    <ul className={styles.badges}>
                        <li>2〜6人</li>
                        <li>短時間OK</li>
                        <li>アプリ不要</li>
                        <li>AIカード生成</li>
                    </ul>
                    </div>
                </header>

                {/* Sections */}
                <section className={styles.section} id="about">
                    <div className={styles.container}>
                    <h2 className={styles.h2}>GeoBustersとは？</h2>

                    <div className={styles.grid2}>
                        <article className={styles.card}>
                        <h3 className={styles.h3}>待ち時間の“気まずさ”を解消</h3>
                        <p className={styles.p}>
                            ちょっとした空き時間に、全員が同じ遊びに乗れる。
                            自然と会話が生まれる“その場のゲーム”です。
                        </p>
                        </article>

                        <article className={styles.card}>
                        <h3 className={styles.h3}>AI × 位置情報で限定カード</h3>
                        <p className={styles.p}>
                            現在地周辺のスポットから、必殺技カードをAIが生成。
                            “場所”がそのままバトルに反映されて盛り上がります。
                        </p>
                        </article>
                    </div>
                    </div>
                </section>

                <section className={styles.sectionAlt}>
                    <div className={styles.container}>
                    <h2 className={styles.h2}>こんな時におすすめ</h2>

                    <div className={styles.grid3}>
                        <div className={styles.smallCard}>
                        <p className={styles.smallTitle}>飲食店の入店待ち</p>
                        <p className={styles.smallText}>10〜30分の“間”が一瞬でイベントに。</p>
                        </div>
                        <div className={styles.smallCard}>
                        <p className={styles.smallTitle}>テーマパークの行列</p>
                        <p className={styles.smallText}>待機列のストレスを“熱狂”に変える。</p>
                        </div>
                        <div className={styles.smallCard}>
                        <p className={styles.smallTitle}>集合・移動の空き時間</p>
                        <p className={styles.smallText}>気まずい沈黙を“笑い”に。</p>
                        </div>
                    </div>
                    </div>
                </section>

                <section className={styles.section}>
                    <div className={styles.container}>
                    <h2 className={styles.h2}>遊び方（超ざっくり）</h2>

                    <ol className={styles.steps}>
                        <li className={styles.step}>
                            <span className={styles.stepNum}>1</span>
                            <div>
                                <div>
                                    <p className={styles.stepTitle}>ルームを作成 / 参加</p>
                                    <p className={styles.stepText}>URL共有だけでOK。登録なし。</p>
                                </div>
                                <img src={stepOne} alt="参考画像" />
                            </div>
                        </li>
                        <li className={styles.step}>
                            <span className={styles.stepNum}>2</span>
                            <div>
                                <div>
                                    <p className={styles.stepTitle}>カードを選んで行動</p>
                                    <p className={styles.stepText}>攻撃/防御/回復/特殊で読み合い。</p>
                                </div>
                                <img src={stepTue} alt="参考画像" />
                            </div>
                        </li>
                        <li className={styles.step}>
                            <span className={styles.stepNum}>3</span>
                            <div>
                                <div>
                                    <p className={styles.stepTitle}>生き残りで勝利</p>
                                    <p className={styles.stepText}>必殺カードで最後まで展開が動く。</p>
                                </div>
                                <div className={styles.stepTre}>
                                    <img src={stepTre} alt="参考画像" />
                                </div>
                            </div>
                        </li>
                    </ol>

                    <div className={styles.bottomCta}>
                        <Link to="/rooms" className={styles.primaryBtn}>
                            <NormalBtn label='今すぐ遊ぶ（ルームへ）' onClick={() => {}} />
                        </Link>
                        <p className={styles.bottomNote}>
                        ※ブラウザのみでOK / アプリ・登録不要
                        </p>
                    </div>
                    </div>
                </section>
            </main>
        </>
    )
}