// All TypeScript types for FoodFlow in one place.
// TypeScript types are like contracts — they tell you exactly what shape
// data must have, so you get errors in your editor instead of at runtime.

export interface Ingredient {
  name: string
  quantity: string
  unit?: string // the ? means this field is optional
}

export interface Recipe {
  id: string
  name: string
  prepTime: number   // minutes
  cookTime: number   // minutes
  servings: number
  emoji?: string
  ingredients?: Ingredient[]
  instructions?: string[]
  tags?: string[]
  createdAt?: string
}

export interface UserGoals {
  healthyEating: boolean
  weightLoss: boolean
  muscleGain: boolean
  budgetFriendly: boolean
}

// What a week's meal plan looks like in the database
// e.g. { monday: { breakfast: recipe, lunch: null, dinner: recipe }, ... }
export type WeekMealPlan = Record<
  string,
  Record<'breakfast' | 'lunch' | 'dinner', Recipe | null>
>

// A single message in the AI recipe chat
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  detectedRecipe?: Recipe
}
