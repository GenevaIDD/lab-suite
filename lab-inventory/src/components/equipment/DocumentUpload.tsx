import { useRef, useState } from 'react'
import { FileText, Upload, Trash2, Loader2, ExternalLink } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { uploadEquipmentDocument, useAddEquipmentDocument, useDeleteEquipmentDocument } from '@/lib/mutations'
import { useEquipmentDocuments } from '@/lib/queries'
import { useAuth } from '@/lib/auth'
import { toast } from 'sonner'
import { format, parseISO } from 'date-fns'

function formatBytes(bytes: number | null) {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Used on the detail page (fetches and displays saved docs) ──
export function EquipmentDocumentList({ equipmentId }: { equipmentId: string }) {
  const { data: docs = [], isLoading } = useEquipmentDocuments(equipmentId)
  const deleteDoc = useDeleteEquipmentDocument()
  const { profile } = useAuth()
  const fileRef = useRef<HTMLInputElement>(null)
  const addDoc = useAddEquipmentDocument()
  const [uploading, setUploading] = useState(false)
  const [pendingDesc, setPendingDesc] = useState('')

  async function handleUpload(files: FileList | null) {
    if (!files || !files[0]) return
    const file = files[0]
    if (!pendingDesc.trim()) { toast.error('Veuillez saisir une description avant de téléverser.'); return }
    setUploading(true)
    try {
      const result = await uploadEquipmentDocument(file)
      if (!result) { toast.warning('Impossible de téléverser hors ligne.'); return }
      await addDoc.mutateAsync({
        equipment_id: equipmentId,
        description: pendingDesc.trim(),
        file_url: result.url,
        file_name: result.name,
        file_size_bytes: result.size,
        uploaded_by: profile?.full_name ?? null,
      })
      setPendingDesc('')
      toast.success('Document ajouté')
    } catch (err) {
      toast.error(`Échec : ${(err as Error).message}`)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-3">
      {isLoading ? (
        <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : docs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aucun document joint.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(doc => (
            <li key={doc.id} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{doc.description}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {doc.file_name}{doc.file_size_bytes ? ` · ${formatBytes(doc.file_size_bytes)}` : ''} · {format(parseISO(doc.uploaded_at), 'd MMM yyyy')}
                </p>
              </div>
              <div className="flex gap-1 shrink-0">
                <a href={doc.file_url} target="_blank" rel="noopener"
                  className="p-1.5 rounded hover:bg-muted" title="Ouvrir">
                  <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                </a>
                <button
                  type="button"
                  onClick={async () => {
                    try { await deleteDoc.mutateAsync({ id: doc.id, equipmentId }); toast.success('Document supprimé') }
                    catch (err) { toast.error(`Erreur : ${(err as Error).message}`) }
                  }}
                  className="p-1.5 rounded hover:bg-muted text-destructive"
                  title="Supprimer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add new doc */}
      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground">Ajouter un document</p>
        <Input
          value={pendingDesc}
          onChange={e => setPendingDesc(e.target.value)}
          placeholder="Description (ex: Manuel utilisateur, Certificat de calibration…)"
          className="text-sm"
        />
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={e => handleUpload(e.target.files)} />
        <Button type="button" variant="outline" size="sm" disabled={uploading || !pendingDesc.trim()}
          onClick={() => fileRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
          Choisir un fichier
        </Button>
      </div>
    </div>
  )
}

// ── Used on the new equipment form (draft docs, uploaded after save) ──
export interface DocumentDraft {
  description: string
  file: File
  tempUrl: string
}

export function DocumentDraftList({
  drafts,
  onChange,
}: {
  drafts: DocumentDraft[]
  onChange: (drafts: DocumentDraft[]) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [desc, setDesc] = useState('')

  function handleFile(files: FileList | null) {
    if (!files || !files[0]) return
    if (!desc.trim()) { toast.error('Saisissez une description d\'abord.'); return }
    const file = files[0]
    onChange([...drafts, { description: desc.trim(), file, tempUrl: URL.createObjectURL(file) }])
    setDesc('')
    if (fileRef.current) fileRef.current.value = ''
  }

  function remove(idx: number) {
    URL.revokeObjectURL(drafts[idx].tempUrl)
    onChange(drafts.filter((_, i) => i !== idx))
  }

  return (
    <div className="space-y-3">
      {drafts.length > 0 && (
        <ul className="space-y-2">
          {drafts.map((d, i) => (
            <li key={i} className="flex items-center gap-3 rounded-md border px-3 py-2">
              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{d.description}</p>
                <p className="text-xs text-muted-foreground truncate">{d.file.name} · {formatBytes(d.file.size)}</p>
              </div>
              <button type="button" onClick={() => remove(i)} className="p-1.5 rounded hover:bg-muted text-destructive">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="rounded-md border p-3 space-y-2 bg-muted/20">
        <p className="text-xs font-medium text-muted-foreground">Ajouter un document</p>
        <Input value={desc} onChange={e => setDesc(e.target.value)}
          placeholder="Description (ex: Manuel, Certificat…)" className="text-sm" />
        <input ref={fileRef} type="file" className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          onChange={e => handleFile(e.target.files)} />
        <Button type="button" variant="outline" size="sm" disabled={!desc.trim()} onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4 mr-1" />
          Choisir un fichier
        </Button>
      </div>
    </div>
  )
}
