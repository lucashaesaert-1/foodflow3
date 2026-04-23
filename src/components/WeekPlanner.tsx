// WeekPlanner shows the weekly meal agenda (days as columns, meals as rows)
// with drag-and-drop recipe slots, followed by the recipe bank gallery.

import { useState, useEffect, useRef } from 'react'
import { subscribeToRecipes, getMealPlan, saveMealPlan } from '../firebase'
import type { Recipe } from '../types'
import { CalendarDays, Clock, Users, ShoppingCart, Download, X, ChefHat, Utensils } from 'lucide-react'
import RecipePanel from './RecipePanel'

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const
type DayKey = typeof DAYS[number]

const MEALS = ['breakfast', 'lunch', 'dinner'] as const
type MealKey = typeof MEALS[number]

const DAY_SHORT: Record<DayKey, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
}

type WeekPlan = Record<DayKey, Record<MealKey, Recipe | null>>

function emptyPlan(): WeekPlan {
  const plan = {} as WeekPlan
  for (const day of DAYS) plan[day] = { breakfast: null, lunch: null, dinner: null }
  return plan
}

function getCurrentWeekStart(): string {
  const now = new Date()
  const day = now.getDay()
  const diff = now.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(now)
  monday.setDate(diff)
  return monday.toISOString().split('T')[0]
}

interface Props {
  userId: string
  onStartCooking: (recipe: Recipe) => void
}

