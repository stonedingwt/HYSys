import * as ToastPrimitives from "@radix-ui/react-toast"
import { cva, type VariantProps } from "class-variance-authority"
import { X } from "lucide-react"
import * as React from "react"
import { cname } from "../utils"

const ToastProvider = ToastPrimitives.Provider

const ToastViewport = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Viewport>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Viewport>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Viewport
        ref={ref}
        className={cname(
            "fixed top-0 z-[1000] flex w-full flex-col-reverse pointer-events-none",
            className
        )}
        {...props}
    />
))
ToastViewport.displayName = ToastPrimitives.Viewport.displayName

const toastVariants = cva(
    "group pointer-events-auto relative flex w-full md:w-[420px] items-center space-x-3 overflow-hidden rounded-lg border-l-4 border p-4 mt-4 mr-4 pr-6 shadow-lg transition-all data-[swipe=cancel]:translate-x-0 data-[swipe=end]:translate-x-[var(--radix-toast-swipe-end-x)] data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=move]:transition-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=end]:animate-out data-[state=closed]:fade-out-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-top-full data-[state=open]:sm:slide-in-from-top-full",
    {
        variants: {
            variant: {
                info: "info border-l-sky-500 border-sky-200 bg-sky-50 dark:bg-sky-950/30 dark:border-sky-800 self-end",
                success: "success border-l-green-500 border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-800 self-end",
                warning: "warning border-l-amber-500 border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 self-end",
                error: "error border-l-red-500 border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-800 self-end",
            },
            message: {
                info: "shadow-xl bg-white dark:bg-[#0F172A]/95 dark:backdrop-blur-xl dark:border-white/[0.08] self-center",
                success: "shadow-xl bg-white dark:bg-[#0F172A]/95 dark:backdrop-blur-xl dark:border-white/[0.08] self-center",
                warning: "shadow-xl bg-white dark:bg-[#0F172A]/95 dark:backdrop-blur-xl dark:border-white/[0.08] self-center",
                error: "shadow-xl bg-white dark:bg-[#0F172A]/95 dark:backdrop-blur-xl dark:border-white/[0.08] self-center",
            }
        },
        defaultVariants: {},
    }
)

const Toast = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Root>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Root> &
    VariantProps<typeof toastVariants> &
    { isAlert?: boolean }
>(({ className, variant = 'info', isAlert, ...props }, ref) => {
    const variants = isAlert ? { message: variant } : { variant }

    return (
        <ToastPrimitives.Root
            ref={ref}
            className={cname(toastVariants(variants), className)}
            {...props}
        />
    )
})
Toast.displayName = ToastPrimitives.Root.displayName

const ToastAction = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Action>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Action>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Action
        ref={ref}
        className={cname(
            "inline-flex h-8 shrink-0 items-center justify-center rounded-md border bg-transparent px-3 text-sm font-medium transition-colors hover:bg-secondary focus:outline-none focus:ring-1 focus:ring-ring disabled:pointer-events-none disabled:opacity-50 group-[.destructive]:border-muted/40 group-[.destructive]:hover:border-destructive/30 group-[.destructive]:hover:bg-destructive group-[.destructive]:hover:text-destructive-foreground group-[.destructive]:focus:ring-destructive",
            className
        )}
        {...props}
    />
))
ToastAction.displayName = ToastPrimitives.Action.displayName

const ToastClose = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Close>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Close>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Close
        ref={ref}
        className={cname(
            "absolute right-1 top-1 rounded-md p-1 text-foreground/50 opacity-0 transition-opacity hover:text-foreground focus:opacity-100 focus:outline-none focus:ring-1 group-hover:opacity-100",
            className
        )}
        toast-close=""
        {...props}
    >
        <X className="h-4 w-4" />
    </ToastPrimitives.Close>
))
ToastClose.displayName = ToastPrimitives.Close.displayName

const ToastTitle = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Title>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Title>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Title
        ref={ref}
        className={cname("text-sm font-semibold [&+div]:text-xs group-[.info]:text-sky-600 group-[.success]:text-green-600 group-[.warning]:text-amber-600 group-[.error]:text-red-600 dark:group-[.info]:text-sky-400 dark:group-[.success]:text-green-400 dark:group-[.warning]:text-amber-400 dark:group-[.error]:text-red-400", className)}
        {...props}
    />
))
ToastTitle.displayName = ToastPrimitives.Title.displayName

const ToastDescription = React.forwardRef<
    React.ElementRef<typeof ToastPrimitives.Description>,
    React.ComponentPropsWithoutRef<typeof ToastPrimitives.Description>
>(({ className, ...props }, ref) => (
    <ToastPrimitives.Description
        ref={ref}
        className={cname("text-sm opacity-90 break-all", className)}
        {...props}
    />
))
ToastDescription.displayName = ToastPrimitives.Description.displayName

type ToastProps = React.ComponentPropsWithoutRef<typeof Toast>

type ToastActionElement = React.ReactElement<typeof ToastAction>

export {
    Toast, ToastAction, ToastClose, ToastDescription, ToastProvider, ToastTitle, ToastViewport, type ToastActionElement, type ToastProps
}

