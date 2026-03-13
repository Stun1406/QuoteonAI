import { getThreadDetail } from '@/lib/db/queries/thread-detail'
import { ThreadDetail } from '@/components/ops/ThreadDetail'
import { notFound } from 'next/navigation'

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const detail = await getThreadDetail(id)

  if (!detail) notFound()

  return <ThreadDetail detail={detail} />
}
