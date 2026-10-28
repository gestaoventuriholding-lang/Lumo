import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";
import { motion, smoothEase } from "@/lib/motionVariants";

function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator asChild data-slot="progress-indicator">
        {/* A barra se desenha da esquerda para a direita */}
        <motion.div
          className="bg-primary h-full w-full flex-1 origin-left"
          initial={{ scaleX: 0 }}
          animate={{ scaleX: Math.min(Math.max(value || 0, 0), 100) / 100 }}
          transition={{ duration: 0.8, ease: smoothEase }}
        />
      </ProgressPrimitive.Indicator>
    </ProgressPrimitive.Root>
  );
}

export { Progress };
