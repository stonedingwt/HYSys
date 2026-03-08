import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "~/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-slate-100 text-slate-700 dark:bg-white/[0.05] dark:text-slate-300 shadow hover:bg-slate-200 dark:hover:bg-white/[0.06]",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
                outline: "text-foreground",
                ai: "border-sky-400/20 bg-sky-400/10 text-sky-400",
                gray: "bg-[#E8EBF2] text-[#61646D] px-1 py-[1px]"
            },
        },
        defaultVariants: {
            variant: "default",
        },
    }
)

export interface BadgeProps
    extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> { }

function Badge({ className, variant, ...props }: BadgeProps) {
    return (
        <div className={cn(badgeVariants({ variant }), className)} {...props} />
    )
}

export { Badge, badgeVariants }
