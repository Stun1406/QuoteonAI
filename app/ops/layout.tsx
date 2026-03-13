import Sidebar from '@/components/ops/Sidebar'

export default function OpsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar />
      <main className="ml-56 flex-1 overflow-auto">
        {children}
      </main>
    </div>
  )
}
