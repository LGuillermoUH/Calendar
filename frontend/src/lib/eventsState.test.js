import { describe, it, expect } from 'vitest'
import { replaceMonth, normalizeInitial } from './eventsState'

describe('replaceMonth', () => {
  it('elimina el día cuyo último evento se borró (regresión del bug de refresco)', () => {
    // Con el antiguo mergeMap (solo aditivo) esta clave sobrevivía: el bug.
    const prev = new Map([['2026-09-15', [{ id: 'a' }]]])
    const next = new Map()
    const result = replaceMonth(prev, next, 2026, 9)
    expect(result.has('2026-09-15')).toBe(false)
    expect(result.size).toBe(0)
  })

  it('preserva las claves de otros meses al recargar septiembre', () => {
    const prev = new Map([
      ['2026-08-10', [{ id: 'ago' }]],
      ['2026-09-15', [{ id: 'sep' }]],
    ])
    const result = replaceMonth(prev, new Map(), 2026, 9)
    expect(result.has('2026-08-10')).toBe(true)
    expect(result.has('2026-09-15')).toBe(false)
  })

  it('casa el prefijo del mes con relleno a 2 dígitos (mes de un dígito)', () => {
    const prev = new Map([['2026-09-15', [{ id: 'a' }]]])
    // month=9 debe generar el prefijo "2026-09-", no "2026-9-".
    const result = replaceMonth(prev, new Map(), 2026, 9)
    expect(result.has('2026-09-15')).toBe(false)
  })

  it('sobrescribe los días del mismo mes con los datos nuevos', () => {
    const prev = new Map([['2026-09-15', [{ id: 'viejo' }]]])
    const next = new Map([['2026-09-15', [{ id: 'nuevo' }]]])
    const result = replaceMonth(prev, next, 2026, 9)
    expect(result.get('2026-09-15')).toEqual([{ id: 'nuevo' }])
  })
})

describe('normalizeInitial', () => {
  it('convierte los campos opcionales nulos a cadena vacía', () => {
    const result = normalizeInitial({
      personName: 'Ana',
      contactPhone: null,
      contactEmail: null,
      title: null,
      notes: null,
      amountPaid: 500,
      isReserved: true,
    })
    expect(result).toEqual({
      isReserved: true,
      personName: 'Ana',
      contactPhone: '',
      contactEmail: '',
      amountPaid: 500,
      title: '',
      notes: '',
    })
  })

  it('devuelve el formulario vacío en alta (initial indefinido)', () => {
    expect(normalizeInitial(undefined)).toEqual({
      isReserved: false,
      personName: '',
      contactPhone: '',
      contactEmail: '',
      amountPaid: '',
      title: '',
      notes: '',
    })
  })
})
