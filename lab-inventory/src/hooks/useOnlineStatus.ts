import { useEffect, useState } from 'react'
import { flushQueue, getPendingCount } from '@/lib/offline-queue'

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [pendingWrites, setPendingWrites] = useState(getPendingCount())

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true)
      await flushQueue()
      setPendingWrites(getPendingCount())
    }
    const handleOffline = () => setIsOnline(false)

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  return { isOnline, pendingWrites }
}
