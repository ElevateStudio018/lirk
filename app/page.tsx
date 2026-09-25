import Experience from "@/components/Experience";
import Nav from "@/components/Nav";
import Audience from "@/components/sections/Audience";
import Contact from "@/components/sections/Contact";
import Faq from "@/components/sections/Faq";
import Finale from "@/components/sections/Finale";
import Hero from "@/components/sections/Hero";
import Pricing from "@/components/sections/Pricing";
import Product from "@/components/sections/Product";
import Specialists from "@/components/sections/Specialists";
import Stats from "@/components/sections/Stats";
import Steps from "@/components/sections/Steps";
import Testimonials from "@/components/sections/Testimonials";
import Values from "@/components/sections/Values";
import Why from "@/components/sections/Why";

export default function Home() {
  return (
    <>
      <Nav />
      <main>
        <Hero />
        <Audience />
        <Values />
        <Product />
        <Specialists />
        <Steps />
        <Why />
        <Stats />
        <Testimonials />
        <Pricing />
        <Faq />
        <Contact />
        <Finale />
      </main>
      {/* Last, so every section's pins exist before the scene director measures them. */}
      <Experience />
    </>
  );
}
