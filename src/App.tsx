// App.tsx is the root of the application.
// It does one job: check if the user is logged in.
// - Not logged in → show LoginPage
// - Logged in → show the main app (AppShell)
//
// Firebase keeps the session alive across page refreshes automatically,
// so users don't have to log in every time they open the app.

import { useState, useEffect } from 'react'
import { onAuthChange, type User } from './firebase'
import LoginPage from './components/LoginPage'
import AppShell from './components/AppShell'

export default function App() {
  // null = not logged in, User object = logged in
  const [user, setUser] = useState<User | null>(null)
  // true while Firebase is checking if there's an existing session
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // onAuthChange fires once immediately with the current auth state,
    // then again whenever the user logs in or out.
    const unsubscribe = onAuthChange((firebaseUser) => {
      setUser(firebaseUser)
      setLoading(false)
    })

    // Clean up the listener when the component unmounts
    return unsubscribe
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="text-gray-400 text-sm">Loading…</span>
      </div>
    )
  }

  if (!user) {
    return <LoginPage />
  }

  return <AppShell user={user} />
}
