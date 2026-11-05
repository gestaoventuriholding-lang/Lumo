import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import ChannelBadge, { ChannelIcon, channelStyle } from "./ChannelBadge";
import { ToneMark, ToneValue, TrendArrow, levelToTone } from "./ToneMark";

describe("canais: a cor sempre vem junto do nome ou do ícone", () => {
  it("o selo mostra ícone e nome, nas cores do canal", () => {
    const lig = renderToStaticMarkup(<ChannelBadge channel="Ligação" />);
    expect(lig).toContain("Ligação");
    expect(lig).toContain("<svg");
    expect(lig).toContain("text-channel-ligacao-text");
    expect(lig).toContain("bg-channel-ligacao-soft");
    const wa = renderToStaticMarkup(<ChannelBadge channel="WhatsApp" />);
    expect(wa).toContain("WhatsApp");
    expect(wa).toContain("<svg");
    expect(wa).toContain("text-channel-whatsapp-text");
    expect(wa).not.toContain("channel-ligacao");
  });
  it("o ícone do canal tem a cor do canal e é decorativo para leitor de tela (o nome vem ao lado)", () => {
    const html = renderToStaticMarkup(<ChannelIcon channel="WhatsApp" />);
    expect(html).toContain("text-channel-whatsapp-text");
    expect(html).toContain('aria-hidden="true"');
  });
  it("Ligação é azul e WhatsApp é verde: cada canal tem a sua cor e o seu ícone", () => {
    expect(channelStyle("Ligação").color).toBe("var(--channel-ligacao)");
    expect(channelStyle("WhatsApp").color).toBe("var(--channel-whatsapp)");
    expect(channelStyle("Ligação").icon).not.toBe(channelStyle("WhatsApp").icon);
  });
});

describe("bom, atenção e ruim: nunca só a cor", () => {
  it("cada tom tem símbolo (ícone) e rótulo para leitor de tela", () => {
    const bom = renderToStaticMarkup(<ToneMark tone="good" />);
    expect(bom).toContain("<svg");
    expect(bom).toContain("Bom");
    expect(renderToStaticMarkup(<ToneMark tone="warn" />)).toContain("Atenção");
    expect(renderToStaticMarkup(<ToneMark tone="bad" />)).toContain("Ruim");
  });
  it("o valor colorido leva o símbolo antes dele; sem tom, sem cor e sem símbolo", () => {
    const html = renderToStaticMarkup(<ToneValue tone="bad">54%</ToneValue>);
    expect(html).toContain("text-danger");
    expect(html.indexOf("<svg")).toBeLessThan(html.indexOf("54%"));
    const neutro = renderToStaticMarkup(<ToneValue>54%</ToneValue>);
    expect(neutro).not.toContain("<svg");
    expect(neutro).not.toContain("text-danger");
  });
  it("converte os níveis de alerta", () => {
    expect(levelToTone("green")).toBe("good");
    expect(levelToTone("yellow")).toBe("warn");
    expect(levelToTone("red")).toBe("bad");
    expect(levelToTone(undefined)).toBeUndefined();
  });
  it("seta de tendência: ▲ sobe e ▼ desce; sem tendência não mostra nada", () => {
    expect(renderToStaticMarkup(<TrendArrow trend="up" />)).toContain("▲");
    expect(renderToStaticMarkup(<TrendArrow trend="down" />)).toContain("▼");
    expect(renderToStaticMarkup(<TrendArrow trend="neutral" />)).toBe("");
  });
});
