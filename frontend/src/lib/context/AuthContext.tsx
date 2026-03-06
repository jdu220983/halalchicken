import React, { createContext, useContext, useEffect, useState, ReactNode } from "react"
import { User } from "../types"
import { Language } from "../i18n"
import { clearAuthTokens, getAccessToken, setAuthTokens } from "../token-storage"
import { useIdleTimeout } from "../hooks/useIdleTimeout"
import { SessionTimeoutDialog } from "@/components/shared/SessionTimeoutDialog"

interface AuthContextType {
  user: User | null
  isLoading: boolean
  language: Language
  login: (username: string, password: string) => Promise<void>
  signup: (data: SignupData) => Promise<void>
  logout: () => void
  setLanguage: (lang: Language) => void
  updateUser: (user: User) => void
}

interface SignupData {
  username: string
  email?: string
  password: string
  fio: string
  phone: string
  user_type: "INDIVIDUAL" | "LEGAL"
  address?: string
  company_name?: string
  inn?: string
  bank_details?: string
  legal_address?: string
  responsible_person?: string
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [language, setLanguageState] = useState<Language>("uz")
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false)

  useEffect(() => {
    // Load user and language from localStorage on mount
    const storedUser = localStorage.getItem("user")
    const storedLang = localStorage.getItem("language") as Language | null

    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser))
      } catch (e) {
        console.error("Failed to parse stored user:", e)
      }
    }

    if (storedLang) {
      setLanguageState(storedLang)
    }

    const bootstrap = async () => {
      const token = getAccessToken()
      if (!token || storedUser) {
        setIsLoading(false)
        return
      }
      try {
        const response = await fetch(`${import.meta.env.VITE_API_ORIGIN || ""}/api/auth/me/`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        if (response.ok) {
          const userData = await response.json()
          setUser(userData)
          localStorage.setItem("user", JSON.stringify(userData))
        }
      } catch (error) {
        console.error("Failed to refresh user profile:", error)
      } finally {
        setIsLoading(false)
      }
    }

    bootstrap()
  }, [])

  const login = async (username: string, password: string) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_ORIGIN || ""}/api/auth/login/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      })

      if (!response.ok) {
        throw new Error("Login failed")
      }

      const data = await response.json()
      setAuthTokens(data.access, data.refresh)

      // Fetch user profile
      const profileResponse = await fetch(`${import.meta.env.VITE_API_ORIGIN || ""}/api/auth/me/`, {
        headers: {
          Authorization: `Bearer ${data.access}`,
        },
      })

      if (profileResponse.ok) {
        const userData = await profileResponse.json()
        setUser(userData)
        localStorage.setItem("user", JSON.stringify(userData))
      }
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const parseErrorMessage = async (response: Response) => {
    try {
      const payload = await response.json()
      if (!payload) return "Signup failed"
      if (typeof payload === "string") return payload
      if (Array.isArray(payload)) return payload.join(" ")
      if (payload.detail) return payload.detail
      const parts = Object.entries(payload).map(([key, value]) => {
        if (Array.isArray(value)) {
          return `${key}: ${value.join(", ")}`
        }
        if (typeof value === "string") {
          return `${key}: ${value}`
        }
        return `${key}: ${JSON.stringify(value)}`
      })
      return parts.join(" ") || "Signup failed"
    } catch (error) {
      console.error("Failed to parse signup error", error)
      return "Signup failed"
    }
  }

  const signup = async (data: SignupData) => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_ORIGIN || ""}/api/auth/register/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error(await parseErrorMessage(response))
      }

      // Auto login after signup
      await login(data.username, data.password)
    } catch (error) {
      console.error("Signup error:", error)
      throw error
    }
  }

  const logout = () => {
    setUser(null)
    localStorage.removeItem("user")
    clearAuthTokens()
    setShowTimeoutWarning(false)
  }

  // Session timeout hook - only active when user is logged in
  const { stayActive } = useIdleTimeout({
    timeout: 30 * 60 * 1000, // 30 minutes
    warningTime: 2 * 60 * 1000, // 2 minutes warning
    onIdle: () => {
      if (user) {
        logout()
      }
    },
    onWarning: () => {
      if (user) {
        setShowTimeoutWarning(true)
      }
    },
  })

  const handleStayLoggedIn = () => {
    setShowTimeoutWarning(false)
    stayActive()
  }

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem("language", lang)
  }

  const updateUser = (updatedUser: User) => {
    setUser(updatedUser)
    localStorage.setItem("user", JSON.stringify(updatedUser))
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        language,
        login,
        signup,
        logout,
        setLanguage,
        updateUser,
      }}
    >
      {children}
      {user && (
        <SessionTimeoutDialog
          open={showTimeoutWarning}
          onStayLoggedIn={handleStayLoggedIn}
          remainingSeconds={120} // 2 minutes
          language={language}
        />
      )}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }
  return context
}
