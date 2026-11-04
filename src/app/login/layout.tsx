import Image from "next/image";
import { Spotlight } from "@/components/aceternity/spotlight";
import { GridBackground } from "@/components/aceternity/grid-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-ink text-paper lg:flex lg:flex-col lg:justify-between lg:p-12">
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="#d9954a" />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.07]"
          style={{
            backgroundSize: "48px 48px",
            backgroundImage:
              "linear-gradient(to right, #f3f1ec 1px, transparent 1px), linear-gradient(to bottom, #f3f1ec 1px, transparent 1px)",
          }}
        />
        <Image src="/brand/cas-logo-light.png" alt="Caveman Architectural Studios" width={120} height={43} priority className="relative" />
        <div className="relative max-w-md">
          <p className="mb-4 text-xs font-semibold tracking-[0.2em] text-copper uppercase">Studio ERP</p>
          <h1 className="text-4xl leading-tight font-semibold">From first sketch to final invoice.</h1>
          <p className="mt-4 text-paper/60">
            Invoices, debtors, creditors, stock and projects for Caveman Architectural Studios. All in one place, all from your
            phone.
          </p>
        </div>
        <p className="relative text-xs text-paper/40">89 Helen Joseph Rd, Berea, Durban · Protected by two-factor sign-in</p>
      </section>

      {/* Form panel */}
      <section className="relative flex items-center justify-center overflow-hidden px-5 py-10 pt-[max(2.5rem,env(safe-area-inset-top))]">
        <GridBackground className="lg:hidden" />
        <div className="relative w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <Image src="/brand/cas-logo-dark.png" alt="CAS" width={96} height={34} priority className="dark:hidden" />
            <Image src="/brand/cas-logo-light.png" alt="CAS" width={96} height={34} priority className="hidden dark:block" />
          </div>
          {children}
        </div>
      </section>
    </div>
  );
}
