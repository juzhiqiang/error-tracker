import { WelcomeContent } from '@/components/welcome-content'
import { getServerSession } from '@/lib/auth-server'

export default async function WelcomePage() {
  const session = await getServerSession()
  return <WelcomeContent user={session?.user ?? null} />
}
