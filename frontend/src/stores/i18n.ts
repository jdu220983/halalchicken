import { create } from 'zustand'

export type Locale = 'uz' | 'ru' | 'en'

type I18nState = {
  locale: Locale
  setLocale: (l: Locale) => void
}

export const useI18n = create<I18nState>((set) => ({
  locale: 'uz',
  setLocale: (l) => set({ locale: l }),
}))
