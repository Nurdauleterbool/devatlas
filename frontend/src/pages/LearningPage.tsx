import { Link } from 'react-router-dom'
import { useCareers } from '../careers/careerContext'
import { CareerFeedback } from '../components/CareerSelection'
import Card from '../components/ui/Card'

export default function LearningPage() {
  const { data, loading, error } = useCareers()
  const skills = [...new Map(data?.careers.flatMap((career) => career.skills).map((skill) => [skill.id, skill]) ?? []).values()]
  return <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 md:px-10">
    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">Build your understanding</p>
    <h1 className="mt-4 text-4xl font-bold md:text-5xl">Learning</h1>
    <p className="mt-4 max-w-2xl leading-7 text-slate-400">Explore free resources, practice exercises and your learning status for each skill.</p>
    <CareerFeedback />
    {!loading && !error && <section aria-label="Learning skills" className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {skills.length === 0 ? <p className="text-slate-400">No learning skills available.</p> : skills.map((skill) => <Card key={skill.id} className="flex min-w-0 flex-col">
        <h2 className="text-xl font-bold">{skill.name}</h2>
        <p className="mt-3 flex-1 text-sm leading-6 text-slate-400">{skill.description}</p>
        <Link to={`/skills/${encodeURIComponent(skill.id)}`} className="mt-5 inline-flex min-h-11 items-center font-semibold text-indigo-300 hover:underline">Study {skill.name} →</Link>
      </Card>)}
    </section>}
  </div>
}
