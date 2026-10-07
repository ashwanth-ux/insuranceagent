import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import type { Covered, Dependent, Owns } from '../engine/needs'
import type { HospitalTier } from '../engine/health'
import { valueBounds, type BikeCc, type CarCc, type VehicleAge, type VehicleKind } from '../engine/motor'
import { LAKH, clamp } from '../engine/format'
import { LIMITS } from '../engine/limits'
import type { Priority } from '../engine/shortlist'
import type { CityTier, Gender } from '../engine/types'

export type Product = 'term' | 'health' | 'motor'
export type Lump = 'yes' | 'no' | 'unsure'

export interface Profile {
  // About you
  age: number
  gender: Gender
  smoker: boolean
  dependents: Dependent[]
  income: number
  /** Homemakers and students: no income to replace, so cover is sized on the cost of replacing their work. */
  noIncome: boolean
  owns: Owns[]
  covered: Covered[]
  // Term
  spouseEarns: boolean
  kids: number
  youngestChildAge: number
  monthlySpend: number | null
  loans: number | null
  goalEducation: boolean
  goalMarriage: boolean
  /** Goals the person adds themselves: a house, their own wedding, a business. Up to five. */
  goals: UserGoal[]
  freeSavings: number
  existingTerm: number
  yearsOverride: number | null
  /** Monthly support to dependent parents. null → an estimate. */
  parentSupportMonthly: number | null
  // Health
  city: CityTier
  hospital: HospitalTier
  parents: 0 | 1 | 2
  parentAge: number
  ownCover: number
  employerCover: number
  knownCondition: boolean
  familyHistory: boolean
  babyPlanned: boolean
  savingsForBill: number
  // Motor
  vehicleKind: VehicleKind
  carCc: CarCc
  bikeCc: BikeCc
  vehicleAge: VehicleAge
  vehicleValue: number
  couldReplace: boolean
  floodProne: boolean
  highwayHeavy: boolean
  streetParking: boolean
  ncb: number
  claimSmallDents: boolean
  carriesPassengers: boolean
  hasPA15L: boolean
  /** The kind of motor policy you already hold (only used when 'ownMotor' is ticked). */
  motorPolicy: 'thirdParty' | 'comprehensive'
  // Add-on extras
  heavyCommute: boolean
  selfEmployed: boolean
  lumpSum: Lump
  // Shortlist
  priority: Priority
  // Progress
  revealed: Record<string, boolean>
  /** Fields the user has changed themselves. Anything not here is a suggestion we filled in. */
  touched: Record<string, boolean>
  /** Add-ons the user switched on or off, keyed `product.id`. Anything not here follows our suggestion. */
  addons: Record<string, boolean>
}

export interface UserGoal { label: string; todayCost: number; yearsAway: number }

export const DEFAULTS: Profile = {
  age: 30, gender: 'male', smoker: false, dependents: [], income: 12 * LAKH, noIncome: false, owns: [], covered: [],
  spouseEarns: false, kids: 1, youngestChildAge: LIMITS.childAge.default, monthlySpend: null, loans: null, goalEducation: true, goalMarriage: false, goals: [], freeSavings: 0, existingTerm: 0, yearsOverride: null, parentSupportMonthly: null,
  city: 'metro', hospital: 'standard', parents: 2, parentAge: LIMITS.parentAge.default, ownCover: 0, employerCover: 0, knownCondition: false, familyHistory: false, babyPlanned: false, savingsForBill: 5 * LAKH,
  vehicleKind: 'car', carCc: '1000to1500', bikeCc: '75to150', vehicleAge: '2to3', vehicleValue: 8 * LAKH, couldReplace: true, floodProne: false, highwayHeavy: false, streetParking: false, ncb: 0, claimSmallDents: false, carriesPassengers: false, hasPA15L: false, motorPolicy: 'comprehensive',
  heavyCommute: false, selfEmployed: false, lumpSum: 'yes',
  priority: 'certainty',
  revealed: {},
  touched: {},
  addons: {},
}

