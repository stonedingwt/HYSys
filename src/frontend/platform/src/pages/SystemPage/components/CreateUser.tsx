import { Button } from "@/components/mep-ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/mep-ui/dialog"
import { Input, PasswordInput } from "@/components/mep-ui/input"
import { Label } from "@/components/mep-ui/label"
import { useToast } from "@/components/mep-ui/toast/use-toast"
import { createUserApi } from "@/controllers/API/user"
import { captureAndAlertRequestErrorHoc } from "@/controllers/request"
import { handleEncrypt, PWD_RULE } from "@/pages/LoginPage/utils"
import { copyText } from "@/utils"
import { useState } from "react"
import { useTranslation } from "react-i18next"
import UserRoleItem from "./UserRoleItem"

export default function CreateUser({ open, onClose, onSave }) {
    const { t } = useTranslation()
    const { message } = useToast()

    const initUser = {
        user_name: '',
        password: '',
    }

    const [selectedRoles, setSelectedRoles] = useState<string[]>([])
    const [form, setForm] = useState(initUser)

    const handleCancel = () => {
        onClose(false)
        setSelectedRoles([])
        setForm(initUser)
    }

    const handleConfirm = async () => {
        const errors: string[] = []
        if (form.user_name === '') errors.push(t('system.usernameRequired'))
        if (form.user_name.length > 30) errors.push(t('system.usernameMaxLength'))
        if (!PWD_RULE.test(form.password)) errors.push(t('system.passwordRequirements'))
        if (selectedRoles.length === 0) errors.push(t('system.roleRequired'))
        if (errors.length > 0) return message({ title: t('prompt'), description: errors, variant: 'warning' })

        const encryptPwd = await handleEncrypt(form.password)
        const group_roles = [{
            group_id: 1,
            role_ids: selectedRoles.map(r => Number(r))
        }]
        captureAndAlertRequestErrorHoc(createUserApi(form.user_name, encryptPwd, group_roles).then(() => {
            copyText(`${t('system.username')}: ${form.user_name}，${t('system.initialPassword')}: ${form.password}`).then(() =>
                message({ title: t('prompt'), description: t('system.userCreationSuccess'), variant: 'success' }))
            onClose(false)
            setSelectedRoles([])
            setForm(initUser)
            onSave()
        }))
    }

    return <Dialog open={open} onOpenChange={b => onClose(b)}>
        <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
                <DialogTitle>{t('system.createUser')}</DialogTitle>
            </DialogHeader>
            <div className="flex flex-col gap-4 mb-4">
                <div>
                    <Label htmlFor="user" className="mep-label">{t('system.username')}</Label>
                    <Input id="user" value={form.user_name} onChange={(e) => setForm({ ...form, user_name: e.target.value })}
                        placeholder={t('system.usernamePlaceholder')} className="h-[48px]" />
                </div>
                <div>
                    <Label htmlFor="password" className="mep-label">{t('system.initialPassword')}</Label>
                    <PasswordInput id="password" value={form.password} placeholder={t('system.passwordPlaceholder')}
                        onChange={(e) => setForm({ ...form, password: e.target.value })} inputClassName="h-[48px]" />
                </div>
                <div className="flex flex-col gap-2">
                    <Label className="mep-label">{t('system.roleSelect')}</Label>
                    <UserRoleItem
                        selectedRoles={selectedRoles}
                        onChange={(roles) => setSelectedRoles(roles)}
                    />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" className="h-10 w-[120px] px-16" onClick={handleCancel}>{t('cancel')}</Button>
                <Button className="px-16 h-10 w-[120px]" onClick={handleConfirm}>{t('confirm')}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}
