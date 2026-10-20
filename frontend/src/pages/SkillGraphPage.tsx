import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Background, Controls, Handle, MarkerType, Position, ReactFlow,
} from '@xyflow/react'
import type { Node, NodeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useCareers } from '../careers/careerContext'
import { CareerFeedback } from '../components/CareerSelection'
import Button from '../components/ui/Button'
import Dialog from '../components/ui/Dialog'
import SkillDetails from '../components/SkillDetails'
import { buildSkillGraph } from '../services/skillGraph'
import type { SkillGraphData, SkillGraphStatus } from '../services/skillGraph'

const statusLabels: Record<SkillGraphStatus, string> = {
  completed: 'Completed',
  learning: 'Learning',
  available: 'Available',
  locked: 'Locked',
  verified: 'Quiz verified',
}

const statusStyles: Record<SkillGraphStatus, string> = {
  completed: 'border-emerald-400/70 bg-emerald-950 text-emerald-200',
  learning: 'border-amber-400/70 bg-amber-950 text-amber-200',
  available: 'border-indigo-400/70 bg-indigo-950 text-indigo-200',
  locked: 'border-slate-500 bg-slate-900 text-slate-300',
  verified: 'border-cyan-300/70 bg-cyan-950 text-cyan-100',
}

type GraphNode = Node<SkillGraphData, 'skill'>

function SkillNode({ data }: NodeProps<GraphNode>) {
  return <div className="w-[220px]">
    <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-indigo-200 !bg-indigo-400" />
    <button
      type="button"
      className={`nodrag nopan w-full rounded-2xl border-2 px-4 py-3 text-left shadow-lg ${statusStyles[data.status]}`}
      aria-label={`Inspect ${data.name} in graph`}
      data-status={data.status}
    >
      <span className="block text-base font-bold">{data.name}</span>
      <span className="mt-1 block text-xs font-semibold">{statusLabels[data.status]}</span>
      {data.status === 'locked' && <span className="mt-2 block text-xs leading-5">Needs: {data.missingPrerequisites.map((skill) => skill.name).join(', ')}</span>}
    </button>
    <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-indigo-200 !bg-indigo-400" />
  </div>
}

const nodeTypes = { skill: SkillNode }

