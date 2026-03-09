import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '@/lib/context'
import { useToast } from '@/lib/toast'
import { t } from '@/lib/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User as UserIcon, AlertTriangle, Trash2 } from 'lucide-react'
import { updateMe, changePassword, deleteAccount } from '@/lib/api'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

export function Profile() {
  const { language, user, updateUser, logout, isLoading } = useAuth()
  const { push: toast } = useToast()
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fio: '',
    phone: '',
    address: '',
  })
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [passwordLoading, setPasswordLoading] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  const [passwordMessage, setPasswordMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null)
  
  // Account deletion state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    if (isLoading) {
      return
    }
    if (!user) {
      navigate('/login')
      return
    }
    setFormData({
      fio: user.fio,
      phone: user.phone,
      address: user.address,
    })
  }, [user, isLoading, navigate])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setLoading(true)
    setMessage(null)

    try {
      const updatedUser = await updateMe(formData)
      updateUser(updatedUser)
      const successMsg = t('success', language) || 'Profile updated successfully'
      setMessage({ type: 'success', text: successMsg })
      toast({ message: successMsg, type: 'success' })
    } catch (error) {
      console.error('Failed to update profile:', error)
      const errorMsg = t('error', language) || 'Failed to update profile'
      setMessage({ type: 'error', text: errorMsg })
      toast({ message: errorMsg, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user) return

    setPasswordLoading(true)
    setPasswordMessage(null)

    // Validate passwords match
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      const errorMsg = t('passwordsDoNotMatch', language) || 'New passwords do not match'
      setPasswordMessage({ type: 'error', text: errorMsg })
      toast({ message: errorMsg, type: 'error' })
      setPasswordLoading(false)
      return
    }

    // Validate password length
    if (passwordData.newPassword.length < 8) {
      const errorMsg = t('passwordTooShort', language) || 'Password must be at least 8 characters long'
      setPasswordMessage({ type: 'error', text: errorMsg })
      toast({ message: errorMsg, type: 'error' })
      setPasswordLoading(false)
      return
    }

    try {
      await changePassword(passwordData.currentPassword, passwordData.newPassword)
      const successMsg = t('passwordChangedSuccess', language) || 'Password changed successfully'
      setPasswordMessage({ type: 'success', text: successMsg })
      toast({ message: successMsg, type: 'success' })
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' })
    } catch (error: any) {
      console.error('Failed to change password:', error)
      const errorMsg = error.response?.data?.detail || t('errorChangingPassword', language) || 'Failed to change password'
      const errorText = Array.isArray(errorMsg) ? errorMsg.join(', ') : errorMsg
      setPasswordMessage({ type: 'error', text: errorText })
      toast({ message: errorText, type: 'error' })
    } finally {
      setPasswordLoading(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (!deletePassword) {
      const errorMsg = language === 'uz' ? 'Parol talab qilinadi' : 'Требуется пароль'
      setDeleteError(errorMsg)
      toast({ message: errorMsg, type: 'error' })
      return
    }

    setDeleteLoading(true)
    setDeleteError('')

    try {
      await deleteAccount(deletePassword)
      const successMsg = t('accountDeleted', language) || 'Account deleted successfully'
      toast({ message: successMsg, type: 'success' })
      // Account deleted successfully - logout
      logout()
      navigate('/login')
    } catch (error: any) {
      console.error('Failed to delete account:', error)
      const errorMsg = error.response?.data?.detail || (language === 'uz' ? 'Hisobni oʻchirib boʻlmadi' : 'Не удалось удалить аккаунт')
      setDeleteError(errorMsg)
      toast({ message: errorMsg, type: 'error' })
    } finally {
      setDeleteLoading(false)
    }
  }

  if (isLoading) return null
  if (!user) return null

  return (
    <div className="container py-8 max-w-2xl">
      <div className="flex items-center gap-4 mb-8">
        <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
          <UserIcon className="h-8 w-8 text-primary" />
        </div>
        <div>
          <h1 className="text-3xl font-bold">{t('profile', language)}</h1>
          <p className="text-muted-foreground">{user.email}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* User Type Badge */}
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${user.user_type === 'LEGAL' ? 'bg-blue-100 text-blue-800' : 'bg-gray-100 text-gray-800'}`}>
            {user.user_type === 'LEGAL' ? 'Legal Entity' : 'Individual'}
          </span>
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${user.role === 'SUPERADMIN' ? 'bg-purple-100 text-purple-800' : user.role === 'ADMIN' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
            {user.role}
          </span>
        </div>

        {/* Personal Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('personalInfo', language)}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {message && (
                <div
                  className={`p-3 rounded-md text-sm ${message.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                >
                  {message.text}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="fio">{t('name', language)}</Label>
                <Input
                  id="fio"
                  value={formData.fio}
                  onChange={(e) => setFormData({ ...formData, fio: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">{t('phone', language)}</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="address">{t('address', language)}</Label>
                <Input
                  id="address"
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? t('loading', language) : t('save', language)}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Legal Entity Information */}
        {user.user_type === 'LEGAL' && (
          <Card>
            <CardHeader>
              <CardTitle>Legal Entity Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Company Name</Label>
                  <p className="text-sm">{user.company_name || 'Not provided'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">TIN (Tax ID)</Label>
                  <p className="text-sm font-mono">{user.inn || 'Not provided'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Bank Details</Label>
                  <p className="text-sm font-mono">{user.bank_details || 'Not provided'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Legal Address</Label>
                  <p className="text-sm">{user.legal_address || 'Not provided'}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium text-muted-foreground">Responsible Person</Label>
                  <p className="text-sm">{user.responsible_person || 'Not provided'}</p>
                </div>
              </div>
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground">
                  To update legal entity information, please contact support.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle>Change Password</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              {passwordMessage && (
                <div
                  className={`p-3 rounded-md text-sm ${passwordMessage.type === 'success'
                    ? 'bg-green-50 text-green-800 border border-green-200'
                    : 'bg-red-50 text-red-800 border border-red-200'
                    }`}
                >
                  {passwordMessage.text}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <Input
                  id="currentPassword"
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <Input
                  id="newPassword"
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                  required
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">At least 8 characters</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={passwordLoading}>
                {passwordLoading ? t('loading', language) : 'Change Password'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Legal Entity Information - Only for LEGAL user type */}
        {user.user_type === 'LEGAL' && (
          <Card>
            <CardHeader>
              <CardTitle>Legal Entity Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {user.company_name && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('companyName', language)}:</span>
                  <span className="font-medium">{user.company_name}</span>
                </div>
              )}
              {user.inn && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('inn', language)}:</span>
                  <span className="font-medium">{user.inn}</span>
                </div>
              )}
              {user.legal_address && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('legalAddress', language)}:</span>
                  <span className="font-medium">{user.legal_address}</span>
                </div>
              )}
              {user.responsible_person && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('responsiblePerson', language)}:</span>
                  <span className="font-medium">{user.responsible_person}</span>
                </div>
              )}
              {user.bank_details && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">{t('bankDetails', language)}:</span>
                  <span className="font-medium">{user.bank_details}</span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Account Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('accountInfo', language)}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Username:</span>
              <span className="font-medium">{user.username}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Email:</span>
              <span className="font-medium">{user.email}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('userType', language)}:</span>
              <span className="font-medium">{t(user.user_type, language)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{t('role', language)}:</span>
              <span className="font-medium">{user.role}</span>
            </div>
          </CardContent>
        </Card>

        {/* Account Deletion - Only for customers */}
        {user.role === 'CUSTOMER' && (
          <Card className="border-red-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-red-600">
                <AlertTriangle className="w-5 h-5" />
                {language === 'uz' ? 'Xavfli zona' : 'Опасная зона'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {language === 'uz'
                  ? 'Hisobingizni oʻchirib tashlasangiz, barcha maʼlumotlaringiz butunlay oʻchiriladi. Bu harakat qaytarilmaydi.'
                  : 'Если вы удалите свой аккаунт, все ваши данные будут удалены безвозвратно. Это действие необратимо.'}
              </p>
              <Button
                variant="destructive"
                onClick={() => setShowDeleteDialog(true)}
                className="w-full"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                {language === 'uz' ? 'Hisobni oʻchirish' : 'Удалить аккаунт'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Delete Account Confirmation Dialog */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {language === 'uz' ? 'Ishonchingiz komilmi?' : 'Вы уверены?'}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              <p>
                {language === 'uz'
                  ? 'Bu harakat qaytarilmaydi. Bu sizning hisobingizni butunlay oʻchirib tashlaydi va barcha maʼlumotlaringizni oʻchirib yuboradi.'
                  : 'Это действие необратимо. Это полностью удалит вашу учетную запись и сотрет все ваши данные.'}
              </p>
              <div className="space-y-2">
                <Label htmlFor="delete-password">
                  {language === 'uz' ? 'Tasdiqlash uchun parolingizni kiriting' : 'Введите пароль для подтверждения'}
                </Label>
                <Input
                  id="delete-password"
                  type="password"
                  value={deletePassword}
                  onChange={(e) => {
                    setDeletePassword(e.target.value)
                    setDeleteError('')
                  }}
                  placeholder={language === 'uz' ? 'Parol' : 'Пароль'}
                  disabled={deleteLoading}
                />
                {deleteError && (
                  <p className="text-sm text-red-600">{deleteError}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteLoading}>
              {language === 'uz' ? 'Bekor qilish' : 'Отмена'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAccount}
              disabled={deleteLoading || !deletePassword}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleteLoading
                ? (language === 'uz' ? 'Oʻchirilmoqda...' : 'Удаление...')
                : (language === 'uz' ? 'Hisobni oʻchirish' : 'Удалить аккаунт')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
