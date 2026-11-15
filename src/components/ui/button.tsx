import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../../lib/utils"

/**
 * Button Dimensions (from Figma):
 * - height: 48px
 * - border-radius: 6px
 * - padding: 8px 12px (top/bottom 8px, left/right 12px)
 * - gap: 10px (between icon and text)
 */
const buttonVariants = cva(
    "inline-flex items-center justify-center whitespace-nowrap rounded-[6px] font-medium ring-offset-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-[10px]",
    {
        variants: {
            variant: {
                default: "bg-primary text-white hover:bg-primary/90",
                destructive: "bg-red-500 text-white hover:bg-red-500/90",
                outline: "border border-gray-200 bg-white hover:bg-gray-50 text-gray-900",
                secondary: "bg-secondary text-white hover:bg-secondary/80",
                ghost: "hover:bg-gray-100 hover:text-gray-900",
                link: "text-primary underline-offset-4 hover:underline",
            },
            size: {
                default: "h-[48px] px-[12px] py-[8px] text-[14px]",
                sm: "h-[36px] px-[10px] py-[6px] text-[12px]",
                lg: "h-[52px] px-[16px] py-[10px] text-[16px]",
                icon: "h-[48px] w-[48px] p-[8px]",
                full: "h-[48px] px-[12px] py-[8px] text-[14px] w-full",
            },
        },
        defaultVariants: {
            variant: "default",
            size: "default",
        },
    }
)

export interface ButtonProps
    extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
    asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
    ({ className, variant, size, asChild = false, ...props }, ref) => {
        const Comp = asChild ? Slot : "button"
        return (
            <Comp
                className={cn(buttonVariants({ variant, size, className }))}
                ref={ref}
                {...props}
            />
        )
    }
)
Button.displayName = "Button"

export { Button, buttonVariants }