export default function SkillGraphPage() {
  const { data, loading, error, signedIn, retry } = useCareers()
  const [params, setParams] = useSearchParams()
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const careers = data?.careers ?? []
  const requestedId = params.get('path') ?? data?.selectedIds[0]
  const career = careers.find((item) => item.id === requestedId) ?? careers[0]
  const graph = useMemo(() => {
    if (!career) return null
    try {
      return buildSkillGraph(career)
    } catch {
      return null
    }
  }, [career])
  const selected = career?.skills.find((skill) => skill.id === selectedId)
  const selectedNode = graph?.nodes.find((node) => node.id === selectedId)

  function chooseCareer(id: string) {
    const next = new URLSearchParams(params)
    next.set('path', id)
    setParams(next, { replace: true })
    setSelectedId(null)
  }

  return <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 md:px-10">
    <p className="text-sm font-semibold uppercase tracking-widest text-indigo-400">Connect your learning</p>
    <h1 className="mt-4 text-4xl font-bold md:text-5xl">Skill Graph</h1>
    <p className="mt-4 max-w-2xl leading-7 text-slate-400">Follow the arrows from prerequisites to the skills they unlock. Open a skill to see what it involves and what to learn first.</p>
    <CareerFeedback />
    {!loading && !error && data && <>
      {careers.length === 0 ? <p className="mt-8 text-slate-300">No career paths available.</p> : <>
        <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
          <div className="w-full max-w-sm">
            <label htmlFor="graph-career" className="mb-2 block text-sm font-semibold text-slate-200">Career path</label>
            <select
              id="graph-career"
              value={career?.id ?? ''}
              onChange={(event) => chooseCareer(event.target.value)}
              className="min-h-11 w-full rounded-xl border border-white/20 bg-surface px-3 py-3 text-base text-white"
            >
              {careers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          </div>
          <p className="max-w-sm text-sm leading-6 text-slate-400">{signedIn ? 'Your current learning progress.' : 'Preview progress. Log in to track your own learning.'} Browsing a graph does not change your saved career choices.</p>
        </div>
        <ul aria-label="Skill status legend" className="my-6 flex flex-wrap gap-2">
          {(Object.keys(statusLabels) as SkillGraphStatus[]).map((status) => <li key={status} className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[status]}`}>{statusLabels[status]}</li>)}
        </ul>
        {career && !graph ? <div role="alert" className="rounded-2xl border border-red-400/30 p-5 text-red-200">
          <p>Could not display this skill map. Try refreshing or choose another career path.</p>
          <Button variant="ghost" onClick={retry} className="mt-3">Refresh skill graph</Button>
        </div> : graph && graph.nodes.length === 0 ? <p className="rounded-2xl border border-white/10 p-6 text-slate-300">No skills in this career path yet.</p> : graph && <>
          <section aria-label="Skill dependency graph" className="overflow-hidden rounded-3xl border border-white/15 bg-canvas">
            <div className="border-b border-white/10 px-4 py-4 sm:px-6">
              <h2 className="font-bold">{career?.name} dependencies</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">Drag the background to move around. Use the zoom controls or your mouse wheel to explore. Each arrow points toward a skill that needs the earlier one.</p>
            </div>
            <div className="devatlas-skill-graph h-[420px] w-full sm:h-[500px]">
              <ReactFlow<GraphNode>
                key={career?.id}
                nodes={graph.nodes}
                edges={graph.edges}
                nodeTypes={nodeTypes}
                onNodeClick={(_event, node) => setSelectedId(node.id)}
                nodesDraggable={false}
                nodesConnectable={false}
                nodesFocusable={false}
                edgesFocusable={false}
                elementsSelectable={false}
                colorMode="dark"
                minZoom={0.2}
                maxZoom={2}
                fitView
                fitViewOptions={{ padding: 0.15, maxZoom: 1, duration: 0 }}
                defaultEdgeOptions={{
                  markerEnd: { type: MarkerType.ArrowClosed, color: '#a5b4fc' },
                  style: { stroke: '#a5b4fc', strokeWidth: 2 },
                }}
              >
                <Background color="#475569" gap={24} />
                <Controls showInteractive={false} fitViewOptions={{ padding: 0.15, maxZoom: 1, duration: 0 }} />
              </ReactFlow>
            </div>
          </section>
          <section aria-label="Skills in this path" className="mt-8">
            <h2 className="text-2xl font-bold">Explore each skill</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">Use these buttons as an alternative to the graph. Locked skills list prerequisites still needing completion or quiz verification.</p>
            <ul className="mt-4 grid gap-3 sm:grid-cols-2">
              {graph.nodes.map((node) => <li key={node.id} className="min-w-0 rounded-2xl border border-white/10 bg-surface p-4">
                <Button variant="ghost" onClick={() => setSelectedId(node.id)} aria-label={`Open ${node.data.name} details`} className="w-full justify-between !px-0 text-left">
                  <span className="font-semibold">{node.data.name}</span>
                  <span className={`rounded-full border px-2 py-1 text-xs ${statusStyles[node.data.status]}`}>{statusLabels[node.data.status]}</span>
                </Button>
                <p className="mt-1 text-sm leading-6 text-slate-400">{node.data.missingPrerequisites.length ? `Missing prerequisites: ${node.data.missingPrerequisites.map((skill) => skill.name).join(', ')}.` : 'No missing prerequisites.'}</p>
              </li>)}
            </ul>
          </section>
        </>}
        <p className="mt-6 text-xs leading-6 text-slate-400">Completion is self-reported. Quiz verification means passing a DevAtlas practice quiz at 80% or higher, not professional certification.</p>
      </>}
    </>}
    <Dialog open={!!selected && !!selectedNode} onClose={() => setSelectedId(null)} title={`${selected?.name ?? 'Skill'} details`}>
      {selected && selectedNode && <>
        <p className="mb-4 text-sm text-slate-400">Learning state: {statusLabels[selectedNode.data.status]}</p>
        {selectedNode.data.missingPrerequisites.length > 0 && <p className="mb-4 text-sm text-slate-300">Missing prerequisites: {selectedNode.data.missingPrerequisites.map((skill) => skill.name).join(', ')}.</p>}
        <SkillDetails key={selected.id} skillId={selected.id} onNavigate={setSelectedId} />
      </>}
    </Dialog>
  </div>
}
