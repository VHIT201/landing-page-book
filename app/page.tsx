import Header from "@/components/Header";
import Hero from "@/components/Hero";
import ValueBar from "@/components/ValueBar";
import Systems from "@/components/Systems";
import Quote from "@/components/Quote";
import Author from "@/components/Author";
import Reviews from "@/components/Reviews";
import Faq from "@/components/Faq";
import OrderForm from "@/components/OrderForm";
import Footer from "@/components/Footer";

export default function Page() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <ValueBar />
        <Systems />
        <Quote />
        <Author />
        <Reviews />
        <Faq />
        <OrderForm />
      </main>
      <Footer />
    </>
  );
}
