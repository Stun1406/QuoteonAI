'use client'

import React, { Suspense, useState, useTransition } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'

function LogoIcon() {
  return (
    <svg viewBox="0 0 32 32" fill="none" className="w-9 h-9">
      <rect width="32" height="32" rx="8" fill="#2563EB" />
      <path d="M8 10h16M8 16h10M8 22h13" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="23" cy="22" r="3.5" fill="white" fillOpacity="0.2" stroke="white" strokeWidth="1.5" />
      <path d="M21.5 22l1 1 2-2" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/app'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  async function handleCredentials(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    startTransition(async () => {
      const res = await signIn('credentials', {
        email: email.trim().toLowerCase(),
        password,
        redirect: false,
      })
      if (res?.error) {
        setError('Invalid email or password. Please try again.')
      } else {
        router.replace(callbackUrl)
        router.refresh()
      }
    })
  }

  async function handleGoogle() {
    setError(null)
    await signIn('google', { callbackUrl })
  }

  return (
    <div className="bg-white rounded-2xl shadow-xl shadow-slate-200/60 border border-slate-100 p-8">

      {error && (
        <div className="mb-5 flex items-start gap-3 px-4 py-3 rounded-xl bg-red-50 border border-red-100 text-sm text-red-700">
          <svg viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 flex-shrink-0 mt-0.5 text-red-400">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-5a.75.75 0 01.75.75v4.5a.75.75 0 01-1.5 0v-4.5A.75.75 0 0110 5zm0 10a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
          </svg>
          {error}
        </div>
      )}

      <form onSubmit={handleCredentials} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Email address</label>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="you@company.com"
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition bg-slate-50 focus:bg-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="••••••••"
            className="w-full px-4 py-2.5 text-sm border border-slate-200 rounded-xl outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-50 transition bg-slate-50 focus:bg-white"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-[0.99] disabled:opacity-60 text-white text-sm font-semibold transition shadow-sm shadow-blue-200"
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Signing in…
            </span>
          ) : 'Sign in'}
        </button>
      </form>

      <div className="my-5 flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-100" />
        <span className="text-xs text-slate-400 font-medium">or continue with</span>
        <div className="flex-1 h-px bg-slate-100" />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 active:scale-[0.99] text-sm font-medium text-slate-700 transition"
      >
        <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" xmlns="http://www.w3.org/2000/svg">
          <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
          <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
          <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
          <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
        </svg>
        Continue with Google
      </button>

      <p className="mt-6 text-center text-xs text-slate-400">
        Don&apos;t have an account?{' '}
        <span className="text-slate-500 font-medium">Contact your administrator.</span>
      </p>
    </div>
  )
}

export default function LoginPage() {
  return (
    <div
      className="min-h-screen flex items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0A0F1E 0%, #0F172A 50%, #1A1F35 100%)',
        fontFamily: 'Inter, system-ui, sans-serif',
      }}
    >
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-sm px-4">
        {/* Back to home */}
        <div className="mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white transition">
            <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
              <path fillRule="evenodd" d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z" clipRule="evenodd" />
            </svg>
            Back to home
          </Link>
        </div>

        {/* Logo / Brand */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center gap-2.5 mb-3">
            <LogoIcon />
            <span className="text-2xl font-bold text-white tracking-tight">QuotionAI</span>
          </div>
          <p className="text-sm text-slate-400">Sign in to access your quoting dashboard</p>
        </div>

        <Suspense fallback={
          <div className="bg-white rounded-2xl p-8 text-center text-sm text-slate-400">
            Loading…
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-xs text-slate-600 mt-6">
          Intelligent Sales Quoting · Powered by Agentic AI
        </p>
      </div>
    </div>
  )
}
