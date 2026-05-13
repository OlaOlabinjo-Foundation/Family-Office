import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { setUnauthorizedHandler } from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useNotify } from '../context/NotificationContext'

/** Registers global 401 handling (must render inside BrowserRouter + Auth + Notifications). */
export function SessionGuard() {
  const navigate = useNavigate()
  const { logout, token } = useAuth()
  const { show: notify } = useNotify()
  const clearing = useRef(false)

  useEffect(() => {
    if (token) clearing.current = false
  }, [token])

  useEffect(() => {
    setUnauthorizedHandler(() => {
      if (clearing.current) return
      clearing.current = true
      logout()
      notify('Your session expired or was rejected. Please sign in again.', 'error')
      navigate('/login', { replace: true, state: { reason: 'session' } })
    })
    return () => setUnauthorizedHandler(null)
  }, [logout, navigate, notify])

  return null
}
