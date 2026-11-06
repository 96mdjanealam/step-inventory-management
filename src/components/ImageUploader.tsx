import { useState, useRef, useEffect, useMemo } from 'react'
import { Plus, Image as ImageIcon, X } from 'lucide-react'

export type UploadableImage = string | File

export interface ImageUploaderProps {
  multiple?: boolean
  value?: UploadableImage | UploadableImage[]
  onChange: (value: any) => void
  label?: string
  helperText?: string
}

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error(`Failed to read file: ${file.name}`))
    reader.readAsDataURL(file)
  })
}

export type UploadFn = (args: {
  data: { filename: string; contentType: any; base64: string }
}) => Promise<{ url: string }>

export async function processUploadableImage(
  item: UploadableImage | undefined,
  uploadFn: UploadFn,
): Promise<string | undefined> {
  if (!item) return undefined
  if (typeof item === 'string') return item

  const base64 = await fileToBase64(item)
  const res = await uploadFn({
    data: {
      filename: item.name,
      contentType: item.type as any,
      base64,
    },
  })
  return res.url
}

export async function processUploadableImages(
  items: UploadableImage[],
  uploadFn: UploadFn,
): Promise<string[]> {
  const promises = items.map((item) => processUploadableImage(item, uploadFn))
  const results = await Promise.all(promises)
  return results.filter((url): url is string => Boolean(url))
}

export function ImageUploader({
  multiple = false,
  value,
  onChange,
  label,
  helperText,
}: ImageUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const items: UploadableImage[] = useMemo(() => {
    if (multiple) {
      return Array.isArray(value) ? value : []
    }
    return value ? [value as UploadableImage] : []
  }, [multiple, value])

  // Generate preview URLs for both string URLs and staged File objects
  const previewUrls = useMemo(() => {
    return items.map((item) => {
      if (typeof item === 'string') {
        return { isFile: false, url: item }
      }
      return { isFile: true, url: URL.createObjectURL(item) }
    })
  }, [items])

  // Revoke object URLs on unmount or when items change to prevent memory leaks
  useEffect(() => {
    return () => {
      previewUrls.forEach((p) => {
        if (p.isFile && p.url.startsWith('blob:')) {
          URL.revokeObjectURL(p.url)
        }
      })
    }
  }, [previewUrls])

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)

    const validFiles: File[] = []
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      if (!file.type.startsWith('image/')) {
        setError(`"${file.name}" is not an image file`)
        return
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`"${file.name}" exceeds the 5MB size limit`)
        return
      }
      validFiles.push(file)
    }

    if (multiple) {
      onChange([...items, ...validFiles])
    } else {
      onChange(validFiles[0])
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleRemove(indexToRemove: number) {
    if (multiple) {
      onChange(items.filter((_, idx) => idx !== indexToRemove))
    } else {
      onChange(undefined)
    }
  }

  function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = urlInput.trim()
    if (!trimmed) return

    if (multiple) {
      onChange([...items, trimmed])
    } else {
      onChange(trimmed)
    }
    setUrlInput('')
    setShowUrlInput(false)
  }

  return (
    <div className="flex flex-col gap-2">
      {label ? (
        <div className="flex items-center justify-between">
          <label className="text-sm font-medium text-brand-charcoal">{label}</label>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-brand-primary hover:underline cursor-pointer"
          >
            {showUrlInput ? 'Cancel URL' : '+ Paste image URL'}
          </button>
        </div>
      ) : null}

      {showUrlInput ? (
        <form onSubmit={handleAddUrl} className="flex gap-2">
          <input
            type="url"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder="https://example.com/image.jpg"
            className="flex-1 border border-neutral-300 bg-white px-3 py-1.5 text-xs text-brand-charcoal focus:border-brand-primary focus:outline-hidden"
          />
          <button
            type="submit"
            className="bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark cursor-pointer transition"
          >
            Add
          </button>
        </form>
      ) : null}

      {/* Single image compact mode */}
      {!multiple && (
        <div className="flex items-center gap-3">
          {previewUrls[0] ? (
            <div className="relative h-16 w-16 overflow-hidden border border-neutral-200 bg-neutral-50 shadow-2xs">
              <img
                src={previewUrls[0].url}
                alt="Variant preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                }}
              />
              {previewUrls[0].isFile && (
                <span className="absolute bottom-0 inset-x-0 bg-brand-primary/90 text-[8px] font-bold text-white text-center py-0.5 uppercase tracking-tighter">
                  New
                </span>
              )}
              <button
                type="button"
                onClick={() => handleRemove(0)}
                className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center bg-rose-600 text-[10px] text-white hover:bg-rose-700 cursor-pointer shadow-xs"
                title="Remove image"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center border-2 border-dashed border-neutral-300 text-neutral-500 hover:border-brand-primary hover:text-brand-primary hover:bg-brand-bg/30 transition cursor-pointer"
            >
              <Plus className="h-5 w-5" />
              <span className="text-[9px] mt-0.5">Image</span>
            </button>
          )}

          {previewUrls[0] && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-neutral-600 underline hover:text-brand-primary cursor-pointer"
            >
              Change
            </button>
          )}
        </div>
      )}

      {/* Multiple images gallery mode */}
      {multiple && (
        <div className="flex flex-col gap-3">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault()
              handleFiles(e.dataTransfer.files)
            }}
            onClick={() => fileInputRef.current?.click()}
            className="flex cursor-pointer flex-col items-center justify-center border-2 border-dashed border-neutral-300 p-4 transition-colors hover:border-brand-primary hover:bg-brand-bg/20"
          >
            <div className="flex flex-col items-center text-center">
              <ImageIcon className="mb-1.5 h-7 w-7 text-neutral-400" />
              <p className="text-xs font-medium text-brand-charcoal">
                Click or drag images here
              </p>
              <p className="text-[11px] text-neutral-500">
                PNG, JPG, WebP up to 5MB (staged locally until saved)
              </p>
            </div>
          </div>

          {previewUrls.length > 0 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {previewUrls.map((p, idx) => (
                <div
                  key={`${p.url}-${idx}`}
                  className="group relative aspect-square overflow-hidden border border-neutral-200 bg-neutral-50 shadow-2xs"
                >
                  <img
                    src={p.url}
                    alt={`Product ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                    }}
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 bg-brand-charcoal/85 px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wider">
                      Cover
                    </span>
                  )}
                  {p.isFile && (
                    <span className="absolute top-1 left-1 bg-brand-primary px-1.5 py-0.5 text-[8px] font-bold text-white uppercase tracking-tighter">
                      New
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(idx)
                    }}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center bg-rose-600 text-xs text-white opacity-90 transition-opacity hover:opacity-100 cursor-pointer shadow-xs"
                    title="Remove image"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
        multiple={multiple}
        onChange={(e) => handleFiles(e.target.files)}
        className="hidden"
      />

      {error ? <p className="text-xs text-rose-600 font-medium">{error}</p> : null}
      {helperText ? (
        <p className="text-xs text-neutral-500">{helperText}</p>
      ) : null}
    </div>
  )
}
