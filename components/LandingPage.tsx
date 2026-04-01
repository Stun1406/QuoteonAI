import Link from 'next/link'

// ── Icons ─────────────────────────────────────────────────────────────────────

function IconBrain() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M9.5 2A2.5 2.5 0 0 1 12 4.5v15a2.5 2.5 0 0 1-4.96-.46 2.5 2.5 0 0 1-2.96-3.08 3 3 0 0 1-.34-5.58 2.5 2.5 0 0 1 1.32-4.24 2.5 2.5 0 0 1 1.44-4.14Z" />
      <path d="M14.5 2A2.5 2.5 0 0 0 12 4.5v15a2.5 2.5 0 0 0 4.96-.46 2.5 2.5 0 0 0 2.96-3.08 3 3 0 0 0 .34-5.58 2.5 2.5 0 0 0-1.32-4.24 2.5 2.5 0 0 0-1.44-4.14Z" />
    </svg>
  )
}
function IconZap() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  )
}
function IconLink() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  )
}
function IconShield() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
function IconTruck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <rect x="1" y="3" width="15" height="13" rx="1" />
      <path d="M16 8h4l3 5v4h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  )
}
function IconChart() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}
function IconUsers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
function IconStar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="w-6 h-6">
      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
    </svg>
  )
}
function IconCheck() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}
function IconArrow() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  )
}
function IconArrowRight() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-7 h-7">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="13 6 19 12 13 18" />
    </svg>
  )
}
function IconArrowDown() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-7 h-7">
      <line x1="12" y1="5" x2="12" y2="19" />
      <polyline points="6 13 12 19 18 13" />
    </svg>
  )
}
function LogoIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-8 h-8">
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M8 10h16M8 16h10M8 22h13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23" cy="22" r="3.5" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" />
      <path d="M21.5 22l1 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ── Data ──────────────────────────────────────────────────────────────────────

const PAIN_POINTS = [
  { icon: '⏰', label: 'Manual and time-consuming' },
  { icon: '🧑‍💼', label: 'Dependent on individual expertise' },
  { icon: '❌', label: 'Error-prone and inconsistent' },
  { icon: '🐌', label: 'Slow to respond to customer requests' },
  { icon: '📉', label: 'Lacking real-time intelligence' },
  { icon: '💸', label: 'Causing revenue leakage and missed opportunities' },
]

const WORKFLOW_STEPS = [
  {
    title: 'Intelligent Request Capture',
    desc: 'Monitors your sales inbox and CRM, classifies requests using AI, and understands intent and urgency.',
    dot: 'bg-blue-500',
  },
  {
    title: 'Data & Context Intelligence',
    desc: 'Extracts shipment details. Analyzes historical pricing, profitability, risk, and complexity.',
    dot: 'bg-indigo-500',
  },
  {
    title: 'AI Quote Generation',
    desc: 'Generates accurate, competitive quotes considering all cost elements — fuel, accessorials, SLAs.',
    dot: 'bg-violet-500',
  },
  {
    title: 'Smart Approval Loop',
    desc: 'Configurable approval thresholds with one-click validation for high-value quotes.',
    dot: 'bg-purple-500',
  },
  {
    title: 'Automated Response & Engagement',
    desc: 'Sends professional quotes instantly and handles follow-ups and revisions autonomously.',
    dot: 'bg-pink-500',
  },
  {
    title: 'Continuous Learning Engine',
    desc: 'Improves pricing accuracy over time by learning from win/loss patterns to maximize margins.',
    dot: 'bg-rose-500',
  },
]

const FEATURES = [
  {
    icon: <IconBrain />,
    title: 'AI Intelligence Layer',
    color: 'text-blue-400',
    bg: 'bg-blue-500/10 border-blue-500/20',
    items: ['AI-assisted intelligent quote generation', 'Dynamic pricing recommendations', 'Margin optimization engine'],
  },
  {
    icon: <IconZap />,
    title: 'Automation Engine',
    color: 'text-yellow-400',
    bg: 'bg-yellow-500/10 border-yellow-500/20',
    items: ['End-to-end quote automation', '24/7 instant response capability', 'Automated follow-ups & revisions'],
  },
  {
    icon: <IconLink />,
    title: 'Integration Ready',
    color: 'text-green-400',
    bg: 'bg-green-500/10 border-green-500/20',
    items: ['Email platforms (Outlook, Gmail)', 'CRM, TMS & ERP systems', 'EDI integration'],
  },
  {
    icon: <IconShield />,
    title: 'Enterprise Ready',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10 border-purple-500/20',
    items: ['Secure and compliant', 'Role-based access control', 'Scalable architecture'],
  },
]

