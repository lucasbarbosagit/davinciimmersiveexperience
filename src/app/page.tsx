import Nav from "@/components/nav/Nav";
import Hero from "@/components/hero/Hero";
import BatismoSection from "@/components/sections/BatismoSection";
import ExperienciaSection from "@/components/sections/ExperienciaSection";
import LeonardoSection from "@/components/sections/LeonardoSection";
import VisitarSection from "@/components/sections/VisitarSection";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        {/* a jornada pelas obras abre o site; os capítulos de informação
            (experiência / mestre / visita) vêm depois dela */}
        <Hero />
        <BatismoSection />
        <ExperienciaSection />
        <LeonardoSection />
        <VisitarSection />
      </main>
    </>
  );
}