const DAY_KEYS: DayKey[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']

function getTodayRecipe(weekPlan: WeekPlan): Recipe | null {
  const today = DAY_KEYS[new Date().getDay()]
  const hour = new Date().getHours()
  const preferred: MealKey = hour < 11 ? 'breakfast' : hour < 17 ? 'lunch' : 'dinner'
  return weekPlan[today][preferred]
    ?? weekPlan[today]['breakfast']
    ?? weekPlan[today]['lunch']
    ?? weekPlan[today]['dinner']
    ?? null
}

export default function WeekPlanner({ userId, onStartCooking }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [weekPlan, setWeekPlan] = useState<WeekPlan>(emptyPlan())
  const [showGroceryList, setShowGroceryList] = useState(false)
  const [dragOver, setDragOver] = useState<string | null>(null)
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null)
  const dragInfo = useRef<{ recipe: Recipe; sourceDay?: DayKey; sourceMeal?: MealKey } | null>(null)
  const planLoaded = useRef(false)
  const weekStart = getCurrentWeekStart()

  useEffect(() => {
    const unsubscribe = subscribeToRecipes(userId, setRecipes)
    return unsubscribe
  }, [userId])

  useEffect(() => {
    getMealPlan(userId, weekStart).then(saved => {
      if (saved) {
        const merged = emptyPlan()
        for (const day of DAYS) {
          const dayData = (saved as any)[day]
          if (dayData) for (const meal of MEALS) merged[day][meal] = dayData[meal] ?? null
        }
        setWeekPlan(merged)
      }
      planLoaded.current = true
    })
  }, [userId, weekStart])

  useEffect(() => {
    if (!planLoaded.current) return
    saveMealPlan(userId, weekStart, weekPlan as any)
  }, [weekPlan])

  // ── drag handlers ─────────────────────────────────────────────────────────
  function handleDragStartFromGallery(recipe: Recipe) {
    dragInfo.current = { recipe }
  }

  function handleDragStartFromSlot(recipe: Recipe, day: DayKey, meal: MealKey) {
    dragInfo.current = { recipe, sourceDay: day, sourceMeal: meal }
  }

  function handleDropOnSlot(targetDay: DayKey, targetMeal: MealKey) {
    if (!dragInfo.current) return
    const { recipe, sourceDay, sourceMeal } = dragInfo.current
    setWeekPlan(prev => {
      const next = { ...prev }
      next[targetDay] = { ...prev[targetDay], [targetMeal]: recipe }
      if (sourceDay && sourceMeal && (sourceDay !== targetDay || sourceMeal !== targetMeal))
        next[sourceDay] = { ...prev[sourceDay], [sourceMeal]: null }
      return next
    })
    setDragOver(null)
    dragInfo.current = null
  }

  function handleDropOnGallery() {
    if (!dragInfo.current) return
    const { sourceDay, sourceMeal } = dragInfo.current
    if (sourceDay && sourceMeal)
      setWeekPlan(prev => ({ ...prev, [sourceDay]: { ...prev[sourceDay], [sourceMeal]: null } }))
    setDragOver(null)
    dragInfo.current = null
  }

  function removeFromSlot(day: DayKey, meal: MealKey) {
    setWeekPlan(prev => ({ ...prev, [day]: { ...prev[day], [meal]: null } }))
  }

  // ── grocery list ──────────────────────────────────────────────────────────
  function buildGroceryText(): string {
    const used = new Map<string, Recipe>()
    for (const day of DAYS)
      for (const meal of MEALS) { const r = weekPlan[day][meal]; if (r) used.set(r.id, r) }

    if (used.size === 0) return 'No recipes planned this week.'

    const ingMap = new Map<string, string[]>()
    for (const r of used.values())
      for (const ing of r.ingredients ?? []) {
        const key = ing.name.toLowerCase().trim()
        if (!ingMap.has(key)) ingMap.set(key, [])
        ingMap.get(key)!.push(`${ing.quantity}${ing.unit ? ' ' + ing.unit : ''}`)
      }

    const names = Array.from(used.values()).map(r => r.name).join(', ')
    const lines = Array.from(ingMap.entries()).map(([k, amounts]) =>
      `• ${k.charAt(0).toUpperCase() + k.slice(1)}: ${amounts.join(', ')}`)
    return `Grocery List\n============\nBased on: ${names}\n\n${lines.join('\n')}`
  }

  function exportGroceryList() {
    const blob = new Blob([buildGroceryText()], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'grocery-list.txt'; a.click()
    URL.revokeObjectURL(url)
  }

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <>
      <div className="space-y-8">

        {/* ── WEEK AGENDA ──────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide flex items-center gap-2">
              <CalendarDays size={14} /> This Week
            </h2>
            <div className="flex items-center gap-2">
              {(() => {
                const todayRecipe = getTodayRecipe(weekPlan)
                return todayRecipe ? (
                  <button
                    onClick={() => onStartCooking(todayRecipe)}
                    className="flex items-center gap-1.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg px-3 py-1.5 transition-colors"
                  >
                    <Utensils size={13} /> Cook Today's Recipe
                  </button>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg px-3 py-1.5">
                    <Utensils size={13} /> No recipe planned today
                  </span>
                )
              })()}
              <button
                onClick={() => setShowGroceryList(v => !v)}
                className="flex items-center gap-1.5 text-xs font-medium text-gray-600 hover:text-green-700 border border-gray-200 hover:border-green-400 rounded-lg px-3 py-1.5 transition-colors"
              >
                <ShoppingCart size={13} /> Grocery List
              </button>
            </div>
          </div>

          {showGroceryList && (
            <div className="mb-4 bg-white border border-gray-200 rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-gray-700">Grocery List</h3>
                <button
                  onClick={exportGroceryList}
                  className="flex items-center gap-1.5 text-xs font-medium text-green-700 hover:text-green-800 transition-colors"
                >
                  <Download size={13} /> Export .txt
                </button>
              </div>
              <pre className="text-xs text-gray-600 whitespace-pre-wrap font-sans leading-relaxed">{buildGroceryText()}</pre>
            </div>
          )}

          {/* Table: rows = meals, columns = days */}
          <div className="overflow-x-auto">
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden min-w-[640px]">

              {/* Column headers: empty + 7 day labels */}
              <div className="grid grid-cols-8 border-b border-gray-100 bg-gray-50">
                <div className="px-3 py-2.5" /> {/* row label spacer */}
                {DAYS.map(day => (
                  <div key={day} className="px-2 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-center border-l border-gray-100">
                    {DAY_SHORT[day]}
                  </div>
                ))}
              </div>

              {/* Meal rows */}
              {MEALS.map((meal, mi) => (
                <div key={meal} className={`grid grid-cols-8 ${mi < MEALS.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  {/* Row label */}
                  <div className="px-3 py-3 flex items-center">
                    <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide capitalize">{meal}</span>
                  </div>

                  {/* Day slots */}
                  {DAYS.map(day => {
                    const recipe = weekPlan[day][meal]
                    const slotKey = `${day}-${meal}`
                    const isOver = dragOver === slotKey

                    return (
                      <div
                        key={day}
                        onDragOver={e => { e.preventDefault(); setDragOver(slotKey) }}
                        onDragLeave={() => setDragOver(null)}
                        onDrop={() => handleDropOnSlot(day, meal)}
                        className={`p-1.5 border-l border-gray-100 transition-colors ${isOver ? 'bg-green-50' : ''}`}
                      >
                        {recipe ? (
                          <div
                            draggable
                            onDragStart={() => handleDragStartFromSlot(recipe, day, meal)}
                            className="group relative bg-green-50 border border-green-200 rounded-lg px-2 py-1.5 cursor-grab active:cursor-grabbing select-none h-full"
                          >
                            <p className="text-xs font-medium text-green-800 leading-snug line-clamp-2 pr-3">{recipe.name}</p>
                            <p className="text-xs text-green-600 mt-1 flex items-center gap-0.5">
                              <Clock size={9} />{recipe.prepTime + recipe.cookTime}m
                            </p>
                            <button
                              onClick={() => removeFromSlot(day, meal)}
                              className="absolute top-1 right-1 text-green-300 hover:text-green-700 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <X size={10} />
                            </button>
                          </div>
                        ) : (
                          <div className={`rounded-lg border border-dashed h-14 flex items-center justify-center transition-colors ${isOver ? 'border-green-400 bg-green-50' : 'border-gray-200'}`}>
                            <span className="text-xs text-gray-300 select-none">drop</span>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              ))}

            </div>
          </div>
        </section>

        {/* ── RECIPE BANK ──────────────────────────────────────────────── */}
        <section
          onDragOver={e => { e.preventDefault(); setDragOver('gallery') }}
          onDragLeave={() => setDragOver(null)}
          onDrop={handleDropOnGallery}
        >
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 flex items-center gap-2">
            <ChefHat size={14} /> Recipe Bank
          </h2>

          {recipes.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <ChefHat size={28} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm text-gray-500 font-medium">No recipes yet</p>
              <p className="text-xs mt-1">Go to "Add Recipe" to get started</p>
            </div>
          ) : (
            <div className={`grid grid-cols-3 gap-3 rounded-xl border-2 border-dashed p-3 transition-colors ${dragOver === 'gallery' ? 'border-red-300 bg-red-50' : 'border-transparent'}`}>
              {recipes.map(recipe => (
                <div
                  key={recipe.id}
                  draggable
                  onDragStart={() => handleDragStartFromGallery(recipe)}
                  onClick={() => setSelectedRecipe(recipe)}
                  className="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-green-300 hover:shadow-sm transition-all select-none group"
                >
                  <p className="font-medium text-sm text-gray-900 truncate leading-snug group-hover:text-green-800 transition-colors">{recipe.name}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Clock size={10} />{recipe.prepTime + recipe.cookTime}m
                    </span>
                    <span className="text-xs text-gray-400 flex items-center gap-1">
                      <Users size={10} />{recipe.servings}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>

      {/* Slide-in recipe panel */}
      {selectedRecipe && (
        <RecipePanel
          userId={userId}
          recipe={selectedRecipe}
          onClose={() => setSelectedRecipe(null)}
        />
      )}
    </>
  )
}
