// O sinal de "site pronto": o loading dispara quando o essencial carregou
// e acabou de sair da frente. Quem depende disso (o intro, que só pode
// começar a tocar com a tela visível; o vídeo da galeria, que só começa a
// baixar depois pra não disputar banda com o intro) se inscreve aqui.
let ready = false;
const listeners = new Set<() => void>();

export function markSiteReady() {
  if (ready) return;
  ready = true;
  listeners.forEach((cb) => cb());
  listeners.clear();
}

export function isSiteReady() {
  return ready;
}

// chama cb quando o site estiver pronto (na hora, se já estiver);
// devolve a função que cancela a inscrição
export function onSiteReady(cb: () => void) {
  if (ready) {
    cb();
    return () => {};
  }
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
