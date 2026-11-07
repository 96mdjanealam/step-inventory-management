import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { requireUser } from '../middleware/auth.ts'
import { createSupabaseAdminClient } from '../auth/supabase.ts'

const uploadImageSchema = z.object({
  filename: z.string().min(1),
  contentType: z.string().regex(/^image\/(jpeg|png|webp|gif|svg\+xml)$/, 'Invalid image type'),
  base64: z.string().min(1, 'No file content provided'),
})

const ALLOWED_EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

export const uploadImageFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(uploadImageSchema)
  .handler(async ({ data }) => {
    // 1. Decode base64 buffer
    // Strip data URL prefix if present
    const base64Data = data.base64.replace(/^data:image\/[a-z+]+;base64,/, '')
    const buffer = Buffer.from(base64Data, 'base64')

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new Error('Image exceeds maximum allowed size of 5MB')
    }

    const ext = ALLOWED_EXTENSIONS[data.contentType] || 'jpg'
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${ext}`

    // 2. Upload directly to Supabase Storage bucket 'product-images'
    const supabase = createSupabaseAdminClient()
    const { error: uploadError } = await supabase.storage
      .from('product-images')
      .upload(uniqueName, buffer, {
        contentType: data.contentType,
        upsert: true,
      })

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError.message)
      throw new Error(`Failed to upload image: ${uploadError.message}`)
    }

    const { data: pubData } = supabase.storage
      .from('product-images')
      .getPublicUrl(uniqueName)

    if (!pubData?.publicUrl) {
      throw new Error('Failed to retrieve public URL from Supabase storage')
    }

    return { url: pubData.publicUrl }
  })

const deleteImageSchema = z.object({
  url: z.string().min(1, 'No URL provided'),
})

export const deleteImageFn = createServerFn({ method: 'POST' })
  .middleware([requireUser])
  .validator(deleteImageSchema)
  .handler(async ({ data }) => {
    try {
      const match = data.url.match(/\/product-images\/(.+)$/)
      if (match) {
        const filePath = decodeURIComponent(match[1])
        const supabase = createSupabaseAdminClient()
        await supabase.storage.from('product-images').remove([filePath])
      }
    } catch (sbErr) {
      console.warn('Supabase image removal warning:', sbErr)
    }

    return { success: true }
  })

