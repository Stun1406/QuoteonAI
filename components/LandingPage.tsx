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
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-5 h-5">
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
    n: '01',
    title: 'Intelligent Request Capture',
    desc: 'Monitors your sales inbox and CRM. Classifies incoming requests using AI and understands intent and urgency.',
    color: 'bg-blue-500',
  },
  {
    n: '02',
    title: 'Data & Context Intelligence',
    desc: 'Extracts shipment or service details. Analyzes historical pricing, profitability, risk, and complexity.',
    color: 'bg-indigo-500',
  },
  {
    n: '03',
    title: 'AI Quote Generation',
    desc: 'Generates accurate, competitive quotes. Considers all cost elements — fuel, accessorials, SLAs — and applies business rules.',
    color: 'bg-violet-500',
  },
  {
    n: '04',
    title: 'Smart Approval Loop',
    desc: 'Configurable approval thresholds with one-click validation for high-value quotes.',
    color: 'bg-purple-500',
  },
  {
    n: '05',
    title: 'Automated Response & Engagement',
    desc: 'Sends professional quotes instantly. Handles follow-ups and revisions autonomously.',
    color: 'bg-pink-500',
  },
  {
    n: '06',
    title: 'Continuous Learning Engine',
    desc: 'Improves pricing accuracy over time. Learns from win/loss patterns to maximize margins.',
    color: 'bg-rose-500',
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
    items: ['End-to-end quote automation', '24×7 instant response capability', 'Automated follow-ups & revisions'],
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
    color: 'text-blue-600',
    ring: 'ring-blue-100',
    bg: 'bg-blue-50',
    items: ['Increase quote win rates', 'Capture more opportunities', 'Faster response = higher conversion'],
  },
  {
    icon: <IconStar />,
    title: 'Profitability',
    color: 'text-violet-600',
    ring: 'ring-violet-100',
    bg: 'bg-violet-50',
    items: ['Optimize pricing & margins', 'Reduce revenue leakage', 'Improve cost-to-serve'],
  },
  {
    icon: <IconZap />,
    title: 'Operational Efficiency',
    color: 'text-amber-600',
    ring: 'ring-amber-100',
    bg: 'bg-amber-50',
    items: ['Reduce manual workload', 'Faster quote turnaround time', 'Standardized and consistent outputs'],
  },
  {
    icon: <IconUsers />,
    title: 'Customer Experience',
    color: 'text-green-600',
    ring: 'ring-green-100',
    bg: 'bg-green-50',
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
  { value: '99%', label: 'Quote accuracy' },
  { value: '40%', label: 'Win rate improvement' },
]

