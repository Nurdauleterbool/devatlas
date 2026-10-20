export default function CareerProgress({ value, label = 'Career progress' }: { value: number; label?: string }) {
  return <div role="progressbar" aria-label={label} aria-valuenow={value} aria-valuemin={0} aria-valuemax={100} className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-indigo-500 transition-all motion-reduce:transition-none" style={{ width: `${value}%` }} /></div>
}
