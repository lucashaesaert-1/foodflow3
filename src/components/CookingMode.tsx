// CookingMode guides the user through cooking a recipe step-by-step.
// Phase 1: pick a recipe (or auto-loaded from the week planner shortcut)
// Phase 2: ingredients checklist — tap to check off items
// Phase 3: step-by-step instructions with progress bar
// Phase 4: done screen

import { useState, useEffect, useRef } from 'react'
import { subscribeToRecipes } from '../firebase'
import type { Recipe } from '../types'
import { ChefHat, Check, Clock, Users, ArrowLeft, ArrowRight, RotateCcw } from 'lucide-react'

interface Props {
  userId: string
  initialRecipe: Recipe | null
}

type Phase = 'pick' | 'ingredients' | 'steps' | 'done'

export default function CookingMode({ userId, initialRecipe }: Props) {
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const [recipe, setRecipe] = useState<Recipe | null>(initialRecipe)
  const [phase, setPhase] = useState<Phase>(initialRecipe ? 'ingredients' : 'pick')
  const [stepIndex, setStepIndex] = useState(0)
  const [checked, setChecked] = useState<Set<number>>(new Set())
  const prevInitialId = useRef<string | null>(initialRecipe?.id ?? null)

  useEffect(() => {
    const unsub = subscribeToRecipes(userId, setRecipes)
    return unsub
  }, [userId])

  // When parent pushes a new recipe via the "Start Cooking" shortcut
  useEffect(() => {
    if (initialRecipe && initialRecipe.id !== prevInitialId.current) {
      prevInitialId.current = initialRecipe.id
      startWithRecipe(initialRecipe)
    }
  }, [initialRecipe])

  function startWithRecipe(r: Recipe) {
    setRecipe(r)
    setPhase('ingredients')
    setStepIndex(0)
    setChecked(new Set())
  }

  function reset() {
    setRecipe(null)
    setPhase('pick')
    setStepIndex(0)
    setChecked(new Set())
  }

  function toggleIngredient(i: number) {
    setChecked(prev => {
      const next = new Set(prev)
      next.has(i) ? next.delete(i) : next.add(i)
      return next
    })
  }

  // ── Pick phase ─────────────────────────────────────────────────────────────

  if (phase === 'pick' || !recipe) {
    return (
      <div className="max-w-2xl mx-auto py-8">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <ChefHat size={14} /> Choose a Recipe to Cook
        </h2>
        {recipes.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <ChefHat size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm text-gray-500 font-medium">No recipes yet</p>
            <p className="text-xs mt-1">Go to "Add Recipe" to get started</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {recipes.map(r => (
              <button
                key={r.id}
                onClick={() => startWithRecipe(r)}
                className="bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-green-300 hover:shadow-sm transition-all"
              >
                <p className="font-medium text-sm text-gray-900 truncate">{r.name}</p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Clock size={10} />{r.prepTime + r.cookTime}m
                  </span>
                  <span className="text-xs text-gray-400 flex items-center gap-1">
                    <Users size={10} />{r.servings} serv.
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    )
  }

  const steps = recipe.instructions ?? []
  const ingredients = recipe.ingredients ?? []

  // ── Ingredients phase ──────────────────────────────────────────────────────

  if (phase === 'ingredients') {
    return (
      <div className="max-w-xl mx-auto py-6 space-y-5">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">{recipe.name}</h2>
            <div className="flex items-center gap-4 mt-1">
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock size={11} />{recipe.prepTime + recipe.cookTime}m
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Users size={11} />{recipe.servings} servings
              </span>
            </div>
          </div>
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0">
            ← Back
          </button>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Ingredients
            {checked.size > 0 && (
              <span className="ml-2 text-xs font-normal text-green-600">
                {checked.size}/{ingredients.length} checked
              </span>
            )}
          </h3>
          {ingredients.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No ingredients listed.</p>
          ) : (
            <ul className="space-y-2.5">
              {ingredients.map((ing, i) => (
                <li
                  key={i}
                  onClick={() => toggleIngredient(i)}
                  className={`flex items-center gap-3 text-sm cursor-pointer group select-none ${
                    checked.has(i) ? 'text-gray-300' : 'text-gray-700'
                  }`}
                >
                  <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                    checked.has(i)
                      ? 'bg-green-600 border-green-600'
                      : 'border-gray-300 group-hover:border-green-400'
                  }`}>
                    {checked.has(i) && <Check size={10} className="text-white" />}
                  </span>
                  <span className={checked.has(i) ? 'line-through' : ''}>
                    <span className="font-medium">{ing.quantity}{ing.unit ? ' ' + ing.unit : ''}</span>
                    {' '}{ing.name}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          onClick={() => setPhase(steps.length > 0 ? 'steps' : 'done')}
          className="w-full bg-green-600 hover:bg-green-700 text-white rounded-xl py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {steps.length > 0 ? (<>Start Cooking <ArrowRight size={15} /></>) : (<><Check size={15} /> Mark as Done</>)}
        </button>
      </div>
    )
  }

  // ── Steps phase ────────────────────────────────────────────────────────────

  if (phase === 'steps') {
    const isFirst = stepIndex === 0
    const isLast = stepIndex === steps.length - 1
    const progress = ((stepIndex + 1) / steps.length) * 100

    return (
      <div className="max-w-xl mx-auto py-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800 truncate pr-4">{recipe.name}</h2>
          <button
            onClick={() => setPhase('ingredients')}
            className="text-xs text-gray-400 hover:text-gray-700 transition-colors shrink-0"
          >
            ← Ingredients
          </button>
        </div>

        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-gray-100 rounded-full h-1.5">
            <div
              className="bg-green-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="text-xs text-gray-400 shrink-0 tabular-nums">
            {stepIndex + 1} / {steps.length}
          </span>
        </div>

        {/* Step card */}
        <div className="bg-white border border-gray-200 rounded-xl p-6 min-h-[180px] flex flex-col">
          <span className="text-xs font-semibold text-green-600 uppercase tracking-wide">
            Step {stepIndex + 1}
          </span>
          <p className="mt-3 text-gray-800 text-base leading-relaxed flex-1">
            {steps[stepIndex]}
          </p>
        </div>

        {/* Navigation */}
        <div className="flex gap-3">
          <button
            onClick={() => setStepIndex(i => i - 1)}
            disabled={isFirst}
            className="flex items-center gap-1.5 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium disabled:opacity-30 hover:border-gray-300 transition-colors text-gray-600"
          >
            <ArrowLeft size={15} /> Prev
          </button>
          {isLast ? (
            <button
              onClick={() => setPhase('done')}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              <Check size={15} /> Done!
            </button>
          ) : (
            <button
              onClick={() => setStepIndex(i => i + 1)}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl py-2.5 text-sm font-medium transition-colors flex items-center justify-center gap-2"
            >
              Next <ArrowRight size={15} />
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Done phase ─────────────────────────────────────────────────────────────

  return (
    <div className="max-w-xl mx-auto py-20 text-center space-y-4">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
        <Check size={28} className="text-green-600" />
      </div>
      <h2 className="text-xl font-semibold text-gray-900">Enjoy your meal!</h2>
      <p className="text-sm text-gray-400">{recipe.name}</p>
      <button
        onClick={reset}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 mx-auto transition-colors pt-2"
      >
        <RotateCcw size={14} /> Cook something else
      </button>
    </div>
  )
}
