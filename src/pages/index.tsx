import Link from "next/link";
import { type NextPage } from "next";

import DynamicHead from "@/components/dynamic-head";
import Header from "@/components/header";

const Home: NextPage = () => {
  return (
    <>
      <DynamicHead />
      <Header />
      <main className="flex h-[calc(100vh-70px)] flex-col">
        <section className="container flex w-fit flex-col items-start justify-center gap-6 pt-8 md:pt-12 lg:pt-24">
          <div className="flex flex-col items-start gap-4 md:max-w-[800px]">
            <h1 className="text-3xl font-black leading-[1.1] sm:text-4xl md:text-6xl">
              Make unstructured documents{" "}
              <span className="underline underline-offset-4">
                work for you.
              </span>
            </h1>
            <p className="max-w-[85%] text-lg leading-normal text-slate-700 sm:text-xl sm:leading-8">
              Avoid manual data entry with intelligent OCR technology that
              converts unstructured documents such as general ledgers and bank
              statements to actionable data.
            </p>
          </div>
          <div className="flex items-start gap-4">
            <Link
              href="/bsca"
              className="focus:ring-brand-500 relative inline-flex h-11 items-center rounded-md border border-slate-200 bg-brand-gold px-8 py-2 font-medium text-white transition-colors hover:bg-brand-gold-hover focus:outline-none focus:ring-2 focus:ring-offset-2"
            >
              Try BSCA
            </Link>
          </div>
        </section>
      </main>
    </>
  );
};

export default Home;
