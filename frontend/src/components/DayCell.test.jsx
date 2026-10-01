import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import DayCell from '../components/DayCell'

describe('DayCell (vista pública)', () => {
  it('muestra "Apartado" en un día reservado', () => {
    render(<DayCell day={10} reserved={true} onClick={() => {}} />)
    expect(screen.getByText('Apartado')).toBeInTheDocument()
  })

  it('no muestra ningún dato de cliente ni botón de edición', () => {
    render(<DayCell day={10} reserved={true} onClick={() => {}} />)
    // No hay textos sensibles.
    expect(screen.queryByText(/persona|teléfono|correo|pago/i)).toBeNull()
    // No hay controles de editar/eliminar dentro de la celda pública.
    expect(screen.queryByText(/editar|eliminar/i)).toBeNull()
  })

  it('un día libre no muestra la etiqueta Apartado', () => {
    render(<DayCell day={11} reserved={false} onClick={() => {}} />)
    expect(screen.queryByText('Apartado')).toBeNull()
  })

  it('invoca onClick al pulsar', () => {
    const onClick = vi.fn()
    render(<DayCell day={12} reserved={false} onClick={onClick} />)
    screen.getByRole('button').click()
    expect(onClick).toHaveBeenCalled()
  })

  it('marca el día de hoy con aria-current="date"', () => {
    render(<DayCell day={15} reserved={false} isToday onClick={() => {}} />)
    const btn = screen.getByRole('button')
    expect(btn).toHaveAttribute('aria-current', 'date')
    expect(btn.className).toContain('day-cell--today')
    expect(btn).toHaveAttribute('aria-label', expect.stringContaining('(hoy)'))
  })

  it('un día que no es hoy no lleva aria-current', () => {
    render(<DayCell day={16} reserved={false} onClick={() => {}} />)
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-current')
  })
})
