import { Link } from 'react-router-dom'
import { ArrowRight, Network } from 'lucide-react'
import { useCareers } from '../careers/careerContext'
import Button from './ui/Button'
import Card from './ui/Card'

export function CareerFeedback() {
  const workspace = useCareers()
  return <>
    {workspace.loading && <p role="status" className="mt-8 text-slate-400">Loading career paths...</p>}
    {workspace.error && <div role="alert" className="mt-6 rounded-xl border border-red-400/30 p-4 text-red-300"><p>Failed to load career paths.</p><Button variant="ghost" onClick={workspace.retry} className="mt-2">Retry loading</Button></div>}
    {workspace.saving && <p role="status" className="mt-6 text-indigo-200">Saving your career selection… You can choose another path while this saves.</p>}
    {workspace.saveError && <div role="alert" className="mt-6 rounded-xl border border-red-400/30 p-4 text-red-300"><p>Could not save or refresh your selection. Last confirmed data is shown; your change may have been saved.</p><Button variant="ghost" onClick={workspace.retrySave} className="mt-2">Retry selection</Button></div>}
    {workspace.saved && !workspace.saving && <p role="status" className="mt-6 text-emerald-200">Career selection saved for this mock session.</p>}
  </>
}

export default function CareerSelection({ activeId, onPreview }: { activeId?: string; onPreview?: (id: string) => void }) {
  const { data, signedIn, select, saving, pendingIds } = useCareers()
  if (!data) return null
  // Pending IDs express the next write only; confirmed selection/dashboard always come from service reads.
  const intent = pendingIds ?? data.selectedIds
  return <section aria-label="Available career paths" className="mt-8">
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <h2 className="text-2xl font-bold">Explore career paths</h2>
      <span className="text-sm text-slate-400">{data.careers.length} paths available</span>
    </div>
    {data.careers.length === 0 ? <p className="text-slate-400">No career paths available.</p> : <>
      <p className="mb-5 max-w-2xl text-sm leading-6 text-slate-400">{signedIn ? 'Choose a path to focus on, or include additional paths. Shared skills count once in your overview.' : 'Browse the roadmaps. Log in to save your paths and see your personal dashboard.'}</p>
      <div className="grid gap-4 xl:grid-cols-3">
        {data.careers.map((career) => {
          const selected = data.selectedIds.includes(career.id)
          const preview = activeId === career.id
          return <Card key={career.id} highlighted={signedIn ? selected : preview} className="flex min-w-0 flex-col">
            <Network size={24} className="mb-4 text-indigo-400" aria-hidden="true" />
            <h3 className="text-xl font-bold">{career.name}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-400">{career.description}</p>
            <div className="my-5 flex flex-wrap gap-2">{career.skills.map((skill) => <span key={skill.id} className="rounded-full bg-white/5 px-3 py-1 text-xs text-slate-300">{skill.name}</span>)}</div>
            <p className="mb-5 text-sm text-slate-400">{career.skills.length} skills in this path</p>
            {signedIn ? <>
              <Button aria-label={`Choose ${career.name}`} aria-pressed={selected} onClick={() => { onPreview?.(career.id); select([career.id]) }} className="mt-auto w-full">{selected ? 'Selected path' : 'Choose path'}<ArrowRight size={16} aria-hidden="true" /></Button>
              <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-3 text-sm text-slate-300">
                <input type="checkbox" className="h-5 w-5 shrink-0 accent-indigo-500" checked={intent.includes(career.id)} onChange={(event) => select(event.target.checked ? [...new Set([...intent, career.id])] : intent.filter((id) => id !== career.id))} />
                Include {career.name}
              </label>
              {onPreview && <Button variant="ghost" aria-pressed={preview} aria-label={`Preview ${career.name} roadmap`} onClick={() => onPreview(career.id)}>View roadmap</Button>}
            </> : onPreview ? <Button variant="ghost" aria-pressed={preview} onClick={() => onPreview(career.id)} className="mt-auto w-full">{career.name}<ArrowRight size={16} aria-hidden="true" /></Button> : <Link to={`/careers?path=${encodeURIComponent(career.id)}`} className="mt-auto inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 font-semibold hover:bg-indigo-700">Explore path<ArrowRight size={16} aria-hidden="true" /></Link>}
          </Card>
        })}
      </div>
      {signedIn && data.selectedIds.length > 0 && <Button variant="ghost" onClick={() => select([])} className="mt-4">Clear selected paths</Button>}
      {saving && <p className="mt-2 text-xs text-slate-400">Dashboard totals show the last confirmed selection until saving finishes.</p>}
    </>}
  </section>
}
