import { describe, it, expect } from 'vitest'
import { validateForm } from '../components/EventForm'

describe('validateForm', () => {
  it('rechaza cuando falta la persona', () => {
    const errors = validateForm({ personName: '  ', amountPaid: '10' })
    expect(errors.some((e) => e.includes('persona'))).toBe(true)
  })

  it('rechaza monto negativo', () => {
    const errors = validateForm({ personName: 'Ana', amountPaid: '-5' })
    expect(errors.some((e) => e.includes('negativo'))).toBe(true)
  })

  it('acepta un formulario válido', () => {
    const errors = validateForm({ personName: 'Ana', amountPaid: '1500' })
    expect(errors).toHaveLength(0)
  })

  it('acepta monto vacío (se trata como 0)', () => {
    const errors = validateForm({ personName: 'Ana', amountPaid: '' })
    expect(errors).toHaveLength(0)
  })
})
