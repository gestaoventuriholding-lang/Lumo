import { Check, Palette, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ChannelBadge from "@/components/ChannelBadge";
import { useChannelColors } from "@/hooks/useChannelColors";
import { useTheme } from "@/contexts/ThemeContext";
import {
  CHANNEL_PALETTE,
  isColorAvailable,
  resolveChannelColor,
  type ChannelKey,
  type PaletteGroup,
} from "@/lib/channelColors";

const CANAIS: { key: ChannelKey; nome: "Ligação" | "WhatsApp" }[] = [
  { key: "ligacao", nome: "Ligação" },
  { key: "whatsapp", nome: "WhatsApp" },
];
const GRUPOS: { id: PaletteGroup; titulo: string }[] = [
  { id: "principais", titulo: "Cores principais" },
  { id: "vibrantes", titulo: "Cores fortes e vibrantes" },
];

/** Configurações → Aparência: escolher a cor de Ligação e a de WhatsApp. Vale só para esta pessoa, neste navegador. */
export default function ChannelColorsCard() {
  const { choice, current, save } = useChannelColors();
  const { theme } = useTheme();
  const mode = theme === "dark" ? "dark" : "light";

  const escolher = (canal: ChannelKey, id: string) => {
    if (!isColorAvailable(id, canal, current)) return;
    save({ ...current, [canal]: id });
    toast.success("Cor salva", { id: "channel-color-saved", duration: 1800 });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Palette className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Cores dos canais</CardTitle>
            <CardDescription>
              Escolha a cor da Ligação e a do WhatsApp nos gráficos, selos e tabelas. Vale só para você, neste navegador.
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {CANAIS.map(({ key, nome }) => (
          <div key={key} className="space-y-3 rounded-lg ellos-inset p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-foreground">{nome}</p>
              <ChannelBadge channel={nome} />
            </div>
            {GRUPOS.map((g) => (
              <div key={g.id} className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">{g.titulo}</p>
                <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={`${g.titulo} para ${nome}`}>
                  {CHANNEL_PALETTE.filter((c) => c.group === g.id).map((c) => {
                    const ativa = current[key] === c.id;
                    const livre = isColorAvailable(c.id, key, current);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        role="radio"
                        aria-checked={ativa}
                        disabled={!livre && !ativa}
                        title={!livre && !ativa ? "Já usada pelo outro canal" : c.label}
                        onClick={() => escolher(key, c.id)}
                        className={cn(
                          "flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-sm transition-colors",
                          ativa ? "border-primary bg-primary-soft text-foreground" : "border-border text-muted-foreground hover:bg-muted/40",
                          !livre && !ativa && "cursor-not-allowed opacity-40"
                        )}
                      >
                        <span
                          className="flex h-4 w-4 items-center justify-center rounded-full"
                          style={{ backgroundColor: resolveChannelColor(c, mode).base }}
                        >
                          {ativa && <Check className="h-3 w-3 text-white [filter:drop-shadow(0_0_1px_rgb(0_0_0/0.9))]" strokeWidth={3} />}
                        </span>
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ))}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            Cada canal precisa de uma cor diferente. No modo claro, as cores vibrantes escurecem um pouco para o texto continuar legível.
          </p>
          <Button
            variant="outline"
            size="sm"
            disabled={!choice}
            onClick={() => {
              save(null);
              toast.success("Cores voltaram ao padrão", { id: "channel-color-saved", duration: 1800 });
            }}
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Restaurar cores padrão
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
