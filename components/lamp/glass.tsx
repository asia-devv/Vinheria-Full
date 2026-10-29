import { forwardRef } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

export function GlassCard({
  className,
  delay,
  style,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { delay?: number }) {
  return (
    <div
      className={cn("glass animate-rise rounded-3xl text-white", className)}
      style={delay ? { animationDelay: `${delay}ms`, ...style } : style}
      {...props}
    />
  )
}

const glassButton = cva(
  "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden rounded-xl font-medium whitespace-nowrap transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none focus-visible:ring-2 focus-visible:ring-lamp/70 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.97] [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          "bg-lamp text-neutral-950 shadow-[0_8px_30px_-8px_var(--lamp)] hover:-translate-y-0.5 hover:bg-lamp-strong hover:shadow-[0_12px_40px_-8px_var(--lamp)]",
        glass:
          "border border-white/15 bg-white/10 text-white hover:-translate-y-0.5 hover:border-white/30 hover:bg-white/20",
        ghost: "text-white/75 hover:bg-white/10 hover:text-white",
        success:
          "border border-lamp-on/40 bg-lamp-on/15 text-lamp-on hover:-translate-y-0.5 hover:bg-lamp-on/25 hover:shadow-[0_10px_30px_-10px_var(--lamp-on)]",
        danger:
          "border border-lamp-off/40 bg-lamp-off/15 text-lamp-off hover:-translate-y-0.5 hover:bg-lamp-off/25 hover:shadow-[0_10px_30px_-10px_var(--lamp-off)]",
      },
      size: {
        sm: "h-9 px-3 text-sm",
        md: "h-11 px-4 text-sm",
        lg: "h-12 px-5 text-base",
        icon: "size-10",
      },
    },
    defaultVariants: { variant: "glass", size: "md" },
  },
)

export type GlassButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof glassButton> & { loading?: boolean }

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(function GlassButton(
  { className, variant, size, loading, disabled, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(glassButton({ variant, size }), className)}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : null}
      {children}
    </button>
  )
})

export function GlassInput({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-white/15 bg-white/5 px-4 text-sm text-white placeholder:text-white/40 outline-none transition-all duration-300 focus:border-lamp/60 focus:bg-white/10 focus:ring-4 focus:ring-lamp/15",
        className,
      )}
      {...props}
    />
  )
}

export function LiveDot({ active = true, className }: { active?: boolean; className?: string }) {
  return (
    <span className={cn("relative inline-flex size-2.5", className)} aria-hidden="true">
      {active ? <span className="animate-live-ping absolute inset-0 rounded-full bg-lamp-on" /> : null}
      <span className={cn("relative inline-flex size-2.5 rounded-full", active ? "bg-lamp-on" : "bg-white/30")} />
    </span>
  )
}
