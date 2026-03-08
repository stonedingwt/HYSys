import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"
import { cn } from "~/utils"

const badgeVariants = cva(
    "inline-flex items-center rounded-[8px] border px-2.5 py-0.5 text-xs font-semibold transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
    {
        variants: {
            variant: {
                default:
                    "border-transparent bg-slate-100 text-slate-700 dark:bg-white/[0.06] dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/[0.08]",
                secondary:
                    "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
                destructive:
                    "border-transparent bg-red-500/10 text-red-500 dark:bg-red-500/15 dark:text-red-400",
                outline: "text-foreground border-slate-200 dark:border-white/[0.08]",
                ai: "border-cyan-400/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.15)]",
                violet: "border-violet-400/20 bg-violet-500/10 text-violet-600 dark:text-violet-400 shadow-[0_0_8px_rgba(139,92,246,0.15)]",
                signal: "border-orange-400/20 bg-orange-500/10 text-orange-600 dark:text-orange-400",
                gray: "bg-[#E8EBF2] dark:bg-white/[0.06] text-[#61646D] dark:text-slate-400 px-1 py-[1px]"
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
