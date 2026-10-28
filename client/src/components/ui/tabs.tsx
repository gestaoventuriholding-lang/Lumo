import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { AnimatePresence, motion, smoothEase, tabPanelVariants } from "@/lib/motionVariants";

type TabsContextValue = { value: string | undefined; groupId: string };

const TabsContext = React.createContext<TabsContextValue>({ value: undefined, groupId: "" });

function Tabs({
  className,
  value: valueProp,
  defaultValue,
  onValueChange,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Root>) {
  const groupId = React.useId();
  const [inner, setInner] = React.useState(defaultValue);
  const value = valueProp ?? inner;

  const handleChange = React.useCallback(
    (next: string) => {
      setInner(next);
      onValueChange?.(next);
    },
    [onValueChange]
  );

  return (
    <TabsContext.Provider value={{ value, groupId }}>
      <TabsPrimitive.Root
        data-slot="tabs"
        className={cn("flex flex-col gap-2", className)}
        value={value}
        onValueChange={handleChange}
        {...props}
      />
    </TabsContext.Provider>
  );
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        "bg-muted text-muted-foreground inline-flex h-9 w-fit items-center justify-center rounded-lg p-[3px] shadow-surface",
        className
      )}
      {...props}
    />
  );
}

function TabsTrigger({
  className,
  children,
  value,
  ...props
}: React.ComponentProps<typeof TabsPrimitive.Trigger>) {
  const { value: activeValue, groupId } = React.useContext(TabsContext);
  const isActive = activeValue === value;

  return (
    <TabsPrimitive.Trigger
      data-slot="tabs-trigger"
      value={value}
      className={cn(
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:outline-ring text-foreground dark:text-muted-foreground dark:data-[state=active]:text-foreground relative inline-flex h-[calc(100%-1px)] flex-1 items-center justify-center gap-1.5 rounded-md border border-transparent px-2 py-1 text-sm font-medium whitespace-nowrap transition-colors focus-visible:ring-[3px] focus-visible:outline-1 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
        className
      )}
      {...props}
    >
      {isActive && (
        // Fundo destacado compartilhado: desliza até a aba clicada
        <motion.span
          layoutId={`tabs-pill-${groupId}`}
          className="bg-background dark:border-input dark:bg-input/30 shadow-surface absolute inset-0 rounded-md border border-transparent"
          transition={{ duration: 0.25, ease: smoothEase }}
        />
      )}
      <span className="relative inline-flex items-center justify-center gap-1.5">{children}</span>
    </TabsPrimitive.Trigger>
  );
}

function TabsContent({
  className,
  value,
  children,
  ...props
}: Omit<React.ComponentProps<typeof TabsPrimitive.Content>, "forceMount" | "asChild">) {
  const { value: activeValue } = React.useContext(TabsContext);

  // Só o painel ativo existe no DOM; o que sai fica solto do fluxo (popLayout) enquanto some,
  // e o novo painel espera o fade de saída antes de subir (veja tabPanelVariants).
  return (
    <AnimatePresence mode="popLayout" initial={false}>
      {activeValue === value && (
        <motion.div
          key={value}
          role="tabpanel"
          data-slot="tabs-content"
          data-state="active"
          className={cn("flex-1 outline-none", className)}
          variants={tabPanelVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          {...(props as Record<string, unknown>)}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export { Tabs, TabsList, TabsTrigger, TabsContent };
