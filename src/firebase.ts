// Firebase handles two things for us:
// 1. Auth — who is logged in (email + password)
// 2. Database — storing each user's recipes, meal plans, goals
//
// The config below connects to YOUR Firebase project.
// Get these values from: Firebase Console → Project Settings → Your apps

import { initializeApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  type User,
} from 'firebase/auth'
import {
  getDatabase,
  ref,
  set,
  get,
  push,
  onValue,
} from 'firebase/database'
import type { Recipe, UserGoals, WeekMealPlan } from './types'

// ── Config ─────────────────────────────────────────────────────────────────
// TODO: replace these with your v3 Firebase project values
// (create a new project at console.firebase.google.com)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
export const db = getDatabase(app)

// ── Auth ───────────────────────────────────────────────────────────────────

export const registerWithEmail = (email: string, password: string) =>
  createUserWithEmailAndPassword(auth, email, password)

export const loginWithEmail = (email: string, password: string) =>
  signInWithEmailAndPassword(auth, email, password)

export const logout = () => signOut(auth)

// Call this once in App.tsx to react to login/logout events.
// Firebase fires this automatically when the page loads too (persistent session).
export const onAuthChange = (callback: (user: User | null) => void) =>
  onAuthStateChanged(auth, callback)

// ── Recipes ────────────────────────────────────────────────────────────────

export const saveRecipe = async (userId: string, recipe: Omit<Recipe, 'id'>): Promise<string> => {
  const recipeRef = push(ref(db, `users/${userId}/recipes`))
  await set(recipeRef, { ...recipe, createdAt: new Date().toISOString() })
  return recipeRef.key!
}

export const deleteRecipe = (userId: string, recipeId: string) =>
  set(ref(db, `users/${userId}/recipes/${recipeId}`), null)

export const updateRecipe = (userId: string, recipeId: string, data: Omit<Recipe, 'id'>) =>
  set(ref(db, `users/${userId}/recipes/${recipeId}`), data)

// Real-time listener — callback fires immediately with current data,
// then again whenever the data changes.
export const subscribeToRecipes = (
  userId: string,
  callback: (recipes: Recipe[]) => void
): (() => void) => {
  const recipesRef = ref(db, `users/${userId}/recipes`)
  return onValue(recipesRef, (snapshot) => {
    if (!snapshot.exists()) return callback([])
    const raw = snapshot.val()
    const list = Object.entries(raw).map(([id, data]: [string, any]) => ({ id, ...data }))
    callback(list)
  })
}

// ── Goals ──────────────────────────────────────────────────────────────────

export const saveGoals = (userId: string, goals: UserGoals) =>
  set(ref(db, `users/${userId}/goals`), goals)

export const getGoals = async (userId: string): Promise<UserGoals | null> => {
  const snapshot = await get(ref(db, `users/${userId}/goals`))
  return snapshot.exists() ? snapshot.val() : null
}

// ── Meal Plans ─────────────────────────────────────────────────────────────

export const saveMealPlan = (userId: string, weekStart: string, plan: WeekMealPlan) =>
  set(ref(db, `users/${userId}/mealPlans/${weekStart}`), plan)

export const getMealPlan = async (userId: string, weekStart: string): Promise<WeekMealPlan | null> => {
  const snapshot = await get(ref(db, `users/${userId}/mealPlans/${weekStart}`))
  return snapshot.exists() ? snapshot.val() : null
}

export type { User }