const BENEFITS = [
  {
    icon: <IconChart />,
    title: 'Growth & Revenue',
    color: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    items: ['Increase quote win rates', 'Capture more opportunities', 'Faster response = higher conversion'],
  },
  {
    icon: <IconStar />,
    title: 'Profitability',
    color: 'text-violet-400',
    iconBg: 'bg-violet-500/15',
    items: ['Optimize pricing & margins', 'Reduce revenue leakage', 'Improve cost-to-serve'],
  },
  {
    icon: <IconZap />,
    title: 'Operational Efficiency',
    color: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    items: ['Reduce manual workload', 'Faster quote turnaround time', 'Standardized and consistent outputs'],
  },
  {
    icon: <IconUsers />,
    title: 'Customer Experience',
    color: 'text-green-400',
    iconBg: 'bg-green-500/15',
    items: ['Real-time response', 'Professional and accurate quotes', 'Improved reliability'],
  },
]

const WHY_ITEMS = [
  'Built on Agentic AI architecture',
  'Industry-specific intelligence for logistics & freight',
  'Proven impact on efficiency & revenue',
  'Designed for scalability and global deployment',
  'Covers Manufacturing, Logistics, SaaS, Professional Services, Retail, e-Commerce, and more',
]

const STATS = [
  { value: '10×', label: 'Faster quote turnaround' },
  { value: '24/7', label: 'Automated response capability' },
  { value: '99.7%', label: 'Quote accuracy' },
  { value: '70%', label: 'Win rate improvement' },
]

