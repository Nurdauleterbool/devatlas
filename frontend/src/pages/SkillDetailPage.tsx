import { Link, useParams } from 'react-router-dom'
import SkillDetails from '../components/SkillDetails'

export default function SkillDetailPage() {
  const { skillId = '' } = useParams<{ skillId: string }>()
  return <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 md:px-10">
    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">Build your knowledge</p>
    <h1 className="mt-4 text-4xl font-bold md:text-5xl">Skill details</h1>
    <Link to="/learning" className="my-5 inline-flex min-h-11 items-center text-sm font-semibold text-indigo-300 hover:underline">← Browse learning skills</Link>
    <div className="rounded-3xl border border-white/10 bg-surface p-4 sm:p-7">
      <SkillDetails skillId={skillId} />
    </div>
  </div>
}
