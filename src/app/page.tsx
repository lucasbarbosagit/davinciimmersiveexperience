import Nav from "@/components/nav/Nav";
import Hero from "@/components/hero/Hero";
import GallerySection from "@/components/sections/GallerySection";
import ExperienciaSection from "@/components/sections/ExperienciaSection";
import LeonardoSection from "@/components/sections/LeonardoSection";
import VisitarSection from "@/components/sections/VisitarSection";

export default function Home() {
  return (
    <>
      <Nav />
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
