'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

function DashboardIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ActivityIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  )
}

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="8" y1="6" x2="21" y2="6" /><line x1="8" y1="12" x2="21" y2="12" /><line x1="8" y1="18" x2="21" y2="18" /><line x1="3" y1="6" x2="3.01" y2="6" /><line x1="3" y1="12" x2="3.01" y2="12" /><line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  )
}

const navItems = [
  { href: '/ops', label: 'Dashboard', icon: DashboardIcon, exact: true },
  { href: '/ops/activity', label: 'Activity', icon: ActivityIcon },
  { href: '/ops/threads', label: 'Threads', icon: ListIcon, disabled: true },
]

export default function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed left-0 top-0 h-screen w-56 bg-white border-r border-gray-200 flex flex-col z-10">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 bg-blue-600 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">FLD</span>
          </div>
          <div>
            <div className="text-sm font-semibold text-gray-900 leading-none">Quoton</div>
            <div className="text-[10px] text-gray-400 mt-0.5">Operations Center</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3">
        <div className="text-[10px] font-medium uppercase tracking-widest text-gray-400 px-2 mb-2">Navigation</div>
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, exact, disabled }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href)
            if (disabled) {
              return (
                <li key={href}>
                  <span className="flex items-center gap-2 px-3 py-2 text-sm rounded-md text-gray-400 cursor-not-allowed select-none">
                    <Icon />{label}
                    <span className="ml-auto text-[9px] uppercase tracking-wide text-gray-400">Soon</span>
                  </span>
                </li>
              )
            }
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={`flex items-center gap-2 px-3 py-2 text-sm rounded-md transition-colors duration-75 ${
                    isActive
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Icon />{label}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Status */}
      <div className="px-4 py-3 border-t border-gray-100">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0"></span>
          <span className="text-xs text-gray-500">Quoton Active</span>
        </div>
      </div>
    </aside>
  )
}
