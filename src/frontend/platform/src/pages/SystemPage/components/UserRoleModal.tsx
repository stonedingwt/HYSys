import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/mep-ui/dialog"
import { useToast } from "@/components/mep-ui/toast/use-toast"
import { updateUserRoles } from "@/controllers/API/user"
import { captureAndAlertRequestErrorHoc } from "@/controllers/request"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "../../../components/mep-ui/button"
import UserRoleItem from "./UserRoleItem"

export default function UserRoleModal({ user, onClose, onChange }) {
    const { t } = useTranslation()
    const { message } = useToast()

    const [selectedRoles, setSelectedRoles] = useState<string[]>([])

    useEffect(() => {
        if (user) {
            const { roles } = user
            setSelectedRoles(
                (roles || []).map(r => r.id.toString())
            )
        }
    }, [user])

    const handleSave = async () => {
        if (selectedRoles.length === 0) {
            return message({ title: t('prompt'), variant: 'warning', description: t('system.selectRole') })
        }
        captureAndAlertRequestErrorHoc(
            updateUserRoles(user.user_id, selectedRoles).then(() => {
                onChange()
            })
        )
    }

    return <Dialog open={!!user} onOpenChange={(b) => { if (!b) { setSelectedRoles([]); onClose(b); } }}>
        <DialogContent className="sm:max-w-[625px]">
            <DialogHeader>
                <DialogTitle>{t('system.roleSelect')}</DialogTitle>
            </DialogHeader>
            <div className="py-1">
                <UserRoleItem
                    selectedRoles={selectedRoles}
                    onChange={(roles) => setSelectedRoles(roles)}
                />
            </div>
            <DialogFooter>
                <Button variant="outline" className="h-10 w-[120px] px-16" onClick={() => onClose(false)}>{t('cancel')}</Button>
                <Button className="px-16 h-10 w-[120px]" onClick={handleSave}>{t('save')}</Button>
            </DialogFooter>
        </DialogContent>
    </Dialog>
}