const cleanGoals = (v: unknown): UserGoal[] => {
  if (!Array.isArray(v)) return []
  const out: UserGoal[] = []
  for (const g of v.slice(0, 5)) {
    if (!g || typeof g !== 'object') continue
    const r = g as Record<string, unknown>
    const label = (typeof r.label === 'string' ? r.label : '').replace(/[^\p{L}\p{N} ,.'’&()/-]/gu, '').replace(/\s+/g, ' ').trim().slice(0, 40)
    out.push({ label: label || 'A goal', todayCost: num(r.todayCost, LIMITS.goalCost.min, LIMITS.goalCost.max, LIMITS.goalCost.default), yearsAway: Math.round(num(r.yearsAway, LIMITS.goalYears.min, LIMITS.goalYears.max, LIMITS.goalYears.default)) })
  }
  return out
}
const oneOf = <T extends string>(v: unknown, set: readonly T[], d: T): T => (typeof v === 'string' && (set as readonly string[]).includes(v) ? (v as T) : d)
const subset = <T extends string>(v: unknown, set: readonly T[]): T[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is T => typeof x === 'string' && (set as readonly string[]).includes(x)))] : [])
const num = (v: unknown, lo: number, hi: number, d: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : d)
const numOrNull = (v: unknown, lo: number, hi: number) => (typeof v === 'number' && Number.isFinite(v) ? clamp(v, lo, hi) : null)
const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

/** Every value is forced into its legal range and enum, whatever came in. */
export function sanitize(raw: Partial<Profile> | null | undefined): Profile {
  const r = (raw ?? {}) as Record<string, unknown>
  const D = DEFAULTS
  const L = LIMITS
  const ages: readonly VehicleAge[] = ['lt6m', '6m1y', '1to2', '2to3', '3to4', '4to5', '5plus']
  const kind = oneOf<VehicleKind>(r.vehicleKind, ['car', 'bike'], D.vehicleKind)
  const vAge = oneOf<VehicleAge>(r.vehicleAge, ages, D.vehicleAge)
  const vb = vehicleBounds(kind, vAge)
  const ncbRaw = num(r.ncb, 0, 50, 0)
  const ncb = [0, 20, 25, 35, 45, 50].reduce((a, s) => (s <= ncbRaw ? s : a), 0)
  const flags = (src: unknown) => {
    const out: Record<string, boolean> = {}
    if (src && typeof src === 'object') for (const [k, v] of Object.entries(src as Record<string, unknown>)) if (typeof v === 'boolean' && /^[a-z0-9._-]{1,24}$/i.test(k)) out[k] = v
    return out
  }
  // An older profile kept the vehicle-loan flag separately. It now lives with the other loans.
  const owns = subset<Owns>(r.owns, ['homeLoan', 'vehicleLoan', 'otherLoan', 'car', 'bike'])
  if (r.onLoan === true && !owns.includes('vehicleLoan')) owns.push('vehicleLoan')
  const revealed = flags(r.revealed)
  const touched = flags(r.touched)
  const addons = flags(r.addons)
  return {
    age: Math.round(num(r.age, L.age.min, L.age.max, D.age)),
    gender: oneOf<Gender>(r.gender, ['male', 'female', 'other'], D.gender),
    smoker: bool(r.smoker, D.smoker),
    dependents: subset<Dependent>(r.dependents, ['spouse', 'children', 'parents']),
    income: num(r.income, L.income.min, L.income.max, D.income),
    noIncome: bool(r.noIncome, D.noIncome),
    owns: owns,
    covered: subset<Covered>(r.covered, ['ownHealth', 'employerHealth', 'ownTerm', 'employerLife', 'savingsPlan', 'ownMotor']),
    spouseEarns: bool(r.spouseEarns, D.spouseEarns),
    kids: Math.round(num(r.kids, 1, 6, D.kids)),
    youngestChildAge: Math.round(num(r.youngestChildAge, L.childAge.min, L.childAge.max, D.youngestChildAge)),
    monthlySpend: numOrNull(r.monthlySpend, L.monthlySpend.min, L.monthlySpend.max),
    loans: numOrNull(r.loans, L.loans.min, L.loans.max),
    goalEducation: bool(r.goalEducation, D.goalEducation),
    goalMarriage: bool(r.goalMarriage, D.goalMarriage),
    goals: cleanGoals(r.goals),
    freeSavings: num(r.freeSavings, L.freeSavings.min, L.freeSavings.max, D.freeSavings),
    existingTerm: num(r.existingTerm, L.existingTerm.min, L.existingTerm.max, D.existingTerm),
    yearsOverride: numOrNull(r.yearsOverride, L.years.min, L.years.max),
    parentSupportMonthly: numOrNull(r.parentSupportMonthly, L.parentSupport.min, L.parentSupport.max),
    city: oneOf<CityTier>(r.city, ['metro', 'tier2', 'other'], D.city),
    hospital: oneOf<HospitalTier>(r.hospital, ['top', 'standard', 'local'], D.hospital),
    parents: r.parents === 0 || r.parents === 1 || r.parents === 2 ? r.parents : D.parents,
    parentAge: Math.round(num(r.parentAge, L.parentAge.min, L.parentAge.max, D.parentAge)),
    ownCover: num(r.ownCover, L.ownHealth.min, L.ownHealth.max, D.ownCover),
    employerCover: num(r.employerCover, L.employerHealth.min, L.employerHealth.max, D.employerCover),
    knownCondition: bool(r.knownCondition, D.knownCondition),
    familyHistory: bool(r.familyHistory, D.familyHistory),
    babyPlanned: bool(r.babyPlanned, D.babyPlanned),
    savingsForBill: num(r.savingsForBill, L.savingsForBill.min, L.savingsForBill.max, D.savingsForBill),
    vehicleKind: kind,
    carCc: oneOf<CarCc>(r.carCc, ['upto1000', '1000to1500', 'above1500'], D.carCc),
    bikeCc: oneOf<BikeCc>(r.bikeCc, ['upto75', '75to150', '150to350', 'above350'], D.bikeCc),
    vehicleAge: vAge,
    vehicleValue: num(r.vehicleValue, vb.min, vb.max, vb.default),
    couldReplace: bool(r.couldReplace, D.couldReplace),
    floodProne: bool(r.floodProne, D.floodProne),
    highwayHeavy: bool(r.highwayHeavy, D.highwayHeavy),
    streetParking: bool(r.streetParking, D.streetParking),
    ncb,
    claimSmallDents: bool(r.claimSmallDents, D.claimSmallDents),
    carriesPassengers: bool(r.carriesPassengers, D.carriesPassengers),
    hasPA15L: bool(r.hasPA15L, D.hasPA15L),
    motorPolicy: oneOf<Profile['motorPolicy']>(r.motorPolicy, ['thirdParty', 'comprehensive'], D.motorPolicy),
    heavyCommute: bool(r.heavyCommute, D.heavyCommute),
    selfEmployed: bool(r.selfEmployed, D.selfEmployed),
    lumpSum: oneOf<Lump>(r.lumpSum, ['yes', 'no', 'unsure'], D.lumpSum),
    priority: oneOf<Priority>(r.priority, ['certainty', 'strength', 'service'], D.priority),
    revealed,
    touched,
    addons,
  }
}

