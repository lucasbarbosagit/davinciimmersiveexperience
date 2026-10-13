import Nav from "@/components/nav/Nav";
import Hero from "@/components/hero/Hero";
import HeroIntro from "@/components/hero/HeroIntro";
import GallerySection from "@/components/sections/GallerySection";
import VooSection from "@/components/sections/VooSection";
import SfumatoSection from "@/components/sections/SfumatoSection";
import LeonardoSection from "@/components/sections/LeonardoSection";
import VisitarSection from "@/components/sections/VisitarSection";
import SiteFooter from "@/components/sections/SiteFooter";
import InkCursor from "@/components/ui/InkCursor";
import SiteLoader from "@/components/ui/SiteLoader";

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
            de informação (o mestre / a visita) vêm depois dela */}
        <Hero />
        <GallerySection />
        {/* a galeria termina afundando no escuro; o ornitóptero nasce dele */}
        <VooSection />
        {/* a pena vira pincel: o visitante revela a Scapigliata */}
        <SfumatoSection />
        <LeonardoSection />
        <VisitarSection />
      </main>
      <SiteFooter />
      {/* a pena: o traço dourado do cursor, por cima do site inteiro */}
      <InkCursor />
      {/* o loading: cobre tudo até o essencial do começo carregar */}
      <SiteLoader />
    </>
  );
}
