import * as React from 'react'
import { Eye, EyeOff, ImagePlus, Loader2, Star, Trash2 } from 'lucide-react'
import type { Category, Work } from '../../../shared/types'
import { api, errorMessage, uploadImage } from '@/lib/api'
import { thumbOf } from '@/hooks/site'
import { cn } from '@/lib/utils'
import { Empty, Field, PageTitle, Section, btnCls, inputCls, useLoad, useToast } from '../ui'

export default function WorksAdmin() {
  const toast = useToast()
  const { data: works, setData: setWorks, reload } = useLoad(() => api.get<Work[]>('/admin/works'))
  const { data: categories } = useLoad(() => api.get<Category[]>('/admin/categories'))
  const [uploadCat, setUploadCat] = React.useState('')
  const [uploading, setUploading] = React.useState<string>('')
  const [filter, setFilter] = React.useState('')
  const [limit, setLimit] = React.useState(24)
  const fileRef = React.useRef<HTMLInputElement>(null)

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    let done = 0
    for (const file of Array.from(files)) {
      setUploading(`Enviando ${done + 1} de ${files.length}…`)
      try {
        const url = await uploadImage(file)
        await api.post('/admin/works', {
          title: file.name.replace(/\.[^.]+$/, '').slice(0, 60) || 'Novo trabalho',
          imageUrl: url,
          categoryIds: uploadCat ? [uploadCat] : [],
          bodyArea: '',
          featured: false,
          visible: true,
        })
        done++
      } catch (e) {
        toast(`${file.name}: ${errorMessage(e)}`, true)
      }
    }
    setUploading('')
    if (fileRef.current) fileRef.current.value = ''
    if (done) toast(`${done} ${done === 1 ? 'foto adicionada' : 'fotos adicionadas'} ao site.`)
    await reload()
  }

  const patch = async (w: Work, change: Partial<Work>) => {
    setWorks((list) => (list ? list.map((x) => (x.id === w.id ? { ...x, ...change } : x)) : list))
    try {
      await api.patch(`/admin/works/${w.id}`, change)
    } catch (e) {
      toast(errorMessage(e), true)
      void reload()
    }
  }

  const remove = async (w: Work) => {
    if (!window.confirm(`Apagar "${w.title}" do site?`)) return
    try {
      await api.del(`/admin/works/${w.id}`)
      toast('Foto apagada.')
      await reload()
    } catch (e) {
      toast(errorMessage(e), true)
    }
  }

  const list = (works ?? []).filter((w) => !filter || w.categoryIds.includes(filter))

  return (
    <>
      <PageTitle title="Fotos do site" />

      <Section className="mb-6">
        <div className="grid items-end gap-4 sm:grid-cols-[1fr_auto]">
          <Field label="Estilo das novas fotos" hint="Você pode ajustar cada foto depois.">
            <select value={uploadCat} onChange={(e) => setUploadCat(e.target.value)} className={inputCls}>
              <option value="">Sem estilo</option>
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
          <div>
            <input ref={fileRef} id="up" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => void upload(e.target.files)} />
            <label htmlFor="up" className={cn(btnCls, 'w-full cursor-pointer', uploading && 'pointer-events-none opacity-60')}>
              {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <ImagePlus className="size-4" aria-hidden />} {uploading || 'Adicionar fotos'}
            </label>
          </div>
        </div>
      </Section>

      <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrar por estilo">
        {[{ id: '', name: 'Todos' }, ...(categories ?? [])].map((c) => (
          <button
            key={c.id || 'all'}
            type="button"
            aria-pressed={filter === c.id}
            onClick={() => {
              setFilter(c.id)
              setLimit(24)
            }}
            className={cn('px-3.5 py-2 text-[12px] tracking-[0.15em] uppercase', filter === c.id ? 'bg-black text-white' : 'border border-black/40 hover:bg-black/10')}
          >
            {c.name}
          </button>
        ))}
      </div>

      {!works ? null : list.length === 0 ? (
        <Empty>Nenhuma foto aqui ainda.</Empty>
      ) : (
        <>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {list.slice(0, limit).map((w) => (
              <li key={w.id} className={cn('border border-black/15 bg-white', !w.visible && 'opacity-60')}>
                <div className="relative">
                  <img src={thumbOf(w.imageUrl)} alt={w.title} loading="lazy" className="aspect-[4/3] w-full bg-black/5 object-cover grayscale" />
                  <div className="absolute top-2 right-2 flex gap-1.5">
                    <button
                      type="button"
                      aria-pressed={w.featured}
                      aria-label={w.featured ? 'Tirar dos destaques' : 'Destacar'}
                      onClick={() => patch(w, { featured: !w.featured })}
                      className={cn('grid size-10 place-items-center border border-black', w.featured ? 'bg-black text-white' : 'bg-white')}
                    >
                      <Star className="size-4" aria-hidden />
                    </button>
                    <button type="button" aria-label={w.visible ? 'Ocultar do site' : 'Mostrar no site'} onClick={() => patch(w, { visible: !w.visible })} className="grid size-10 place-items-center border border-black bg-white">
                      {w.visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
                    </button>
                    <button type="button" aria-label="Apagar" onClick={() => remove(w)} className="grid size-10 place-items-center border border-black bg-white hover:bg-black hover:text-white">
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </div>
                </div>
                <div className="space-y-3 p-3">
                  <input
                    aria-label="Título"
                    defaultValue={w.title}
                    maxLength={80}
                    onBlur={(e) => e.target.value.trim() && e.target.value !== w.title && void patch(w, { title: e.target.value.trim() })}
                    className={inputCls}
                  />
                  <input
                    aria-label="Região do corpo"
                    placeholder="Região (ex.: Antebraço)"
                    defaultValue={w.bodyArea}
                    maxLength={60}
                    onBlur={(e) => e.target.value !== w.bodyArea && void patch(w, { bodyArea: e.target.value.trim() })}
                    className={inputCls}
                  />
                  <div className="flex flex-wrap gap-1.5" role="group" aria-label="Estilos">
                    {(categories ?? []).map((c) => {
                      const on = w.categoryIds.includes(c.id)
                      return (
                        <button
                          key={c.id}
                          type="button"
                          aria-pressed={on}
                          onClick={() => patch(w, { categoryIds: on ? w.categoryIds.filter((id) => id !== c.id) : [...w.categoryIds, c.id] })}
                          className={cn('px-2.5 py-1.5 text-[11px] tracking-[0.12em] uppercase', on ? 'bg-black text-white' : 'border border-black/40 hover:bg-black/10')}
                        >
                          {c.name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {list.length > limit && (
            <div className="mt-6 flex justify-center">
              <button type="button" className={btnCls} onClick={() => setLimit((n) => n + 24)}>
                Ver mais ({list.length - limit})
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
