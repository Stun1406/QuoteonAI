export default function ActivityLoading() {
  return (
    <div className="p-8">
      <div className="mb-6">
        <div className="h-6 w-40 bg-gray-200 rounded animate-pulse mb-2"></div>
        <div className="h-4 w-56 bg-gray-100 rounded animate-pulse"></div>
      </div>
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[1,2,3,4].map(i => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-4 py-3">
            <div className="h-3 w-24 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="h-6 w-20 bg-gray-100 rounded animate-pulse"></div>
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg">
        {[1,2,3,4,5,6].map(i => (
          <div key={i} className="h-14 border-b border-gray-100 animate-pulse bg-gray-50/50 last:border-b-0"></div>
        ))}
      </div>
    </div>
  )
}
