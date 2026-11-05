import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { useTheme } from "@/contexts/ThemeContext";
import {
  DEFAULT_CHANNEL_COLORS,
  applyChannelColors,
  loadChannelColors,
  saveChannelColors,
  subscribeChannelColors,
  type ChannelColorChoice,
} from "@/lib/channelColors";

const lerBruto = () => {
  try {
    return localStorage.getItem("ellos-channel-colors") ?? "";
  } catch {
    return "";
  }
};

/** Escolha de cores dos canais desta pessoa (null = cores do tema) */
export function useChannelColors() {
  const bruto = useSyncExternalStore(subscribeChannelColors, lerBruto, () => "");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const choice = useMemo(() => (bruto ? loadChannelColors() : null), [bruto]);
  const save = useCallback((c: ChannelColorChoice | null) => saveChannelColors(c), []);
  return { choice, current: choice ?? DEFAULT_CHANNEL_COLORS, save };
}

/** Mantém as variáveis CSS dos canais em dia com a escolha e com o modo claro/escuro. Não desenha nada. */
export function ChannelColorsApplier() {
  const { theme } = useTheme();
  const { choice } = useChannelColors();
  useEffect(() => {
    applyChannelColors(choice, theme === "dark" ? "dark" : "light");
  }, [choice, theme]);
  return null;
}
