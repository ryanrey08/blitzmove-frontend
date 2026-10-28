import { Boxes, Route, TrendingUp, Truck } from "lucide-react";
import { Logo } from "@/components/layout/logo";

const FEATURES = [
  { icon: Truck, label: "Real-time Tracking" },
  { icon: Route, label: "Route Optimization" },
  { icon: TrendingUp, label: "Fleet Management" },
  { icon: Boxes, label: "On-time Delivery" },
];

/** Split-screen layout from the BlitzMove login reference. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-white">
      <section className="relative hidden w-[56%] overflow-hidden bg-ink-950 text-white lg:flex lg:flex-col lg:justify-between">
        <RouteBackdrop />
        <div className="absolute inset-y-0 -right-24 w-56 skew-x-[-14deg] bg-gradient-to-b from-brand-500 via-brand-600 to-brand-800" aria-hidden />
        <div className="absolute inset-y-0 right-28 w-6 skew-x-[-14deg] bg-ink-800" aria-hidden />

        <div className="relative z-10 px-14 pt-14">
          <Logo variant="light" className="[&_p:first-child]:text-5xl [&_svg]:h-16 [&_svg]:w-20" />
        </div>

        <div className="relative z-10 max-w-xl px-14">
          <h1 className="text-5xl leading-[1.05] font-extrabold tracking-tight xl:text-6xl">
            Move Smarter.
            <br />
            Deliver Faster.
          </h1>
          <p className="mt-5 text-lg text-ink-200">
            An integrated logistics and transportation management system to help you plan, track, and deliver with confidence.
          </p>
        </div>

        <ul className="relative z-10 grid max-w-2xl grid-cols-4 gap-6 px-14 pb-14">
          {FEATURES.map(({ icon: Icon, label }) => (
            <li key={label} className="flex flex-col items-start gap-3">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-600 shadow-lg shadow-brand-900/40">
                <Icon className="h-8 w-8" aria-hidden />
              </span>
              <span className="text-base leading-tight font-medium">{label}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-1 flex-col">
        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8">
          <div className="w-full max-w-md rounded-2xl border border-ink-100 bg-white p-6 shadow-[0_10px_40px_-12px_rgba(16,24,40,0.18)] sm:p-9">
            <Logo className="mb-8 justify-center [&_p:first-child]:text-4xl [&_svg]:h-12 [&_svg]:w-16" />
            {children}
          </div>
        </div>
        <p className="pb-6 text-center text-xs text-ink-500">© {new Date().getFullYear()} BlitzMove Logistics Solutions. All rights reserved.</p>
      </section>
    </div>
  );
}

/** Decorative route lines and pins; no real data. */
function RouteBackdrop() {
  return (
    <svg className="absolute inset-0 h-full w-full opacity-60" viewBox="0 0 800 900" preserveAspectRatio="xMidYMid slice" aria-hidden>
      <defs>
        <radialGradient id="glow" cx="70%" cy="20%" r="70%">
          <stop offset="0%" stopColor="#3f4655" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#0d0e11" stopOpacity="0" />
        </radialGradient>
        <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
          <path d="M40 0H0v40" fill="none" stroke="#ffffff" strokeOpacity="0.04" />
        </pattern>
      </defs>
      <rect width="800" height="900" fill="url(#glow)" />
      <rect width="800" height="900" fill="url(#grid)" />
      <path d="M520 60 C 560 160, 470 200, 540 260 S 700 300, 690 380 S 600 470, 640 560" fill="none" stroke="#e30613" strokeWidth="3" strokeDasharray="2 10" strokeLinecap="round" />
      <path d="M380 120 C 430 180, 520 230, 560 250" fill="none" stroke="#e30613" strokeOpacity="0.7" strokeWidth="2" />
      {[
        [520, 60],
        [560, 255],
        [690, 380],
        [640, 560],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
          <circle r="16" fill="#e30613" fillOpacity="0.18" />
          <circle r="6" fill="#e30613" />
        </g>
      ))}
    </svg>
  );
}
