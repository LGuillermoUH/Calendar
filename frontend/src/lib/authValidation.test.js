import { describe, it, expect } from 'vitest'
import { isValidEmail, passwordStrength, validateAuth, isAuthValid } from '../lib/authValidation'

describe('isValidEmail', () => {
  it('acepta un correo bien formado', () => {
    expect(isValidEmail('user@example.com')).toBe(true)
  })
  it('rechaza formatos inválidos', () => {
    expect(isValidEmail('user@')).toBe(false)
    expect(isValidEmail('user example.com')).toBe(false)
    expect(isValidEmail('')).toBe(false)
  })
})

describe('passwordStrength', () => {
  it('marca inválida una contraseña de menos de 6 caracteres', () => {
    expect(passwordStrength('abc').valid).toBe(false)
  })
  it('sube el score con longitud y variedad', () => {
    expect(passwordStrength('abcdef').valid).toBe(true)
    expect(passwordStrength('Abcdef1!').score).toBeGreaterThanOrEqual(3)
  })
})

describe('validateAuth', () => {
  it('en registro exige correo válido', () => {
    const e = validateAuth({ email: 'malo@', password: 'abcdef', mode: 'register' })
    expect(e.email).not.toBe('')
    expect(e.password).toBe('')
  })
  it('en login solo exige presencia', () => {
    const e = validateAuth({ email: 'x@y.z', password: '123456', mode: 'login' })
    expect(isAuthValid(e)).toBe(true)
  })
  it('marca contraseña corta', () => {
    const e = validateAuth({ email: 'x@y.z', password: '123', mode: 'login' })
    expect(e.password).not.toBe('')
    expect(isAuthValid(e)).toBe(false)
  })
})
