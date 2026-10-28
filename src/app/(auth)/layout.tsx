import { BarChart3, CalendarClock, MapPin, Truck } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const FEATURES = [
  { icon: MapPin, label: "Real-Time Tracking" },
  { icon: CalendarClock, label: "Smart Dispatching" },
  { icon: Truck, label: "Fleet Management" },
  { icon: BarChart3, label: "Actionable Insights" },
];

/** Login layout from the BlitzMove reference: hero panel with headline on the left, floating sign-in card on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen overflow-hidden bg-gradient-to-br from-[#f3f1ef] via-white to-[#f1f1f3]">
      <CornerSwoosh />

      <section className="relative hidden w-[58%] flex-col bg-gradient-to-b from-[#eef0f3] via-[#f7efe9] to-[#f4d3bd] lg:flex">
        <div className="relative z-10 px-14 pt-12 text-center xl:px-20">
          <Logo priority className="mx-auto w-[min(24rem,70%)]" />

          <h1 className="mt-6 text-5xl leading-[1.05] font-extrabold tracking-tight text-ink-950 xl:text-6xl">
            Move <span className="bg-gradient-to-r from-ink-950 via-ink-950 to-ink-400 bg-clip-text text-transparent">Smarter.</span>
            <br />
            Deliver <span className="text-brand-600">Further.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-md text-lg leading-snug text-ink-700">
            End-to-end logistics management for a more efficient and connected supply chain.
          </p>
        </div>

        <div className="relative mt-4 flex min-h-[22rem] flex-1 flex-col justify-end">
          <div
            className="absolute inset-0 bg-[url('/images/login-hero.jpg')] bg-cover bg-top"
            style={{ maskImage: "linear-gradient(to bottom, transparent 0%, black 12%)", WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 12%)" }}
            aria-hidden
          />
          <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/55 to-transparent" aria-hidden />
          <RoutePins />

          <ul className="relative z-10 mx-auto grid w-full max-w-2xl grid-cols-4 gap-5 px-14 pb-10 xl:px-20">
            {FEATURES.map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex flex-col items-center gap-2 rounded-xl bg-ink-950/80 px-2 py-4 text-center text-xs font-bold tracking-wide text-white uppercase shadow-lg backdrop-blur-sm"
              >
                <Icon className="h-8 w-8 text-brand-600" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-lg rounded-3xl bg-white p-7 shadow-[0_20px_60px_-15px_rgba(16,24,40,0.25)] sm:p-12">
          <Logo priority className="mx-auto mb-8 w-56 lg:hidden" />
          {children}
        </div>
      </section>
    </div>
  );
}

/** Red and black brand stripes in the top-right corner. */
function CornerSwoosh() {
  return (
    <svg className="pointer-events-none absolute top-0 right-0 h-72 w-72" viewBox="0 0 300 300" aria-hidden>
      <path d="M170 0h130v40C262 70 220 60 170 0z" fill="#e30613" />
      <path d="M300 70v150c-20-60-40-80-70-95 30-10 50-30 70-55z" fill="#16181d" />
    </svg>
  );
}

/** Decorative dashed route with map pins; no real data. */
function RoutePins() {
  return (
    <svg className="absolute -top-[4%] left-0 h-[34%] w-[13%]" viewBox="0 0 200 220" preserveAspectRatio="xMinYMid meet" aria-hidden>
      <path d="M40 40 C 70 70, 110 80, 120 120 S 160 190, 200 205" fill="none" stroke="#e30613" strokeWidth="3" strokeDasharray="4 7" strokeLinecap="round" />
      {[
        [40, 40],
        [120, 120],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x - 14} ${y - 36})`}>
          <path d="M14 0C6.3 0 0 6.1 0 13.7 0 24 14 36 14 36s14-12 14-22.3C28 6.1 21.7 0 14 0z" fill="#e30613" />
          <circle cx="14" cy="13.5" r="5" fill="#fff" />
        </g>
      ))}
    </svg>
  );
}
