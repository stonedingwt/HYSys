import { DelIcon } from "@/components/mep-icons";
import { Button } from "@/components/mep-ui/button";
import MultiSelect from "@/components/mep-ui/select/multi";
import { getRolesApi } from "@/controllers/API/user";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function UserRoleItem({ showDel, selectedRoles, onDelete, onChange }:
    { showDel?: boolean, selectedRoles: any[], onDelete?: any, onChange: (roles: string[]) => void }) {
    const { t } = useTranslation()

    const [roles, setRoles] = useState<any[]>([])
    const [selected, setSelected] = useState<string[]>(selectedRoles)

    useEffect(() => {
        getRolesApi('').then((res: any) => {
            const data = res.data || res.records || res;
            const roleOptions = (Array.isArray(data) ? data : []).map(role => ({
                label: role.role_name,
                value: role.id.toString()
            }))
            setRoles(roleOptions);
        })
    }, [])

    const handleSelectRole = (values: string[]) => {
        setSelected(values)
        onChange(values)
    }

    return <div className="flex items-center gap-4">
        <div className="flex-1">
            <MultiSelect
                multiple
                contentClassName="max-w-[420px] break-all"
                value={selected}
                options={roles}
                placeholder={t('system.roleSelect')}
                onChange={handleSelectRole}
            />
        </div>
        {showDel && <Button variant="ghost" size="icon" className="mt-0" onClick={onDelete}><DelIcon /></Button>}
    </div>
}
