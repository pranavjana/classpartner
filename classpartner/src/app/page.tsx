import Header from "./components/header";
import Hero from "./components/hero";
import ProblemSolution from "./components/ProblemSolution";
import Features from "./components/features";
import HowItWorks from "./components/HowitWorks";
import SocialProof from "./components/SocialProof";
import FAQ from "./components/FAQ";
import Footer from "./components/footer";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-950 text-gray-100">
      <Header />
      <main className="flex-1 flex flex-col gap-20">
        <Hero />
        <ProblemSolution />
        <Features />
        <HowItWorks />
        <SocialProof />
        <FAQ />
      </main>
      <Footer />
    </div>
  );
}
