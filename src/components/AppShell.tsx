// AppShell is the outer wrapper for the whole app once the user is logged in.
// It renders the top nav bar and switches between the three main tabs.

import { useState } from 'react'
import { logout, type User } from '../firebase'
import WeekPlanner from './WeekPlanner'
import RecipeChat from './RecipeChat'
import CookingMode from './CookingMode'
import type { Recipe } from '../types'
import { Leaf, CalendarDays, Plus, Utensils } from 'lucide-react'

type Tab = 'planner' | 'add-recipe' | 'cook'

interface Props {
  user: User
}

export default function AppShell({ user }: Props) {
  const [tab, setTab] = useState<Tab>('planner')
  const [cookingRecipe, setCookingRecipe] = useState<Recipe | null>(null)

  function startCooking(recipe: Recipe) {
    setCookingRecipe(recipe)
    setTab('cook')
  }

  return (
    <div className="min-h-screen bg-gray-50">

      {/* Top nav */}
      <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Leaf size={18} className="text-green-600" />
          <span className="font-semibold text-gray-900">FoodFlow</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm text-gray-500">{user.email}</span>
          <button
            onClick={logout}
            className="text-sm text-gray-500 hover:text-gray-800 transition-colors"
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Tab bar */}
      <div className="bg-white border-b border-gray-200 px-4">
        <div className="flex gap-0 max-w-4xl mx-auto">
          {([
            { id: 'planner', label: 'Week Planner', icon: <CalendarDays size={14} /> },
            { id: 'add-recipe', label: 'Add Recipe', icon: <Plus size={14} /> },
            { id: 'cook', label: 'Cook', icon: <Utensils size={14} /> },
          ] as { id: Tab; label: string; icon: React.ReactNode }[]).map(t => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tab === t.id
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-4xl mx-auto p-4">
        {tab === 'planner' && <WeekPlanner userId={user.uid} onStartCooking={startCooking} />}
        {tab === 'add-recipe' && <RecipeChat userId={user.uid} />}
        {tab === 'cook' && <CookingMode userId={user.uid} initialRecipe={cookingRecipe} />}
      </main>

    </div>
  )
}
