import Nav from "@/components/nav/Nav";
import Hero from "@/components/hero/Hero";
import BatismoSection from "@/components/sections/BatismoSection";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <BatismoSection />
      </main>
    </>
  );
}
