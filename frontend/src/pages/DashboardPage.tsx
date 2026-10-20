import { Link } from 'react-router-dom'
import { CheckCircle2, Compass, ShieldCheck, Target } from 'lucide-react'
import { useAuth } from '../auth/authContext'
import { useCareers } from '../careers/careerContext'
import CareerSelection, { CareerFeedback } from '../components/CareerSelection'
import CareerProgress from '../components/CareerProgress'
import Card from '../components/ui/Card'

export default function DashboardPage() {
  const { session } = useAuth()
  const { data, loading, error, signedIn } = useCareers()
  const ready = !loading && !error && data
  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:px-10">
    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">{signedIn ? 'Your learning workspace' : 'Your future in technology'}</p>
    <h1 className="mt-4 max-w-3xl break-words text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">{signedIn ? `Your next chapter, ${session?.user.displayName}.` : <>Find your direction.<span className="block text-indigo-400">Master your next skill.</span></>}</h1>
    <p className="mt-4 max-w-2xl leading-7 text-slate-400">{signedIn ? 'A clear view of your paths, your progress and what to learn next.' : 'Explore IT careers, discover your skill gaps, and build a personalized learning roadmap.'}</p>
    <CareerFeedback />
    {ready && <>
      {signedIn && data.selected.length === 0 && data.careers.length > 0 && <section aria-label="No selected career" className="mt-8 rounded-3xl border border-indigo-400/30 bg-indigo-500/10 p-6"><Compass className="text-indigo-300" aria-hidden="true" /><h2 className="mt-3 text-2xl font-bold">Choose your first career path</h2><p className="mt-3 text-slate-300">Select a path below to see your progress, skill gaps and next steps. You can change direction at any time.</p></section>}
      {signedIn && data.selected.length > 0 && <>
        <section aria-label="Selected career overview" className="mt-8 rounded-3xl border border-indigo-400/25 bg-gradient-to-br from-indigo-500/15 to-surface p-5 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-sm text-indigo-300">Selected career paths</p><h2 className="mt-2 break-words text-2xl font-bold">{data.selected.map((career) => career.name).join(' + ')}</h2></div><Link to="/careers" className="inline-flex min-h-11 items-center text-sm font-semibold text-indigo-300 hover:underline">Manage roadmaps →</Link></div>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3"><p className="text-sm text-slate-300">{data.completed.length} of {data.skills.length} unique skills completed</p><p className="text-3xl font-bold text-indigo-200">{data.completionPercent}%</p></div>
          <CareerProgress value={data.completionPercent} label="Selected careers completion" />
          <p className="mt-3 text-xs leading-5 text-slate-400">Completion is self-reported. Shared skills are counted once across selected paths.</p>
        </section>
        <dl className="mt-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[{ label: 'Skills in scope', value: data.skills.length, Icon: Compass }, { label: 'Completed skills', value: data.completed.length, Icon: CheckCircle2 }, { label: 'Verified skills', value: data.verified.length, Icon: ShieldCheck }, { label: 'Skill gaps', value: data.gaps.length, Icon: Target }].map(({label,value,Icon}) => <div key={label} className="rounded-2xl border border-white/10 bg-surface p-4 sm:p-5"><Icon className="mb-3 text-indigo-300" size={20} aria-hidden="true" /><dt className="text-sm text-slate-400">{label}</dt><dd className="mt-1 text-3xl font-bold">{value}</dd></div>)}
        </dl>
        <p className="mt-3 text-xs leading-5 text-slate-400">Verified means passed a DevAtlas practice quiz at 80% or higher, not professional certification. A skill can be verified independently of its self-reported completion.</p>
        <div className="mt-8 grid items-start gap-5 lg:grid-cols-2">
          <section aria-labelledby="recommendations-title" className="rounded-3xl border border-white/10 bg-surface p-5 sm:p-6"><p className="text-xs font-semibold uppercase tracking-widest text-indigo-400">Keep moving forward</p><h2 id="recommendations-title" className="mt-2 text-2xl font-bold">Recommended next skills</h2><p className="mt-2 text-sm leading-6 text-slate-400">Suggestions respect your prerequisites and current progress.</p>
            {data.recommendations.length === 0 ? <p className="mt-5 text-slate-300">No eligible next skills right now. Review your required skills and progress.</p> : <ol className="mt-5 space-y-4">{data.recommendations.map(({skill,paths},index) => <li key={skill.id} className="rounded-2xl border border-indigo-400/20 bg-indigo-500/5 p-4"><div className="flex items-center gap-3"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-500/20 text-sm text-indigo-200">{index+1}</span><h3 className="font-semibold">{skill.name}</h3></div>{paths.map((path) => <p key={path.name} className="mt-3 text-sm leading-6 text-slate-300"><span className="font-medium text-indigo-300">{path.name}: </span>{path.reason}</p>)}</li>)}</ol>}
          </section>
          <section aria-labelledby="gaps-title" className="rounded-3xl border border-white/10 bg-surface p-5 sm:p-6"><h2 id="gaps-title" className="text-2xl font-bold">Your skill gaps</h2><p className="mt-2 text-sm leading-6 text-slate-400">Required skills you have not yet marked completed. Quiz verification is shown separately.</p>
            {data.gaps.length === 0 ? <p className="mt-5 text-emerald-200">All skills in your selected paths are marked completed.</p> : <ul className="mt-5 divide-y divide-white/10">{data.gaps.map((skill) => <li key={skill.id} className="flex flex-wrap items-center justify-between gap-2 py-3 text-sm"><span className="font-medium">{skill.name}</span><span className="text-slate-400">{skill.progress.status === 'learning' ? 'Learning' : 'Not started'}{skill.progress.verified ? ' · Quiz verified' : ''}</span></li>)}</ul>}
            <h3 className="mt-6 font-semibold">Completed skills</h3><p className="mt-2 text-sm leading-6 text-slate-400">{data.completed.map((skill) => skill.name).join(', ') || 'No skills marked completed yet.'}</p>
            <h3 className="mt-5 font-semibold">Quiz-verified skills</h3><p className="mt-2 text-sm leading-6 text-slate-400">{data.verified.map((skill) => skill.name).join(', ') || 'No verified skills yet.'}</p>
          </section>
        </div>
        <section aria-label="Progress by selected career" className="mt-8 grid gap-4 xl:grid-cols-3">{data.selected.map((career) => {const progress=data.analytics?.careers.find((item) => item.careerId === career.id);return <Card key={career.id}><h2 className="text-lg font-bold">{career.name}</h2><p className="mt-3 text-sm text-slate-400">{progress?.completedSkills ?? 0} of {progress?.totalSkills ?? 0} completed · {progress?.verifiedSkills ?? 0} verified</p><CareerProgress value={progress?.completionPercent ?? 0} label={`${career.name} completion`} /></Card>})}</section>
      </>}
      <CareerSelection />
      {!signedIn && <p className="mt-6 text-sm text-slate-400"><Link to="/login" className="inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">Log in</Link> to save your career choices. Demo data is a preview.</p>}
    </>}
  </div>
}
