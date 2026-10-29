import { useState, useRef } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { uploadImageFn } from '../server/functions/upload.ts'

interface ImageUploaderProps {
  multiple?: boolean
  value?: string | string[]
  onChange: (value: any) => void
  label?: string
  helperText?: string
}

export function ImageUploader({
  multiple = false,
  value,
  onChange,
  label,
  helperText,
}: ImageUploaderProps) {
  const uploadImage = useServerFn(uploadImageFn)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const [urlInput, setUrlInput] = useState('')

  const images: string[] = multiple
    ? Array.isArray(value)
      ? value
      : []
    : typeof value === 'string' && value
    ? [value]
    : []

  async function handleFileProcess(file: File) {
    if (!file.type.startsWith('image/')) {
      throw new Error(`"${file.name}" is not an image file`)
    }
    if (file.size > 5 * 1024 * 1024) {
      throw new Error(`"${file.name}" exceeds 5MB size limit`)
    }

    return new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = async () => {
        try {
          const base64 = reader.result as string
          const res = await uploadImage({
            data: {
              filename: file.name,
              contentType: file.type as any,
              base64,
            },
          })
          resolve(res.url)
        } catch (err) {
          reject(err)
        }
      }
      reader.onerror = () => reject(new Error('Failed to read file'))
      reader.readAsDataURL(file)
    })
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setError(null)
    setUploading(true)

    try {
      const filesToProcess = multiple ? Array.from(files) : [files[0]]
      const uploadedUrls: string[] = []

      for (const file of filesToProcess) {
        const url = await handleFileProcess(file)
        uploadedUrls.push(url)
      }

      if (multiple) {
        onChange([...images, ...uploadedUrls])
      } else {
        onChange(uploadedUrls[0])
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  function handleRemove(indexToRemove: number) {
    if (multiple) {
      onChange(images.filter((_, idx) => idx !== indexToRemove))
    } else {
      onChange(undefined)
    }
  }

  function handleAddUrl(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = urlInput.trim()
    if (!trimmed) return

    if (multiple) {
      onChange([...images, trimmed])
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
          <label className="text-sm font-medium text-gray-700">{label}</label>
          <button
            type="button"
            onClick={() => setShowUrlInput(!showUrlInput)}
            className="text-xs text-blue-600 hover:underline"
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
            className="flex-1 rounded border border-gray-300 px-3 py-1.5 text-xs focus:border-black focus:outline-none"
          />
          <button
            type="submit"
            className="rounded bg-black px-3 py-1.5 text-xs text-white hover:bg-gray-800"
          >
            Add
          </button>
        </form>
      ) : null}

      {/* Single image compact mode */}
      {!multiple && (
        <div className="flex items-center gap-3">
          {images[0] ? (
            <div className="relative h-16 w-16 overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
              <img
                src={images[0]}
                alt="Variant preview"
                className="h-full w-full object-cover"
                onError={(e) => {
                  ;(e.target as HTMLImageElement).src =
                    'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                }}
              />
              <button
                type="button"
                onClick={() => handleRemove(0)}
                className="absolute top-0.5 right-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-red-600 text-[10px] text-white hover:bg-red-700"
                title="Remove image"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex h-16 w-16 flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 text-gray-500 hover:border-gray-400 hover:bg-gray-50 disabled:opacity-50"
            >
              {uploading ? (
                <span className="text-[10px] text-gray-500 animate-pulse">
                  Uploading...
                </span>
              ) : (
                <>
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                  <span className="text-[9px] mt-0.5">Image</span>
                </>
              )}
            </button>
          )}

          {images[0] && (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="text-xs text-gray-600 underline hover:text-black"
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
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-300 p-4 transition-colors hover:border-gray-400 hover:bg-gray-50"
          >
            {uploading ? (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-black border-r-transparent"></span>
                <span>Uploading image(s)...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center text-center">
                <svg
                  className="mb-1.5 h-7 w-7 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                  />
                </svg>
                <p className="text-xs font-medium text-gray-700">
                  Click or drag images here to upload
                </p>
                <p className="text-[11px] text-gray-500">
                  PNG, JPG, WebP up to 5MB
                </p>
              </div>
            )}
          </div>

          {images.length > 0 && (
            <div className="grid grid-cols-4 gap-3 sm:grid-cols-6">
              {images.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="group relative aspect-square overflow-hidden rounded-lg border border-gray-200 bg-gray-50"
                >
                  <img
                    src={url}
                    alt={`Product ${idx + 1}`}
                    className="h-full w-full object-cover"
                    onError={(e) => {
                      ;(e.target as HTMLImageElement).src =
                        'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23999" stroke-width="1.5"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>'
                    }}
                  />
                  {idx === 0 && (
                    <span className="absolute bottom-1 left-1 rounded bg-black/75 px-1.5 py-0.5 text-[9px] font-semibold text-white uppercase tracking-wider">
                      Cover
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      handleRemove(idx)
                    }}
                    className="absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-xs text-white opacity-90 transition-opacity hover:opacity-100"
                    title="Remove"
                  >
                    ✕
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

      {error ? <p className="text-xs text-red-600">{error}</p> : null}
      {helperText ? (
        <p className="text-xs text-gray-500">{helperText}</p>
      ) : null}
    </div>
  )
}

