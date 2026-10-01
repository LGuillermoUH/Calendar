import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Spinner from '../components/Spinner'

describe('Spinner', () => {
  it('muestra la etiqueta cuando se proporciona', () => {
    render(<Spinner label="Guardando…" />)
    expect(screen.getByText('Guardando…')).toBeInTheDocument()
  })

  it('el indicador giratorio es decorativo (aria-hidden)', () => {
    const { container } = render(<Spinner label="Cargando" />)
    const dot = container.querySelector('.spinner')
    expect(dot).not.toBeNull()
    expect(dot).toHaveAttribute('aria-hidden', 'true')
  })
})
