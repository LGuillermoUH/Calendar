import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  setWhatsAppConfig,
  getWhatsAppPhone,
  formatDateLong,
  buildWhatsAppMessage,
  buildWhatsAppUrl,
} from './whatsapp'

afterEach(() => {
  vi.unstubAllEnvs()
  setWhatsAppConfig(null) // limpia la config de runtime entre pruebas
})

describe('whatsapp helper — config de runtime (backend)', () => {
  it('getWhatsAppPhone normaliza a solo dígitos desde la config de runtime', () => {
    setWhatsAppConfig({ whatsappPhone: '+52 (123) 456-7890', whatsappMessage: '' })
    expect(getWhatsAppPhone()).toBe('521234567890')
  })

  it('la config de runtime tiene prioridad sobre import.meta.env', () => {
    vi.stubEnv('VITE_WHATSAPP_PHONE', '999999')
    setWhatsAppConfig({ whatsappPhone: '521234567890', whatsappMessage: 'Hola {fecha}' })
    expect(getWhatsAppPhone()).toBe('521234567890')
  })

  it('buildWhatsAppMessage sustituye {fecha} con la plantilla de runtime', () => {
    setWhatsAppConfig({ whatsappPhone: '521234567890', whatsappMessage: 'Reservar el {fecha}, gracias' })
    expect(buildWhatsAppMessage('2026-10-05')).toBe('Reservar el 5 de Octubre de 2026, gracias')
  })

  it('buildWhatsAppUrl arma wa.me con mensaje codificado', () => {
    setWhatsAppConfig({ whatsappPhone: '521234567890', whatsappMessage: 'Hola {fecha}' })
    const url = buildWhatsAppUrl('2026-10-05')
    expect(url).toBe('https://wa.me/521234567890?text=' + encodeURIComponent('Hola 5 de Octubre de 2026'))
  })

  it('buildWhatsAppUrl devuelve "" sin teléfono configurado', () => {
    setWhatsAppConfig({ whatsappPhone: '', whatsappMessage: '' })
    expect(buildWhatsAppUrl('2026-10-05')).toBe('')
  })
})

describe('whatsapp helper — fallback a import.meta.env (dev)', () => {
  it('usa VITE_WHATSAPP_PHONE cuando no hay config de runtime', () => {
    vi.stubEnv('VITE_WHATSAPP_PHONE', '521234567890')
    expect(getWhatsAppPhone()).toBe('521234567890')
  })

  it('mensaje por defecto en español cuando no hay plantilla', () => {
    vi.stubEnv('VITE_WHATSAPP_MESSAGE', '')
    const msg = buildWhatsAppMessage('2026-10-05')
    expect(msg).toContain('5 de Octubre de 2026')
    expect(msg).not.toContain('{fecha}')
  })
})

describe('whatsapp helper — utilidades', () => {
  it('formatDateLong produce fecha legible en español', () => {
    expect(formatDateLong('2026-10-05')).toBe('5 de Octubre de 2026')
  })
})
