// RecipeChat is the AI assistant that helps users add recipes through conversation.
// The user describes a recipe in natural language, the AI asks follow-up questions,
// and when it has enough info it outputs a RECIPE_JSON block that we parse and save.
// It also supports importing recipes from pasted text or uploaded files (txt, md, pdf).

import { useState, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { chatAboutRecipes, parseRecipeFromText } from '../openrouter'
import { saveRecipe, subscribeToRecipes } from '../firebase'
import type { Recipe, ChatMessage } from '../types'
import { Send, SkipForward, Check, Upload, FileText, X, Loader2, Link } from 'lucide-react'

// Point pdfjs at its bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url
).toString()

interface Props {
  userId: string
}

export default function RecipeChat({ userId }: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '0',
      role: 'assistant',
      content: 'Hi! What recipe would you like to add to your collection?',
      timestamp: new Date(),
    },
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [recipes, setRecipes] = useState<Recipe[]>([])
  const bottomRef = useRef<HTMLDivElement>(null)

  // Import panel state
  const [showImport, setShowImport] = useState(false)
  const [importText, setImportText] = useState('')
  const [importUrl, setImportUrl] = useState('')
  const [urlLoading, setUrlLoading] = useState(false)
  const [importLoading, setImportLoading] = useState(false)
  const [importResult, setImportResult] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const unsubscribe = subscribeToRecipes(userId, setRecipes)
    return unsubscribe
  }, [userId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── file handling ────────────────────────────────────────────────────────

  async function extractTextFromFile(file: File): Promise<string> {
    if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      const buffer = await file.arrayBuffer()
      const pdf = await pdfjsLib.getDocument({ data: buffer }).promise
      const pages: string[] = []
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i)
        const content = await page.getTextContent()
        pages.push(content.items.map((item: any) => item.str).join(' '))
      }
      return pages.join('\n')
    }
    // .txt / .md — plain text
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = e => resolve(e.target?.result as string ?? '')
      reader.onerror = reject
      reader.readAsText(file)
    })
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const text = await extractTextFromFile(file)
      setImportText(text)
    } catch {
      setImportText('[Could not read file — try pasting the recipe text instead]')
    }
    // Reset so the same file can be re-selected
    e.target.value = ''
  }

  // ── url fetch ────────────────────────────────────────────────────────────

  async function handleUrlFetch() {
    const url = importUrl.trim()
    if (!url || urlLoading) return
    setUrlLoading(true)
    setImportResult(null)
    try {
      const res = await fetch(`https://r.jina.ai/${url}`, {
        headers: { Accept: 'text/plain' },
      })
      if (!res.ok) throw new Error(`Could not fetch the page (status ${res.status}).`)
      const text = await res.text()
      if (!text || text.trim().length < 100)
        throw new Error('The page returned too little content — it may be behind a login or block crawlers. Try pasting the recipe text instead.')
      setImportText(text)
      setImportUrl('')
    } catch (err: any) {
      setImportResult(`Error: ${err.message}`)
    } finally {
      setUrlLoading(false)
    }
  }

  // ── import parse + save ──────────────────────────────────────────────────

  async function handleImportSave() {
    if (!importText.trim() || importLoading) return
    setImportLoading(true)
    setImportResult(null)
    try {
      const response = await parseRecipeFromText(importText.trim())
      const jsonMatch = response.match(/RECIPE_JSON:\s*(\{.+\})/s)
      if (!jsonMatch) throw new Error('Could not parse recipe from the provided text.')
      const parsed = JSON.parse(jsonMatch[1])
      await saveRecipe(userId, parsed)
      setImportResult(`Saved: ${parsed.name}`)
      setImportText('')
      setTimeout(() => {
        setShowImport(false)
        setImportResult(null)
      }, 1800)
    } catch (err: any) {
      setImportResult(`Error: ${err.message}`)
    } finally {
      setImportLoading(false)
    }
  }

  // ── chat ─────────────────────────────────────────────────────────────────

  async function sendMessage(content: string) {
    if (!content.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const response = await chatAboutRecipes(userMessage.content, messages, recipes, null)

      const jsonMatch = response.match(/RECIPE_JSON:\s*(\{.+\})/s)
      let detectedRecipe: Recipe | undefined

      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1])
          const savedId = await saveRecipe(userId, parsed)
          detectedRecipe = { id: savedId, ...parsed }
        } catch { /* JSON parse failed — just show the message */ }
      }

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.replace(/RECIPE_JSON:\s*\{.+\}/s, '').trim(),
        timestamp: new Date(),
        detectedRecipe,
      }

      setMessages(prev => [...prev, assistantMessage])
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        { id: (Date.now() + 1).toString(), role: 'assistant', content: `Error: ${err.message}`, timestamp: new Date() },
      ])
    } finally {
      setLoading(false)
    }
  }

  function send() { sendMessage(input) }
  function skip() { sendMessage('Please finalize and save the recipe now using all the information gathered so far. Make reasonable assumptions for any missing fields.') }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]">

      {/* Import panel */}
      {showImport && (
        <div className="mb-3 bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <FileText size={14} /> Import Recipe
            </h3>
            <button onClick={() => { setShowImport(false); setImportText(''); setImportResult(null) }} className="text-gray-400 hover:text-gray-700">
              <X size={15} />
            </button>
          </div>

          {/* URL fetch */}
          <div className="flex gap-2">
            <input
              type="url"
              placeholder="Paste a recipe URL…"
              value={importUrl}
              onChange={e => setImportUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleUrlFetch()}
              disabled={urlLoading}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
            />
            <button
              onClick={handleUrlFetch}
              disabled={!importUrl.trim() || urlLoading}
              className="flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 disabled:opacity-40 text-gray-600 rounded-lg px-3 py-2 text-sm font-medium transition-colors"
            >
              {urlLoading ? <Loader2 size={13} className="animate-spin" /> : <Link size={13} />}
              {urlLoading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>

          <div className="relative">
            <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 border-t border-gray-100" />
            <span className="relative bg-white px-2 text-xs text-gray-400 block w-fit mx-auto">or paste / upload text</span>
          </div>

          <textarea
            rows={5}
            placeholder="Paste recipe text here, or upload a file below…"
            value={importText}
            onChange={e => setImportText(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 resize-none"
          />

          <div className="flex items-center justify-between gap-3">
            {/* File upload */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 border border-gray-200 rounded-lg px-3 py-1.5 transition-colors"
            >
              <Upload size={13} /> Upload .txt / .md / .pdf
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".txt,.md,.pdf,text/plain,application/pdf"
              className="hidden"
              onChange={handleFileChange}
            />

            {/* Parse & Save */}
            <button
              onClick={handleImportSave}
              disabled={!importText.trim() || importLoading}
              className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-lg px-4 py-1.5 text-sm font-medium transition-colors"
            >
              {importLoading ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
              {importLoading ? 'Parsing…' : 'Parse & Save'}
            </button>
          </div>

          {/* Result feedback */}
          {importResult && (
            <p className={`text-xs font-medium flex items-center gap-1.5 ${importResult.startsWith('Error') ? 'text-red-600' : 'text-green-700'}`}>
              {importResult.startsWith('Error') ? <X size={12} /> : <Check size={12} />}
              {importResult}
            </p>
          )}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-3 pb-4">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                msg.role === 'user'
                  ? 'bg-green-600 text-white rounded-br-sm'
                  : 'bg-white border border-gray-200 text-gray-800 rounded-bl-sm'
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.detectedRecipe && (
                <div className="mt-2 bg-green-50 border border-green-200 rounded-lg p-2 flex items-center gap-1.5">
                  <Check size={12} className="text-green-600 shrink-0" />
                  <p className="text-green-700 font-medium text-xs">Saved: {msg.detectedRecipe.name}</p>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-white border border-gray-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <span className="text-gray-400 text-sm">Thinking…</span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="flex gap-2 pt-3 border-t border-gray-200">
        <button
          onClick={() => setShowImport(v => !v)}
          title="Import recipe from text or file"
          className={`flex items-center gap-1.5 border rounded-xl px-3 py-2.5 text-sm font-medium transition-colors ${
            showImport
              ? 'border-green-400 text-green-700 bg-green-50'
              : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:text-gray-700'
          }`}
        >
          <Upload size={14} /> Import
        </button>
        <input
          type="text"
          placeholder="Describe a recipe…"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && send()}
          disabled={loading}
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500"
        />
        <button
          onClick={skip}
          disabled={loading || messages.length < 2}
          title="Save recipe with current information"
          className="flex items-center gap-1.5 border border-gray-200 hover:border-gray-300 disabled:opacity-40 text-gray-600 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors"
        >
          <SkipForward size={15} /> Skip
        </button>
        <button
          onClick={send}
          disabled={!input.trim() || loading}
          className="flex items-center gap-1.5 bg-green-600 hover:bg-green-700 disabled:opacity-40 text-white rounded-xl px-4 py-2.5 text-sm font-medium transition-colors"
        >
          <Send size={14} /> Send
        </button>
      </div>

    </div>
  )
}
