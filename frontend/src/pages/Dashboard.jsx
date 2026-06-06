import { useState, useEffect } from 'react'
import StudyPlansSection from '../components/StudyPlans'
import './Dashboard.css'

export default function Dashboard({ onOpenChapter }) {
  const [chapters, setChapters] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/chapters')
      .then(r => r.json())
      .then(data => { setChapters(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="dash">
      <StudyPlansSection chapters={chapters} onOpenChapter={onOpenChapter} />
    </div>
  )
}
