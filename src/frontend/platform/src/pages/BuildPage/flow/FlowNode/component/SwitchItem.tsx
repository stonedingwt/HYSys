import { Label } from "@/components/mep-ui/label"
import { Switch } from "@/components/mep-ui/switch"
import { QuestionTooltip } from "@/components/mep-ui/tooltip"
import { useState } from "react"
import { useTranslation } from "react-i18next"

export default function SwitchItem({ data, onChange, i18nPrefix }) {
    const [value, setValue] = useState(data.value)
    const { t } = useTranslation('flow')

    return <div className='node-item mb-4 flex justify-between' data-key={data.key}>
        <Label className="flex items-center mep-label">
            {t(`${i18nPrefix}label`)}
            {data.help && <QuestionTooltip content={t(`${i18nPrefix}help`)} />}
        </Label>
        <Switch checked={value} onCheckedChange={(bln) => {
            setValue(bln)
            onChange(bln)
        }} />
    </div>
};
