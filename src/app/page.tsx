import Nav from "@/components/nav/Nav";
import Hero from "@/components/hero/Hero";
import JoaoSection from "@/components/sections/JoaoSection";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <JoaoSection />
      </main>
    </>
  );
}
