import Nav from "@/components/nav/Nav";
import Hero from "@/components/hero/Hero";
import HeroIntro from "@/components/hero/HeroIntro";
import GallerySection from "@/components/sections/GallerySection";
import ExperienciaSection from "@/components/sections/ExperienciaSection";
import LeonardoSection from "@/components/sections/LeonardoSection";
import VisitarSection from "@/components/sections/VisitarSection";

export default function Home() {
  return (
    <>
      <Nav />
      {/* irmão do Hero, fora do .heroPin: o pin do ScrollTrigger aplica um
          transform nele em runtime, o que cria um novo contexto de
          empilhamento e prende qualquer z-index de dentro — o intro
          precisa ficar fora pra realmente sobrepor o nav */}
      <HeroIntro />
      <main>
        {/* a jornada pelas obras abre o site: o hero mergulha na porta da
            obra ativa e sai dentro do corredor da galeria — os capítulos
            de informação (experiência / mestre / visita) vêm depois dela */}
        <Hero />
        <GallerySection />
        <ExperienciaSection />
        <LeonardoSection />
        <VisitarSection />
      </main>
    </>
  );
}
