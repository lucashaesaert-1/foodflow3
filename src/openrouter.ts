// All AI calls go through here.
// We use OpenRouter (openrouter.ai) which gives us access to many AI models
// through one API — we're using Google Gemini Flash (fast + cheap).
//
// This is a plain fetch call to their API, nothing magical.

import type { Recipe, UserGoals, ChatMessage } from './types'

const BASE_URL = 'https://openrouter.ai/api/v1'
const MODEL = 'google/gemini-2.0-flash-001'

function getKey(): string {
  const key = import.meta.env.VITE_OPENROUTER_API_KEY as string
  if (!key) throw new Error('VITE_OPENROUTER_API_KEY is not set')
  return key
}

// Core function — sends messages to the AI and returns its text response.
// Every other function below is just this with different instructions.
async function chat(
  messages: { role: string; content: string }[],
  options: { temperature?: number; json?: boolean } = {}
): Promise<string> {
  const res = await fetch(`${BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${getKey()}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages,
      temperature: options.temperature ?? 0.7,
      ...(options.json ? { response_format: { type: 'json_object' } } : {}),
    }),
  })

  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(`OpenRouter error ${res.status}: ${body}`)
  }

  const data = await res.json()
  return data.choices?.[0]?.message?.content ?? ''
}

// ── Recipe chat ────────────────────────────────────────────────────────────
// The AI acts as a recipe intake assistant — asks the user questions and
// extracts a structured recipe from the conversation.

export async function chatAboutRecipes(
  userMessage: string,
  history: ChatMessage[],
  existingRecipes: Recipe[],
  goals: UserGoals | null
): Promise<string> {
  const goalLabels = goals
    ? Object.entries(goals)
        .filter(([, v]) => v)
        .map(([k]) =>
          k === 'healthyEating' ? 'healthy eating'
          : k === 'weightLoss' ? 'weight loss'
          : k === 'muscleGain' ? 'muscle gain'
          : 'budget friendly'
        )
        .join(', ') || 'none'
    : 'not set'

  const systemPrompt = `You are a recipe intake assistant for FoodFlow. Your only job is to help the user add ONE new recipe to their collection through a friendly conversation.

User's dietary goals: ${goalLabels}.
Their existing recipes: ${existingRecipes.length > 0 ? existingRecipes.map(r => `"${r.name}"`).join(', ') : 'none yet'}.

Fields you need to collect: recipe name (required), ingredients with quantities, servings, prep time (minutes), cook time (minutes).

Rules:
1. Ask what recipe the user wants to add if they haven't said yet.
2. Ask for ONE missing field at a time in a conversational way.
3. If the user says "skip", make a sensible assumption and note it.
4. After each reply, show a short "📋 Draft:" section with confirmed/assumed values.
5. Once you have the name + all other fields (confirmed or assumed), output the recipe at the end like this — RECIPE_JSON: followed immediately by the JSON on the same line.

Output format:
RECIPE_JSON: {"name":"...","prepTime":0,"cookTime":0,"servings":0,"ingredients":[{"name":"...","quantity":"...","unit":"..."}],"instructions":["step 1"],"emoji":"🍳","tags":[]}`

  return chat(
    [
      { role: 'system', content: systemPrompt },
      ...history.map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage },
    ],
    { temperature: 0.7 }
  )
}

// ── Recipe import parser ───────────────────────────────────────────────────
// Given raw recipe text (pasted or extracted from a file), parse it directly
// into a RECIPE_JSON block without any conversational follow-up.

export async function parseRecipeFromText(text: string): Promise<string> {
  const systemPrompt = `You are a recipe parser. The user will provide raw recipe text. Extract all the information and return ONLY this exact format on a single line:

RECIPE_JSON: {"name":"...","prepTime":0,"cookTime":0,"servings":0,"ingredients":[{"name":"...","quantity":"...","unit":"..."}],"instructions":["step 1","step 2"],"tags":[],"emoji":"🍳"}

Rules:
- prepTime and cookTime must be numbers (minutes). Use 0 if unknown.
- servings must be a number. Use 4 if unknown.
- ingredients must be an array of objects with name, quantity (as string), and unit (empty string if none).
- instructions must be an array of strings.
- Output ONLY the RECIPE_JSON line, nothing else.`

  return chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text },
    ],
    { temperature: 0.3 }
  )
}

// ── Meal plan generation ───────────────────────────────────────────────────
// Given a list of recipes and the user's goals, generate a 7-day meal plan.

export async function generateMealPlan(
  recipes: Recipe[],
  goals: UserGoals
): Promise<string> {
  const goalLabels = Object.entries(goals)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ') || 'balanced'

  const recipeList = recipes
    .map(r => `- ID: "${r.id}", Name: "${r.name}", Tags: ${r.tags?.join(', ') ?? 'none'}`)
    .join('\n')

  const systemPrompt = `You are a meal planning expert. The user's goals: ${goalLabels}.

Available recipes:
${recipeList}

Generate a 7-day meal plan using ONLY the recipe IDs above. Some slots can be null.
Return ONLY this exact JSON structure:
{
  "monday":    { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" },
  "tuesday":   { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" },
  "wednesday": { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" },
  "thursday":  { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" },
  "friday":    { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" },
  "saturday":  { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" },
  "sunday":    { "breakfast": "recipeId or null", "lunch": "recipeId or null", "dinner": "recipeId or null" }
}`

  return chat(
    [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate my meal plan. Return ONLY the JSON.' },
    ],
    { temperature: 0.7, json: true }
  )
}
