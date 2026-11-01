import { Download, Upload } from 'lucide-react'
import { useRef, useState } from 'react'
import Button from '../../components/ui/Button.tsx'
import FormMessage, { type Message } from '../../components/ui/FormMessage.tsx'
import Modal from '../../components/ui/Modal.tsx'
import { uploadBackup } from './api.ts'

function BackupPanel() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  // The chosen zip waits here until the admin confirms the restore
  const [file, setFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [message, setMessage] = useState<Message | null>(null)

  function closeModal() {
    setFile(null)
    // Clears the picker, so the same file can be chosen again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  async function restore(chosen: File) {
    setIsUploading(true)
    setMessage(null)
    try {
      const summary = await uploadBackup(chosen)
      setMessage({
        text: `De backup is teruggezet: ${summary.items} materialen, ${summary.categories} categorieën en ${summary.departments} afdelingen.`,
        isError: false,
      })
    } catch (caught) {
      setMessage({ text: caught instanceof Error ? caught.message : 'Het terugzetten is mislukt.', isError: true })
    } finally {
      setIsUploading(false)
      closeModal()
    }
  }

  return (
    <section className="flex flex-col gap-5 rounded-xl bg-white p-6 shadow">
      <div className="flex flex-col gap-2">
        <h2 className="text-lg font-semibold">Backup</h2>
        <p className="text-gray-600">
          Een backup is een zip-bestand met alle materialen, categorieën en afdelingen in de map <code>data</code> en de
          foto's van de materialen in de map <code>images</code>.
        </p>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row">
        <Button onClick={() => (window.location.href = '/api/backup')}>
          <Download className="size-4" aria-hidden="true" />
          Backup downloaden
        </Button>
        <Button variant="secondary" disabled={isUploading} onClick={() => fileInputRef.current?.click()}>
          <Upload className="size-4" aria-hidden="true" />
          {isUploading ? 'Bezig met terugzetten...' : 'Backup uploaden'}
        </Button>
        <input
          className="hidden"
          ref={fileInputRef}
          type="file"
          accept=".zip,application/zip"
          onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        />
      </div>

      <FormMessage message={message} />

      {file !== null && (
        <Modal title="Backup terugzetten" onClose={closeModal}>
          <div className="flex flex-col gap-5">
            <p className="break-words">
              Weet je zeker dat je <strong>{file.name}</strong> wilt terugzetten? Materialen, categorieën en afdelingen
              uit de backup overschrijven de huidige gegevens met hetzelfde nummer, de rest wordt toegevoegd.
            </p>

            <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button variant="neutral" onClick={closeModal}>
                Annuleren
              </Button>
              <Button variant="danger" disabled={isUploading} onClick={() => restore(file)}>
                Terugzetten
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  )
}

export default BackupPanel
