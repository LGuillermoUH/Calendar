import { describe, it, expect } from 'vitest'
import {
  buildMonthGrid, dateKey, todayKey,
  buildWeekGrid, shiftWeek, monthsInWeek, formatWeekRange,
} from '../lib/dates'

describe('buildMonthGrid', () => {
  it('genera semanas completas de 7 días', () => {
    const weeks = buildMonthGrid(2026, 9) // septiembre 2026
    for (const week of weeks) expect(week).toHaveLength(7)
  })

  it('incluye todos los días del mes', () => {
    const weeks = buildMonthGrid(2026, 2) // febrero 2026 (28 días)
    const days = weeks.flat().filter(Boolean).map((c) => c.day)
    expect(days).toEqual([...Array(28)].map((_, i) => i + 1))
  })

  it('coloca el día 1 en el offset correcto (semana inicia en lunes)', () => {
    // 1 de septiembre de 2026 es martes -> offset 1 (Lun vacío, Mar = día 1).
    const weeks = buildMonthGrid(2026, 9)
    const firstWeek = weeks[0]
    expect(firstWeek[0]).toBeNull()
    expect(firstWeek[1]).toMatchObject({ day: 1 })
  })

  it('dateKey produce YYYY-MM-DD con ceros', () => {
    expect(dateKey(2026, 9, 5)).toBe('2026-09-05')
  })

  it('todayKey usa la fecha local (sin desfase UTC)', () => {
    // 7 de marzo de 2026 en hora local -> "2026-03-07".
    const local = new Date(2026, 2, 7, 10, 30)
    expect(todayKey(local)).toBe('2026-03-07')
  })
})

describe('buildWeekGrid', () => {
  it('devuelve 7 días de lunes a domingo', () => {
    // 2026-09-16 es miércoles -> semana lun 14 ... dom 20.
    const cells = buildWeekGrid('2026-09-16')
    expect(cells).toHaveLength(7)
    expect(cells[0].key).toBe('2026-09-14') // lunes
    expect(cells[6].key).toBe('2026-09-20') // domingo
  })

  it('la semana puede cruzar dos meses', () => {
    // 2026-10-01 es jueves -> semana lun 28 sep ... dom 4 oct.
    const cells = buildWeekGrid('2026-10-01')
    expect(cells[0].key).toBe('2026-09-28')
    expect(cells[6].key).toBe('2026-10-04')
  })
})

describe('shiftWeek', () => {
  it('avanza y retrocede una semana', () => {
    expect(shiftWeek('2026-09-16', 1)).toBe('2026-09-23')
    expect(shiftWeek('2026-09-16', -1)).toBe('2026-09-09')
  })
})

describe('monthsInWeek', () => {
  it('devuelve un mes cuando la semana no cruza', () => {
    expect(monthsInWeek('2026-09-16')).toEqual([{ year: 2026, month: 9 }])
  })

  it('devuelve dos meses cuando la semana cruza', () => {
    expect(monthsInWeek('2026-10-01')).toEqual([
      { year: 2026, month: 9 },
      { year: 2026, month: 10 },
    ])
  })
})

describe('formatWeekRange', () => {
  it('mismo mes en un solo texto', () => {
    expect(formatWeekRange('2026-09-16')).toBe('14 – 20 de Septiembre 2026')
  })
})
