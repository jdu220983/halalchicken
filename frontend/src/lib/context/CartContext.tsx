import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react"
import { Cart, Product } from "../types"
import { useAuth } from "./AuthContext"

const API_ORIGIN = import.meta.env.VITE_API_ORIGIN || ""
const MIN_QUANTITY = 0.1

const normalizeQuantity = (value: number) => {
  const numeric = Number.isFinite(value) ? value : MIN_QUANTITY
  return Number(Math.max(MIN_QUANTITY, numeric).toFixed(2))
}

const getOrCreateSessionId = () => {
  let sessionId = localStorage.getItem("session_id")
  if (!sessionId) {
    sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    localStorage.setItem("session_id", sessionId)
  }
  return sessionId
}

const buildHeaders = (token: string | null, sessionId: string | null): HeadersInit => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  }
  if (token) {
    headers["Authorization"] = `Bearer ${token}`
  } else if (sessionId) {
    headers["X-Session-ID"] = sessionId
  }
  return headers
}

interface CartContextType {
  cart: Cart | null
  itemCount: number
  totalAmount: number
  isLoading: boolean
  addToCart: (product: Product, quantity: number) => Promise<void>
  updateQuantity: (productId: number, quantity: number) => Promise<void>
  removeFromCart: (productId: number) => Promise<void>
  clearCart: () => void
  fetchCart: () => Promise<void>
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: ReactNode }) {
  const [cart, setCart] = useState<Cart | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const { user } = useAuth()

  const fetchCart = useCallback(async () => {
    // Don't fetch cart for admins
    if (user && user.role !== "CUSTOMER") {
      return
    }

    try {
      setIsLoading(true)
      const token = localStorage.getItem("access_token")
      const sessionId = token ? null : getOrCreateSessionId()

      const response = await fetch(`${API_ORIGIN}/api/cart/`, {
        headers: buildHeaders(token, sessionId),
      })

      if (response.ok) {
        const data = await response.json()
        setCart(data)
      }
    } catch (error) {
      console.error("Failed to fetch cart:", error)
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    // Only fetch cart for customers or anonymous users, not for admins
    if (!user || user.role === "CUSTOMER") {
      fetchCart()
    } else {
      // Clear cart for admins
      setCart(null)
    }
  }, [user, fetchCart])

  const addToCart = async (product: Product, quantity: number) => {
    // Block cart functionality for admins
    if (user && user.role !== "CUSTOMER") {
      console.warn("Cart functionality is not available for admin users")
      return
    }

    try {
      const token = localStorage.getItem("access_token")
      const sessionId = token ? null : getOrCreateSessionId()

      const response = await fetch(`${API_ORIGIN}/api/cart/items/`, {
        method: "POST",
        headers: buildHeaders(token, sessionId),
        body: JSON.stringify({
          product_id: product.id,
          quantity: normalizeQuantity(quantity),
        }),
      })

      if (response.ok) {
        await fetchCart()
      }
    } catch (error) {
      console.error("Failed to add to cart:", error)
      throw error
    }
  }

  const updateQuantity = async (productId: number, quantity: number) => {
    // Block cart functionality for admins
    if (user && user.role !== "CUSTOMER") {
      return
    }

    // Optimistic update - update UI immediately
    if (cart) {
      const updatedItems = cart.items.map(item => 
        item.product.id === productId 
          ? { ...item, quantity: normalizeQuantity(quantity) }
          : item
      )
      setCart({ ...cart, items: updatedItems })
    }

    try {
      const token = localStorage.getItem("access_token")
      const sessionId = token ? null : getOrCreateSessionId()

      const response = await fetch(`${API_ORIGIN}/api/cart/items/`, {
        method: "POST",
        headers: buildHeaders(token, sessionId),
        body: JSON.stringify({ product_id: productId, quantity: normalizeQuantity(quantity) }),
      })

      if (!response.ok) {
        // Revert on failure
        await fetchCart()
      }
    } catch (error) {
      console.error("Failed to update quantity:", error)
      // Revert on error
      await fetchCart()
      throw error
    }
  }

  const removeFromCart = async (productId: number) => {
    // Block cart functionality for admins
    if (user && user.role !== "CUSTOMER") {
      return
    }

    try {
      const token = localStorage.getItem("access_token")
      const sessionId = token ? null : getOrCreateSessionId()

      const response = await fetch(`${API_ORIGIN}/api/cart/items/${productId}/`, {
        method: "DELETE",
        headers: buildHeaders(token, sessionId),
      })

      if (response.ok) {
        await fetchCart()
      }
    } catch (error) {
      console.error("Failed to remove from cart:", error)
      throw error
    }
  }

  const clearCart = () => {
    setCart(null)
    localStorage.removeItem("session_id")
  }

  const itemCount = cart
    ? Number(
        cart.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0).toFixed(2)
      )
    : 0
  const totalAmount = 0 // Will be calculated from items when needed

  return (
    <CartContext.Provider
      value={{
        cart,
        itemCount,
        totalAmount,
        isLoading,
        addToCart,
        updateQuantity,
        removeFromCart,
        clearCart,
        fetchCart,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) {
    throw new Error("useCart must be used within CartProvider")
  }
  return context
}
