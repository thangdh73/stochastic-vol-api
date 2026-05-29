const TOKEN_KEY = 'mmra_access_token'
const EMAIL_KEY = 'mmra_user_email'

export function getAccessToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

export function getStoredEmail(): string | null {
  try {
    return sessionStorage.getItem(EMAIL_KEY)
  } catch {
    return null
  }
}

export function setAuthSession(token: string, email: string): void {
  sessionStorage.setItem(TOKEN_KEY, token)
  sessionStorage.setItem(EMAIL_KEY, email)
}

export function clearAuthSession(): void {
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem(EMAIL_KEY)
}