// ── Component ─────────────────────────────────────────────────────────────────

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>

      {/* ── Nav ── */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0A0F1E]/90 backdrop-blur-md border-b border-white/5">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <LogoIcon />
            <span className="text-lg font-bold text-white tracking-tight">QuotionAI</span>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="mailto:demo@quotionai.com"
              className="hidden sm:inline-flex text-sm text-slate-300 hover:text-white transition px-4 py-2"
            >
              Book a Demo
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
      <section
        className="relative pt-32 pb-28 overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #0F172A 40%, #1E2A4A 70%, #0F172A 100%)' }}
      >
        {/* Glow orbs */}
        <div className="absolute top-24 left-1/4 w-96 h-96 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none" />

        <div className="relative max-w-5xl mx-auto px-6 text-center">
          {/* Badge */}
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

          <p className="text-lg sm:text-xl text-slate-300 max-w-2xl mx-auto mb-4 leading-relaxed">
            Transform your Quote-to-Cash process with AI that understands, analyzes, and responds — faster, smarter, and more accurately than ever before.
          </p>

          <ul className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 text-sm text-slate-400 mb-10">
            <li className="flex items-center gap-2"><span className="text-blue-400">✦</span> From Inquiry to Quote in Seconds</li>
            <li className="flex items-center gap-2"><span className="text-blue-400">✦</span> Better Margins. Smarter Decisions.</li>
            <li className="flex items-center gap-2"><span className="text-blue-400">✦</span> 24×7 AI-Powered Response</li>
          </ul>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition shadow-lg shadow-blue-900/40"
            >
              Get Started <IconArrow />
            </Link>
            <a
              href="mailto:demo@quotionai.com"
              className="inline-flex items-center gap-2 px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-xl transition"
            >
              Book a Demo
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
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">The Problem</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Why Traditional Sales Quoting Fails</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              Across industries, sales quoting is broken — directly impacting customer experience, profitability, and growth.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {PAIN_POINTS.map(p => (
              <div key={p.label} className="flex items-start gap-4 bg-white rounded-2xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition">
                <span className="text-2xl leading-none mt-0.5">{p.icon}</span>
                <span className="text-slate-700 font-medium text-sm leading-relaxed">{p.label}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">The Solution</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">How QuotionAI Works</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              An end-to-end AI-powered quoting platform that automates the entire process — from request intake to quote delivery and follow-up.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {WORKFLOW_STEPS.map(step => (
              <div key={step.n} className="group relative bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <div className={`w-10 h-10 rounded-xl ${step.color} flex items-center justify-center text-white text-sm font-bold mb-4`}>
                  {step.n}
                </div>
                <h3 className="font-semibold text-slate-800 mb-2">{step.title}</h3>
                <p className="text-sm text-slate-500 leading-relaxed">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section
        className="py-24"
        style={{ background: 'linear-gradient(135deg, #0A0F1E 0%, #0F172A 60%, #1A1F35 100%)' }}
      >
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

      {/* ── Industry Use Case ── */}
      <section className="py-24 bg-white">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Industry Focus</p>
              <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-5">
                Built for Modern Freight & Logistics Companies
              </h2>
              <p className="text-slate-500 leading-relaxed mb-8">
                QuotionAI is purpose-built for logistics providers who need to respond faster, price smarter, and scale operations without increasing headcount.
              </p>
              <ul className="space-y-3">
                {['Intermodal & Drayage Operators', 'Freight Brokers', '3PL / 4PL Providers', 'Trucking Companies'].map(item => (
                  <li key={item} className="flex items-center gap-3 text-slate-700">
                    <span className="w-6 h-6 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                      <IconCheck />
                    </span>
                    <span className="font-medium">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: <IconTruck />, title: 'Lane-based Pricing', desc: 'Intelligent lane pricing from your rate sheets' },
                { icon: <IconChart />, title: 'Margin Optimization', desc: 'Per-shipment margin analysis and guidance' },
                { icon: <IconZap />, title: 'Accessorial Automation', desc: 'Automatic surcharge calculation' },
                { icon: <IconBrain />, title: 'CRM Intelligence', desc: 'Analytics and customer insights built in' },
              ].map(card => (
                <div key={card.title} className="bg-slate-50 rounded-2xl border border-slate-100 p-5 hover:border-blue-100 hover:bg-blue-50/30 transition">
                  <div className="text-blue-600 mb-3">{card.icon}</div>
                  <h4 className="font-semibold text-slate-800 text-sm mb-1">{card.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Benefits ── */}
      <section className="py-24 bg-slate-50">
        <div className="max-w-6xl mx-auto px-6">
          <div className="text-center mb-14">
            <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Business Benefits</p>
            <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-4">The Impact on Your Business</h2>
            <p className="text-slate-500 max-w-xl mx-auto">
              QuotionAI delivers measurable results across every dimension of your quoting operation.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {BENEFITS.map(b => (
              <div key={b.title} className="bg-white rounded-2xl border border-slate-100 p-6 shadow-sm hover:shadow-md transition">
                <div className={`w-12 h-12 rounded-2xl ${b.bg} ring-4 ${b.ring} flex items-center justify-center ${b.color} mb-4`}>
                  {b.icon}
                </div>
                <h3 className="font-semibold text-slate-800 mb-3">{b.title}</h3>
                <ul className="space-y-2">
                  {b.items.map(item => (
                    <li key={item} className="flex items-start gap-2 text-sm text-slate-500">
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

      {/* ── Why QuotionAI ── */}
      <section className="py-24 bg-white">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <p className="text-blue-600 text-sm font-semibold uppercase tracking-widest mb-3">Why QuotionAI</p>
          <h2 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-5">Built Different, By Design</h2>
          <p className="text-slate-500 max-w-xl mx-auto mb-12">
            Not just another quoting tool — a fully autonomous AI agent purpose-built for the complexity of modern sales.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 text-left">
            {WHY_ITEMS.map((item, i) => (
              <div key={i} className="flex items-start gap-3 bg-slate-50 rounded-xl border border-slate-100 p-4">
                <span className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white flex-shrink-0">
                  <IconCheck />
                </span>
                <span className="text-sm text-slate-700 font-medium leading-snug">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section
        className="py-24 relative overflow-hidden"
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
              href="mailto:demo@quotionai.com"
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500/20 border border-white/20 text-white font-medium rounded-xl hover:bg-blue-500/30 transition"
            >
              Book a Demo
            </a>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="bg-[#0A0F1E] border-t border-white/5 py-10">
        <div className="max-w-6xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
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
      </footer>

    </div>
  )
}
