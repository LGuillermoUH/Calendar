/** Valida formato de correo (simple pero suficiente para UI). */
export function isValidEmail(email) {
  const value = (email ?? '').trim()
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

/**
 * Evalúa la fortaleza de una contraseña.
 * Devuelve { score 0-4, label, valid } donde valid exige mínimo 6 caracteres.
 */
export function passwordStrength(password) {
  const pwd = password ?? ''
  let score = 0
  if (pwd.length >= 6) score++
  if (pwd.length >= 10) score++
  if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd) || /[^A-Za-z0-9]/.test(pwd)) score++

  const labels = ['Muy débil', 'Débil', 'Aceptable', 'Buena', 'Fuerte']
  return {
    score,
    label: labels[score],
    valid: pwd.length >= 6,
  }
}

/**
 * Valida el formulario de acceso. En login solo exige campos presentes;
 * en registro además valida formato de correo y longitud mínima.
 * Devuelve { email, password } con mensaje por campo ('' si es válido).
 */
export function validateAuth({ email, password, mode }) {
  const errors = { email: '', password: '' }

  if (!email || !email.trim()) {
    errors.email = 'El correo es obligatorio.'
  } else if (mode === 'register' && !isValidEmail(email)) {
    errors.email = 'Introduce un correo válido.'
  }

  if (!password) {
    errors.password = 'La contraseña es obligatoria.'
  } else if (password.length < 6) {
    errors.password = 'La contraseña debe tener al menos 6 caracteres.'
  }

  return errors
}

/** true si no hay ningún mensaje de error. */
export function isAuthValid(errors) {
  return !errors.email && !errors.password
}
