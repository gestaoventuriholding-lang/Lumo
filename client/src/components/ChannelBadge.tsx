import { MessageCircle, Phone, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type ChannelName = "Ligação" | "WhatsApp";

/**
 * Cor, ícone e classes de cada canal, no tema (Ligação = azul, WhatsApp = verde-limão).
 * A cor do canal aparece SEMPRE junto do nome ou do ícone dele; nunca sozinha.
 */
export const CHANNEL_STYLE: Record<
  ChannelName,
  { icon: LucideIcon; text: string; soft: string; solid: string; color: string }
> = {
  Ligação: {
    icon: Phone,
    text: "text-channel-ligacao-text",
    soft: "bg-channel-ligacao-soft",
    solid: "bg-channel-ligacao",
    color: "var(--channel-ligacao)",
  },
  WhatsApp: {
    icon: MessageCircle,
    text: "text-channel-whatsapp-text",
    soft: "bg-channel-whatsapp-soft",
    solid: "bg-channel-whatsapp",
    color: "var(--channel-whatsapp)",
  },
};

export function channelStyle(channel: string) {
  return channel === "WhatsApp" ? CHANNEL_STYLE.WhatsApp : CHANNEL_STYLE["Ligação"];
}

/** Selo do canal: ícone + nome, nas cores do canal */
export default function ChannelBadge({ channel, className }: { channel: string; className?: string }) {
  const style = channelStyle(channel);
  const Icon = style.icon;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
        style.soft,
        style.text,
        className
      )}
    >
      <Icon aria-hidden className="h-3.5 w-3.5" />
      {channel}
    </span>
  );
}

/** Ícone do canal na cor dele (use sempre ao lado do nome do canal) */
export function ChannelIcon({ channel, className }: { channel: string; className?: string }) {
  const style = channelStyle(channel);
  const Icon = style.icon;
  return <Icon aria-hidden className={cn("h-4 w-4", style.text, className)} />;
}