export const vehicleBounds = valueBounds

const KEY = 'kyfr-insurance-agent.v1'

function load(): Profile {
  try {
    const s = typeof localStorage !== 'undefined' ? localStorage.getItem(KEY) : null
    return sanitize(s ? JSON.parse(s) : null)
  } catch {
    return sanitize(null)
  }
}

interface Ctx {
  p: Profile
  set: (patch: Partial<Profile>) => void
  reveal: (key: string) => void
  reset: () => void
}

const ProfileCtx = createContext<Ctx | null>(null)

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [p, setP] = useState<Profile>(load)

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(p))
    } catch {
      /* storage can be unavailable (private mode); the app works without it */
    }
  }, [p])

  const set = useCallback((patch: Partial<Profile>) => setP((cur) => {
    const t = { ...cur.touched }
    for (const k of Object.keys(patch)) if (k !== 'revealed' && k !== 'touched' && k !== 'addons') t[k] = true
    return sanitize({ ...cur, ...patch, touched: t })
  }), [])
  const reveal = useCallback((key: string) => setP((cur) => (cur.revealed[key] ? cur : { ...cur, revealed: { ...cur.revealed, [key]: true } })), [])
  const reset = useCallback(() => setP(sanitize(null)), [])
  const value = useMemo(() => ({ p, set, reveal, reset }), [p, set, reveal, reset])
  return <ProfileCtx.Provider value={value}>{children}</ProfileCtx.Provider>
}

export function useProfile(): Ctx {
  const c = useContext(ProfileCtx)
  if (!c) throw new Error('useProfile outside ProfileProvider')
  return c
}
