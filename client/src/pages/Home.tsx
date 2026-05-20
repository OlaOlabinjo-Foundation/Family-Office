import { useAuth } from '../context/AuthContext'
import { ChairmanDashboard } from './ChairmanDashboard'
import { CommandCentre } from './CommandCentre'

/** Routes chairman to the principal overview; operators to the full command centre. */
export function Home() {
  const { user } = useAuth()
  if (user?.role === 'chairman') return <ChairmanDashboard />
  return <CommandCentre />
}
