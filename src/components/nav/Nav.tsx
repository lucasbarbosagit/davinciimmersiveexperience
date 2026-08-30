const LINKS = ["A experiência", "Os mestres", "Visitar"];

export default function Nav() {
  return (
    <nav
      id="site-nav"
      className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-[5vw] py-7 mix-blend-difference"
    >
      <div className="font-[family-name:var(--font-serif)] text-[19px] tracking-[2px] text-[var(--cream)]">
        Il Rinascimento
      </div>
      <div className="flex items-center gap-10">
        {LINKS.map((label) => (
          <a
            key={label}
            href="#"
            className="hidden text-[13px] tracking-[0.5px] text-[var(--cream)]/85 no-underline sm:inline"
          >
            {label}
          </a>
        ))}
        <a
          href="#"
          className="rounded-full border border-[var(--gold)] px-[22px] py-[10px] text-[12px] tracking-[0.5px] text-[var(--gold-soft)]"
        >
          Reservar visita
        </a>
      </div>
    </nav>
  );
}
