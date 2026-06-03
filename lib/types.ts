export type Profile = {
  id: string
  created_at: string
}

export type Pill = {
  id: string
  user_id: string
  name: string
  dosage: string
  slot: 'morning' | 'evening' | 'custom'
  custom_time: string | null
  active: boolean
}

export type PillLog = {
  id: string
  user_id: string
  pill_id: string
  taken_at: string
  date: string
}

export type BPReading = {
  id: string
  user_id: string
  systolic: number
  diastolic: number
  pulse: number
  note: string | null
  recorded_at: string
}
