import { useEffect, useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

interface SessionTimeoutDialogProps {
  open: boolean
  onStayLoggedIn: () => void
  remainingSeconds: number
  language: 'uz' | 'ru'
}

export function SessionTimeoutDialog({
  open,
  onStayLoggedIn,
  remainingSeconds,
  language,
}: SessionTimeoutDialogProps) {
  const [seconds, setSeconds] = useState(remainingSeconds)

  useEffect(() => {
    if (open) {
      setSeconds(remainingSeconds)
      const interval = setInterval(() => {
        setSeconds((prev) => Math.max(0, prev - 1))
      }, 1000)
      return () => clearInterval(interval)
    }
  }, [open, remainingSeconds])

  const formatTime = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60)
    const secs = totalSeconds % 60
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            {language === 'uz' ? 'Sessiya tugaydi' : 'Сеанс истекает'}
          </AlertDialogTitle>
          <AlertDialogDescription>
            {language === 'uz'
              ? `Siz ${formatTime(seconds)} ichida avtomatik tarzda tizimdan chiqarilasiz. Tizimda qolish uchun pastdagi tugmani bosing.`
              : `Вы будете автоматически выведены из системы через ${formatTime(seconds)}. Нажмите кнопку ниже, чтобы остаться в системе.`}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={onStayLoggedIn}>
            {language === 'uz' ? 'Tizimda qolish' : 'Остаться в системе'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
