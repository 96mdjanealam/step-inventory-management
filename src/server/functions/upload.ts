import { z } from 'zod'
import { createServerFn } from '@tanstack/react-start'
import { requireUser } from '../middleware/auth.ts'
import { createSupabaseAdminClient } from '../auth/supabase.ts'
import fs from 'node:fs/promises'
import path from 'node:path'

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

    // 2. Also ensure local public/uploads directory exists for fallback / offline hosting
    let localUrl: string | null = null
    try {
      const publicUploadsDir = path.resolve(process.cwd(), 'public', 'uploads')
      await fs.mkdir(publicUploadsDir, { recursive: true })
      const filePath = path.join(publicUploadsDir, uniqueName)
      await fs.writeFile(filePath, buffer)
      localUrl = `/uploads/${uniqueName}`
    } catch (fsErr) {
      console.warn('Could not save to local public/uploads directory:', fsErr)
    }

    // 3. Upload to Supabase Storage bucket 'product-images'
    try {
      const supabase = createSupabaseAdminClient()
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(uniqueName, buffer, {
          contentType: data.contentType,
          upsert: true,
        })

      if (!uploadError) {
        const { data: pubData } = supabase.storage
          .from('product-images')
          .getPublicUrl(uniqueName)

        if (pubData?.publicUrl) {
          return { url: pubData.publicUrl }
        }
      } else {
        console.warn('Supabase storage upload failed:', uploadError.message)
      }
    } catch (sbErr) {
      console.warn('Supabase client error:', sbErr)
    }

    // If Supabase wasn't available or failed, return local URL if written
    if (localUrl) {
      return { url: localUrl }
    }

    throw new Error('Failed to save image')
  })

