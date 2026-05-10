import { useRef, useState } from 'react'
import { Camera, Upload, X, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { uploadEquipmentPhoto } from '@/lib/mutations'
import { toast } from 'sonner'

interface PhotoUploadProps {
  photos: string[]
  onChange: (photos: string[]) => void
}

export function PhotoUpload({ photos, onChange }: PhotoUploadProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return
    setUploading(true)
    try {
      const uploaded: string[] = []
      for (const file of Array.from(files)) {
        const url = await uploadEquipmentPhoto(file)
        if (url) uploaded.push(url)
        else toast.warning('Cannot upload photos while offline — try again when online.')
      }
      if (uploaded.length > 0) onChange([...photos, ...uploaded])
    } catch (err) {
      toast.error(`Photo upload failed: ${(err as Error).message}`)
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(idx: number) {
    onChange(photos.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => cameraRef.current?.click()}
        >
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Camera className="h-4 w-4 mr-1" />}
          Take Photo
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => fileRef.current?.click()}
        >
          <Upload className="h-4 w-4 mr-1" />
          Upload File
        </Button>
      </div>

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
          {photos.map((url, idx) => (
            <div key={url} className="relative group aspect-square rounded-md overflow-hidden border bg-muted">
              <img src={url} alt={`Photo ${idx + 1}`} className="object-cover w-full h-full" />
              <button
                type="button"
                onClick={() => removePhoto(idx)}
                className="absolute top-1 right-1 bg-background/80 hover:bg-background text-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {photos.length === 0 && !uploading && (
        <p className="text-xs text-muted-foreground">No photos added yet.</p>
      )}
    </div>
  )
}
