// RecipePanel is a slide-in panel from the right for viewing and editing a recipe.
// It overlays the page with a dark backdrop and closes on click-outside or Escape.

import { useState, useEffect, useCallback } from 'react'
import { updateRecipe, deleteRecipe } from '../firebase'
import type { Recipe, Ingredient } from '../types'
import { X, Plus, Trash2, Save } from 'lucide-react'

interface Props {
  userId: string
  recipe: Recipe
  onClose: () => void
}

interface FormState {
  name: string
  prepTime: number
  cookTime: number
  servings: number
  tags: string
  ingredients: Ingredient[]
  instructions: string[]
}

function toForm(recipe: Recipe): FormState {
  return {
    name: recipe.name,
    prepTime: recipe.prepTime,
    cookTime: recipe.cookTime,
    servings: recipe.servings,
    tags: recipe.tags?.join(', ') ?? '',
    ingredients: recipe.ingredients?.length ? recipe.ingredients : [],
    instructions: recipe.instructions?.length ? recipe.instructions : [],
  }
}

export default function RecipePanel({ userId, recipe, onClose }: Props) {
  const [form, setForm] = useState<FormState>(toForm(recipe))
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  // Re-initialise form if the recipe prop changes (e.g. real-time update)
  useEffect(() => {
    setForm(toForm(recipe))
  }, [recipe.id])

  // Close on Escape key
  const handleKey = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [handleKey])

  async function handleSave() {
    setSaving(true)
    try {
      const data: Omit<Recipe, 'id'> = {
        name: form.name.trim(),
        prepTime: form.prepTime,
        cookTime: form.cookTime,
        servings: form.servings,
        tags: form.tags.split(',').map(t => t.trim()).filter(Boolean),
        ingredients: form.ingredients,
        instructions: form.instructions.filter(s => s.trim()),
        emoji: recipe.emoji,
        createdAt: recipe.createdAt,
      }
      await updateRecipe(userId, recipe.id, data)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!confirmDelete) { setConfirmDelete(true); return }
    setDeleting(true)
    try {
      await deleteRecipe(userId, recipe.id)
      onClose()
    } finally {
      setDeleting(false)
    }
  }

  // ── ingredient helpers ──────────────────────────────────────────────────
  function updateIngredient(i: number, field: keyof Ingredient, value: string) {
    setForm(f => {
      const next = [...f.ingredients]
      next[i] = { ...next[i], [field]: value }
      return { ...f, ingredients: next }
    })
  }

  function addIngredient() {
    setForm(f => ({ ...f, ingredients: [...f.ingredients, { name: '', quantity: '', unit: '' }] }))
  }

  function removeIngredient(i: number) {
    setForm(f => ({ ...f, ingredients: f.ingredients.filter((_, idx) => idx !== i) }))
  }

  // ── instruction helpers ─────────────────────────────────────────────────
  function updateInstruction(i: number, value: string) {
    setForm(f => {
      const next = [...f.instructions]
      next[i] = value
      return { ...f, instructions: next }
    })
  }

  function addInstruction() {
    setForm(f => ({ ...f, instructions: [...f.instructions, ''] }))
  }

  function removeInstruction(i: number) {
    setForm(f => ({ ...f, instructions: f.instructions.filter((_, idx) => idx !== i) }))
  }

  const inputCls = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 w-full'
  const numCls = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 w-16 text-center'

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed top-0 right-0 h-full w-96 bg-white shadow-2xl z-50 flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-base">Edit Recipe</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Scrollable form body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">

          {/* Name */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Name</label>
            <input
              className={inputCls}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            />
          </div>

          {/* Times + Servings */}
          <div className="flex items-end gap-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Prep (min)</label>
              <input
                type="number"
                min={0}
                className={numCls}
                value={form.prepTime}
                onChange={e => setForm(f => ({ ...f, prepTime: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Cook (min)</label>
              <input
                type="number"
                min={0}
                className={numCls}
                value={form.cookTime}
                onChange={e => setForm(f => ({ ...f, cookTime: Number(e.target.value) }))}
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Servings</label>
              <input
                type="number"
                min={1}
                className={numCls}
                value={form.servings}
                onChange={e => setForm(f => ({ ...f, servings: Number(e.target.value) }))}
              />
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-1">Tags (comma-separated)</label>
            <input
              className={inputCls}
              placeholder="e.g. vegetarian, quick, italian"
              value={form.tags}
              onChange={e => setForm(f => ({ ...f, tags: e.target.value }))}
            />
          </div>

          {/* Ingredients */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Ingredients</label>
            <div className="space-y-2">
              {form.ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-1.5">
                  <input
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 w-14 text-center"
                    placeholder="qty"
                    value={ing.quantity}
                    onChange={e => updateIngredient(i, 'quantity', e.target.value)}
                  />
                  <input
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 w-14 text-center"
                    placeholder="unit"
                    value={ing.unit ?? ''}
                    onChange={e => updateIngredient(i, 'unit', e.target.value)}
                  />
                  <input
                    className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 flex-1"
                    placeholder="ingredient"
                    value={ing.name}
                    onChange={e => updateIngredient(i, 'name', e.target.value)}
                  />
                  <button onClick={() => removeIngredient(i)} className="text-gray-300 hover:text-red-400 transition-colors shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addIngredient}
              className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition-colors"
            >
              <Plus size={13} /> Add ingredient
            </button>
          </div>

          {/* Instructions */}
          <div>
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide block mb-2">Instructions</label>
            <div className="space-y-2">
              {form.instructions.map((step, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 font-medium mt-2 w-4 shrink-0 text-right">{i + 1}.</span>
                  <textarea
                    rows={2}
                    className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 flex-1 resize-none"
                    value={step}
                    onChange={e => updateInstruction(i, e.target.value)}
                  />
                  <button onClick={() => removeInstruction(i)} className="text-gray-300 hover:text-red-400 transition-colors mt-2 shrink-0">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addInstruction}
              className="mt-2 flex items-center gap-1 text-xs text-green-600 hover:text-green-800 transition-colors"
            >
              <Plus size={13} /> Add step
            </button>
          </div>

        </div>

        {/* Footer actions */}
        <div className="px-5 py-4 border-t border-gray-100 flex items-center justify-between gap-3">
          <button
            onClick={handleDelete}
            disabled={deleting}
            className={`flex items-center gap-1.5 text-sm font-medium transition-colors disabled:opacity-40 ${
              confirmDelete
                ? 'text-red-600 hover:text-red-800'
                : 'text-gray-400 hover:text-red-500'
            }`}
          >
            <Trash2 size={14} />
            {confirmDelete ? 'Confirm delete' : 'Delete'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !form.name.trim()}
            className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors"
          >
            <Save size={14} />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>

      </div>
    </>
  )
}
