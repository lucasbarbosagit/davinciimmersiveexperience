import styles from "./SplitChars.module.css";

// quebra um texto em palavras-máscara com uma letra por <span>, pra
// animar letra a letra (cada letra sobe de trás da borda da sua palavra).
// As letras são aria-hidden: quem usa põe o texto inteiro em aria-label
// no elemento pai, senão o leitor de tela soletra.
export default function SplitChars({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((word, w) => (
        <span key={w} aria-hidden="true">
          <span className={styles.word}>
            {Array.from(word).map((ch, c) => (
              <span key={c} className={styles.char} data-char="">
                {ch}
              </span>
            ))}
          </span>
          {w < words.length - 1 ? " " : null}
        </span>
      ))}
    </>
  );
}
