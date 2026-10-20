import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import Button from '../../src/components/ui/Button'
import Card from '../../src/components/ui/Card'
import Dialog from '../../src/components/ui/Dialog'
import Input from '../../src/components/ui/Input'
import '../../src/index.css'

export default function ComponentFixture() {
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [submitted, setSubmitted] = useState(false)

  return (
    <main className="mx-auto max-w-xl p-6">
      <h1 className="mb-6 text-2xl font-bold">Design system fixture</h1>
      <Card aria-label="Profile form">
        <form onSubmit={(event) => { event.preventDefault(); setSubmitted(true) }} className="space-y-6">
          <Input label="Display name" name="displayName" hint="Shown on your profile." required />
          <Input id="email" label="Email" type="email" hint="Use your email address." error={error} aria-describedby="email-extra" />
          <p id="email-extra">Your email stays private.</p>
          <Input label="Unavailable" disabled />
          <Button onClick={() => setError('Enter a valid email.')}>Validate email</Button>
          <Button disabled>Unavailable action</Button>
          <Button type="submit">Save profile</Button>
          {submitted && <p role="status">Profile submitted</p>}
        </form>
      </Card>
      <Button className="mt-6" onClick={() => setOpen(true)}>Open example dialog</Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Learning goal" description="Choose one skill to practice.">
        <Input label="Goal" hint="For example, React." />
        <Button className="mt-4" onClick={() => setOpen(false)}>Save goal</Button>
      </Dialog>
    </main>
  )
}

createRoot(document.getElementById('root')!).render(<StrictMode><ComponentFixture /></StrictMode>)