const OPERATORS = [
  { icon: '🚢', label: 'Intermodal & Drayage Operators' },
  { icon: '🤝', label: 'Freight Brokers' },
  { icon: '🏭', label: '3PL / 4PL Providers' },
  { icon: '🚛', label: 'Trucking Companies' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div
      className="min-h-screen"
      style={{ background: '#0A0F1E', fontFamily: 'Inter, system-ui, sans-serif' }}
    >

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0F1E]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon />
            <span className="text-lg font-bold text-white tracking-tight">QuotionAI</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:hello@lithiumq.com"
              className="hidden sm:inline-flex text-sm text-slate-300 hover:text-white transition px-4 py-2"
            >
              Request a Demo
            </a>
            <Link
              href="/login"
              className="inline-flex items-center gap-1.5 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition"
            >
              Sign In <IconArrow />
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="relative pt-32 pb-28 overflow-hidden">
        <div className="absolute top-24 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 text-xs font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
            Powered by Agentic AI
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight tracking-tight mb-6">
            Intelligent Sales Quoting<br />
            <span className="bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
              Powered by AI
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-slate-300 max-w-lg mx-auto mb-6 leading-relaxed">
            Transform your Quote-to-Cash with AI that understands,<br className="hidden sm:block" />
            analyzes, and responds — faster and smarter than ever.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-10">
            {[
              'From Inquiry to Quote in Seconds',
              'Better Margins. Smarter Decisions.',
              '24/7 AI-Powered Response',
            ].map(tag => (
              <span
                key={tag}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-200 text-sm font-semibold backdrop-blur-sm"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />
                {tag}
              </span>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-900/40"
            >
              Get Started <IconArrow />
            </Link>
            <a
              href="mailto:hello@lithiumq.com"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition"
            >
              Request a Demo
            </a>
          </div>
        </div>

        {/* Stats bar */}
        <div className="relative max-w-5xl mx-auto px-6 mt-20">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-white/5 rounded-2xl overflow-hidden border border-white/5">
            {STATS.map(s => (
              <div key={s.value} className="bg-white/[0.03] hover:bg-white/[0.06] transition px-6 py-6 text-center">
                <div className="text-3xl font-bold text-white mb-1">{s.value}</div>
                <div className="text-xs text-slate-400">{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Problem ── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">The Problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Why Traditional Sales Quoting Fails</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Across industries, sales quoting is broken — directly impacting customer experience, profitability, and growth.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {PAIN_POINTS.map(p => (
              <div key={p.label} className="flex items-start gap-4 bg-white/[0.04] rounded-2xl border border-white/8 p-5 hover:bg-white/[0.07] transition">
                <span className="text-2xl leading-none mt-0.5">{p.icon}</span>
                <span className="text-slate-300 font-medium text-sm leading-relaxed">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">The Solution</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">How QuotionAI Works</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              An end-to-end AI-powered platform that automates the entire process — from request intake to quote delivery and follow-up.
            </p>
          </div>

          {/* Desktop: two rows of 3 with arrows */}
          <div className="hidden lg:block space-y-4">
            <div className="flex items-stretch gap-2">
              {WORKFLOW_STEPS.slice(0, 3).map((step, i) => (
                <div key={step.title} className="flex items-stretch gap-2 flex-1">
                  <div className="flex-1 bg-white/[0.04] rounded-2xl border border-white/8 p-5 hover:bg-white/[0.07] hover:-translate-y-0.5 transition-all duration-200">
                    <h3 className="font-semibold text-white text-sm mb-2">{step.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="flex items-center flex-shrink-0 text-blue-400/80">
                      <IconArrowRight />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end pr-2">
              <div className="text-blue-400/80">
                <IconArrowDown />
              </div>
            </div>

            <div className="flex items-stretch gap-2 flex-row-reverse">
              {WORKFLOW_STEPS.slice(3).map((step, i) => (
                <div key={step.title} className="flex items-stretch gap-2 flex-1 flex-row-reverse">
                  <div className="flex-1 bg-white/[0.04] rounded-2xl border border-white/8 p-5 hover:bg-white/[0.07] hover:-translate-y-0.5 transition-all duration-200">
                    <h3 className="font-semibold text-white text-sm mb-2">{step.title}</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                  </div>
                  {i < 2 && (
                    <div className="flex items-center flex-shrink-0 text-blue-400/80 rotate-180">
                      <IconArrowRight />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Mobile: vertical with down arrows */}
          <div className="lg:hidden flex flex-col items-center gap-2">
            {WORKFLOW_STEPS.map((step, i) => (
              <div key={step.title} className="w-full flex flex-col items-center gap-2">
                <div className="w-full bg-white/[0.04] rounded-2xl border border-white/8 p-5">
                  <h3 className="font-semibold text-white text-sm mb-2">{step.title}</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">{step.desc}</p>
                </div>
                {i < WORKFLOW_STEPS.length - 1 && (
                  <div className="text-blue-400/80">
                    <IconArrowDown />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Industry Focus ── */}
      <section className="py-24 border-t border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Industry Focus</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
              Built for Any Industry with a Sales Quote Process
            </h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              QuotionAI adapts to any business that generates quotes — from logistics to SaaS to professional services.
            </p>
          </div>

          {/* Test Case box */}
          <div className="bg-white/[0.04] rounded-3xl border border-white/8 p-8 mb-8">
            <div className="flex items-center gap-2 mb-6">
              <span className="px-3 py-1 rounded-full bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold uppercase tracking-wider">
                Test Case
              </span>
              <span className="text-slate-300 font-semibold">Freight & Logistics Companies</span>
            </div>

            <div className="grid lg:grid-cols-2 gap-8 items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 mb-4">Purpose-built for logistics providers including:</p>
                <ul className="flex flex-col gap-2.5">
                  {OPERATORS.map(op => (
                    <li key={op.label} className="flex items-center gap-3 bg-blue-500/10 rounded-xl border border-blue-500/25 px-4 py-3.5 hover:bg-blue-500/15 transition">
                      <span className="text-lg leading-none">{op.icon}</span>
                      <span className="text-sm font-semibold text-blue-200 leading-snug">{op.label}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {[
                  { icon: <IconTruck />, title: 'Lane-based Pricing', desc: 'Intelligent lane pricing from your rate sheets' },
                  { icon: <IconChart />, title: 'Margin Optimization', desc: 'Per-shipment margin analysis and guidance' },
                  { icon: <IconZap />, title: 'Accessorial Automation', desc: 'Automatic surcharge calculation' },
                  { icon: <IconBrain />, title: 'CRM Intelligence', desc: 'Analytics and customer insights built in' },
                ].map(card => (
                  <div key={card.title} className="bg-white/[0.05] rounded-xl border border-white/8 p-4 hover:bg-white/[0.09] hover:border-blue-500/30 transition">
                    <div className="text-blue-400 mb-2">{card.icon}</div>
                    <h4 className="font-semibold text-white text-sm mb-1">{card.title}</h4>
                    <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Other industries strip */}
          <div className="flex flex-wrap justify-center gap-3">
            {['Manufacturing', 'SaaS', 'Professional Services', 'Retail & Distribution', 'e-Commerce', 'Hospitality'].map(ind => (
              <span key={ind} className="px-4 py-2 rounded-full bg-white/[0.05] border border-white/10 text-slate-400 text-sm font-medium">
                {ind}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-24 border-t border-white/5" style={{ background: 'linear-gradient(180deg, #0A0F1E 0%, #0D1528 50%, #0A0F1E 100%)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Key Features</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Everything You Need to Quote Smarter</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              Built for modern logistics and freight operations with the tools to compete and win.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {FEATURES.map(f => (
              <div key={f.title} className={`rounded-2xl border ${f.bg} p-6 hover:scale-[1.02] transition-transform duration-200`}>
                <div className={`${f.color} mb-4`}>{f.icon}</div>
                <h3 className="font-semibold text-white mb-3">{f.title}</h3>
                <ul className="space-y-2">
                  {f.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className={`${f.color} mt-0.5 flex-shrink-0`}><IconCheck /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-24 border-t border-white/5" style={{ background: 'linear-gradient(180deg, #0A0F1E 0%, #0F0D1E 50%, #0A0F1E 100%)' }}>
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-400 text-sm font-semibold uppercase tracking-widest mb-3">Business Benefits</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">The Impact on Your Business</h2>
            <p className="text-slate-400 max-w-xl mx-auto">
              QuotionAI delivers measurable results across every dimension of your quoting operation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {BENEFITS.map(b => (
              <div
                key={b.title}
                className="rounded-2xl border border-white/8 bg-white/[0.04] hover:bg-white/[0.08] p-6 hover:scale-[1.02] transition-all duration-200"
              >
                <div className={`w-12 h-12 rounded-2xl ${b.iconBg} flex items-center justify-center ${b.color} mb-4`}>
                  {b.icon}
                </div>
                <h3 className="font-semibold text-white mb-3">{b.title}</h3>
                <ul className="space-y-2">
                  {b.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                      <span className={`${b.color} mt-0.5 flex-shrink-0`}><IconCheck /></span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="py-24 relative overflow-hidden border-t border-white/5"
        style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #1E40AF 50%, #1E3A5F 100%)' }}
      >
        <div className="absolute top-0 left-1/3 w-64 h-64 bg-blue-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/3 w-64 h-64 bg-indigo-400/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative max-w-3xl mx-auto px-6 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
            Experience the Future of Sales Quoting
          </h2>
          <p className="text-blue-200 text-lg mb-10">
            Join logistics companies already quoting faster, smarter, and more profitably with QuotionAI.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-8 py-4 bg-white text-blue-700 font-semibold rounded-xl hover:bg-blue-50 transition shadow-lg"
            >
              Start Your AI Transformation <IconArrow />
            </Link>
            <a
              href="mailto:hello@lithiumq.com"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500/20 border border-white/20 text-white font-medium rounded-xl hover:bg-blue-500/30 transition"
            >
              Request a Demo
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-white/5 pt-10 pb-6">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-8">
            <div className="flex items-center gap-2.5">
              <LogoIcon />
              <span className="text-white font-semibold">QuotionAI</span>
            </div>
            <p className="text-slate-500 text-sm">
              Intelligent Sales Quoting Powered by Agentic AI
            </p>
            <Link href="/login" className="text-sm text-slate-400 hover:text-white transition">
              Sign In →
            </Link>
          </div>
          <div className="border-t border-white/5 pt-6 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <span>© {new Date().getFullYear()} LithiumQ. All rights reserved.</span>
            <span>QuotionAI is a product of LithiumQ · <a href="mailto:hello@lithiumq.com" className="hover:text-slate-400 transition">hello@lithiumq.com</a></span>
          </div>
        </div>
      </footer>

    </div>
  )
}
