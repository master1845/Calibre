import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { allExercises } from '../lib/exercises.js'
import { MUSCLES, MUSCLE_NAME, matchesMuscleGroups } from '../lib/muscles.js'
import { activeProfile, exAvailable } from '../lib/equipment.js'
import { requestPlan } from '../lib/coach-api.js'
import { t } from '../lib/i18n.js'
import { Thumb } from '../components/Media.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { coachAvailable } from '../lib/coach.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import '../custom-planning.css'

const GROUPS = MUSCLES.filter(m => m !== 'serratus' && m !== 'tibialis')
const GOALS = [
  ['muscle', 'Build muscle'],
  ['strength', 'Get stronger'],
  ['fatloss', 'Lose fat'],
  ['general', 'General fitness'],
  ['endurance', 'Endurance'],
]
const EXPERIENCE = [
  ['new', 'Beginner'],
  ['returning', 'Returning'],
  ['regular', 'Experienced'],
]

export default function CustomPlanning() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const toast = useUI(s => s.toast)
  const profile = S.coach?.profile || {}
  const equipmentProfile = activeProfile(S)
  const [selected, setSelected] = useState([])
  const [goal, setGoal] = useState(profile.goal || 'muscle')
  const [experience, setExperience] = useState(profile.experience || 'regular')
  const [sessionMin, setSessionMin] = useState(profile.sessionMin || 45)
  const [daysPerWeek, setDaysPerWeek] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const library = useMemo(() => allExercises(S), [S.customEx])
  const eligible = useMemo(() => {
    const equipmentFiltered = equipmentProfile
      ? library.filter(ex => exAvailable(S, ex))
      : library
    if (!selected.length) return equipmentFiltered
    return equipmentFiltered.filter(ex => matchesMuscleGroups(ex, selected))
  }, [library, S, selected, equipmentProfile])

  const toggle = muscle => setSelected(current =>
    current.includes(muscle) ? current.filter(m => m !== muscle) : [...current, muscle]
  )

  const generate = async () => {
    if (!selected.length) {
      setError(t('Choose at least one muscle group to continue.'))
      return
    }
    setBusy(true)
    setError('')
    const focus = selected.map(m => MUSCLE_NAME[m] || m).join(', ')
    const existingNotes = String(profile.notes || '').trim()
    const focusNote = 'Custom workout focus: ' + focus + '. Build the requested session around these selected muscle groups. Prioritize exercises that directly train them, use secondary muscles only to support the session, and do not broaden the workout to unrelated muscle groups.'
    try {
      await requestPlan({
        ...profile,
        goal,
        experience,
        daysPerWeek,
        preferredDays: profile.preferredDays || [new Date().getDay()],
        sessionMin,
        equipment: (equipmentProfile?.equipment || profile.equipment || []),
        limitations: profile.limitations || '',
        likes: profile.likes || '',
        dislikes: profile.dislikes || '',
        notes: [existingNotes, focusNote].filter(Boolean).join('\n\n').slice(0, 600),
      })
      nav('/coach')
    } catch (e) {
      setError(e?.message || t('Could not generate the workout. Check your Coach setup and try again.'))
    } finally {
      setBusy(false)
    }
  }

  const canUseCoach = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })

  return <main className="custom-plan-page">
    <header className="custom-plan-header">
      <button className="custom-plan-back" onClick={() => nav('/plan')} aria-label={t('Back to plan')}>
        <Icon name="arrowLeft" />
      </button>
      <div className="custom-plan-eyebrow"><Icon name="sparkles" /> {t('AI WORKOUT BUILDER')}</div>
      <h1>{t('Train the muscles you choose.')}</h1>
      <p>{t('Pick your focus. We’ll use the exercise library you already have and let your AI Coach build the session around it.')}</p>
    </header>

    <section className="custom-plan-section">
      <div className="custom-plan-section-title">
        <div><span className="custom-plan-step">01</span><h2>{t('Choose muscle groups')}</h2></div>
        <span className="custom-plan-count">{selected.length} {t('selected')}</span>
      </div>
      <div className="custom-plan-muscles">
        {GROUPS.map(muscle => {
          const active = selected.includes(muscle)
          return <button key={muscle} type="button" className={'custom-plan-muscle' + (active ? ' is-selected' : '')}
            aria-pressed={active} onClick={() => toggle(muscle)}>
            <span className="custom-plan-muscle-mark">{active ? <Icon name="check" /> : <Icon name="plus" />}</span>
            <span>{t(MUSCLE_NAME[muscle] || muscle)}</span>
          </button>
        })}
      </div>
      <div className="custom-plan-hint"><Icon name="database" /> {selected.length
        ? t('{0} matching exercises from your existing library', eligible.length)
        : t('Your existing exercise catalogue and muscle mapping power this selection.')}</div>
    </section>

    <section className="custom-plan-section">
      <div className="custom-plan-section-title">
        <div><span className="custom-plan-step">02</span><h2>{t('Tune your session')}</h2></div>
      </div>
      <label className="custom-plan-label">{t('Main goal')}</label>
      <div className="custom-plan-options">
        {GOALS.map(([value, label]) => <button type="button" key={value}
          className={'custom-plan-option' + (goal === value ? ' is-selected' : '')}
          aria-pressed={goal === value} onClick={() => setGoal(value)}>{t(label)}</button>)}
      </div>
      <label className="custom-plan-label">{t('Experience')}</label>
      <div className="custom-plan-options">
        {EXPERIENCE.map(([value, label]) => <button type="button" key={value}
          className={'custom-plan-option' + (experience === value ? ' is-selected' : '')}
          aria-pressed={experience === value} onClick={() => setExperience(value)}>{t(label)}</button>)}
      </div>
      <div className="custom-plan-fields">
        <label><span>{t('Session length')}</span><select value={sessionMin} onChange={e => setSessionMin(Number(e.target.value))}>
          {[30, 45, 60, 75, 90].map(n => <option key={n} value={n}>{n} {t('minutes')}</option>)}
        </select></label>
        <label><span>{t('Training days per week')}</span><select value={daysPerWeek} onChange={e => setDaysPerWeek(Number(e.target.value))}>
          {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} {n === 1 ? t('day') : t('days')}</option>)}
        </select></label>
      </div>
      <p className="custom-plan-footnote">{t('Equipment is taken from your active profile. Your Coach will use your selected muscle focus when building the plan.')}</p>
    </section>

    {selected.length > 0 && <section className="custom-plan-section custom-plan-preview">
      <div className="custom-plan-section-title">
        <div><span className="custom-plan-step">03</span><h2>{t('From your exercise library')}</h2></div>
        <span className="custom-plan-count">{eligible.length}</span>
      </div>
      <p>{t('A sample of matching exercises. The Coach will choose and order the final session; nothing here needs to be added manually.')}</p>
      <div className="custom-plan-exercise-list">
        {eligible.slice(0, 5).map(ex => <div className="custom-plan-exercise" key={ex.id}>
          <Thumb ex={ex} />
          <div><strong>{ex.n}</strong><span>{t(ex.tg || ex.bp || '')} · {t(ex.eq || '')}</span></div>
        </div>)}
        {!eligible.length && <p>{t('No matching exercises are available with your current equipment. Try another muscle group or update your equipment settings.')}</p>}
      </div>
    </section>}

    {!canUseCoach && <div className="custom-plan-warning"><Icon name="info" /> {t('Set up and enable AI Coach before generating an AI workout.')}</div>}
    {error && <div className="custom-plan-error" role="alert">{error}</div>}
    <footer className="custom-plan-footer">
      <div><strong>{selected.length ? selected.map(m => t(MUSCLE_NAME[m] || m)).join(' + ') : t('Your workout, your focus')}</strong>
        <span>{selected.length ? t('{0} muscle groups selected', selected.length) : t('Select at least one muscle group to begin')}</span></div>
      <Button icon="sparkles" disabled={busy || !selected.length || !eligible.length || !canUseCoach}
        onClick={generate}>{busy ? t('Building your workout…') : t('Generate with AI Coach')}</Button>
    </footer>
  </main>
}
