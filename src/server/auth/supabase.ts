import { createServerClient, parseCookieHeader } from '@supabase/ssr'
import { getRequest, setCookie } from '@tanstack/react-start/server'

export function createSupabaseServerClient() {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_PUBLISHABLE_KEY

  if (!url || !key) {
    throw new Error('SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY must be set')
  }

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        const header = getRequest().headers.get('Cookie') ?? ''
        return parseCookieHeader(header).map(({ name, value }) => ({
          name,
          value: value ?? '',
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(name, value, options)
        })
      },
    },
  })
}