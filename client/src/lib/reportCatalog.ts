// Ellos: quais relatórios da Escallo o sistema usa, o que cada um traz e onde aparece.
// Ao passar a usar um relatório novo (ou deixar de usar), atualize esta lista: ela alimenta a tela Relatórios.
// As regras de leitura ficam nas funções em supabase/functions (escallo-sync e escallo-atendimento).

/** Fonte da data do último dado guardado */
export type FonteUltimoDado = "produtividade-ligacao" | "produtividade-whatsapp" | "fila-ligacao" | "fila-whatsapp" | "ia";

export interface RelatorioUsado {
  codigo: string;
  nome: string;
  canal: "Ligação" | "WhatsApp" | "Inteligência artificial";
  /** O que a Escallo entrega */
  traz: string[];
  /** Só nos guardados: o que fica no banco do Ellos */
  guarda?: string;
  /** Telas do Ellos que mostram a informação */
  ondeAparece: string[];
  /** Ausente = consultado na hora, nada é guardado */
  fonte?: FonteUltimoDado;
}

export const RELATORIOS_GUARDADOS: RelatorioUsado[] = [
  {
    codigo: "REL025",
    nome: "Produtividade por agente (voz)",
    canal: "Ligação",
    traz: [
      "Ligações atendidas, recebidas e feitas",
      "Tempo médio de atendimento (TMA) e tempo em conversa",
      "Tempo logado e pausas (legais, produtivas e improdutivas)",
      "Ocupação (TO1 a TO4) e ligações por hora",
    ],
    guarda: "Os números acima, por colaborador e por dia. Só de quem está vinculado pelo código da Escallo.",
    ondeAparece: ["Dashboard: Atendimentos e TMA", "Desempenho e mapa de ocupação", "Alerta de tempo logado acima do limite", "Vínculos com a Escallo"],
    fonte: "produtividade-ligacao",
  },
  {
    codigo: "REL090",
    nome: "Produtividade por agente (chat)",
    canal: "WhatsApp",
    traz: [
      "Atendimentos de entrada e de saída",
      "Tempo médio de atendimento (TMA) e tempo em atendimento",
      "Tempo logado e pausas (legais, produtivas e improdutivas)",
      "Ocupação (TO1 e TO2) e atendimentos por hora",
    ],
    guarda: "Os números acima, por colaborador e por dia. Só de quem está vinculado pelo código da Escallo.",
    ondeAparece: ["Dashboard: Atendimentos e TMA", "Desempenho e mapa de ocupação", "Cartão de Triagem", "Alerta de tempo logado acima do limite"],
    fonte: "produtividade-whatsapp",
  },
  {
    codigo: "REL001",
    nome: "Chamadas nas filas",
    canal: "Ligação",
    traz: ["Cada chamada que entrou em uma fila", "Se foi atendida ou abandonada", "Fila escolhida e tempo de espera"],
    guarda: "Só totais por dia e por grupo de fila (laboratoriais, imagem, cardiológicos e outras): atendidas, abandonadas e soma da espera.",
    ondeAparece: ["Dashboard: tempo médio de espera (TME), abandono e cartões de exames", "Auditoria: lista de ligações do dia"],
    fonte: "fila-ligacao",
  },
  {
    codigo: "REL091",
    nome: "Atendimentos por hora (chat)",
    canal: "WhatsApp",
    traz: ["Atendimentos em cada hora do dia", "Tempo médio de espera até ser atendido", "Não traz abandono"],
    guarda: "Só o total do dia: atendimentos e soma da espera.",
    ondeAparece: ["Dashboard: tempo médio de espera (TME) do WhatsApp"],
    fonte: "fila-whatsapp",
  },
  {
    codigo: "REL103",
    nome: "Consumo da inteligência artificial",
    canal: "Inteligência artificial",
    traz: ["Cada ação feita pela IA", "FTokens gastos em cada ação", "Protocolo do contato"],
    guarda: "Só totais por dia: FTokens, contatos e ações.",
    ondeAparece: ["Dashboard: consumo de IA e franquia do mês"],
    fonte: "ia",
  },
];

export const RELATORIOS_NA_HORA: RelatorioUsado[] = [
  {
    codigo: "REL002",
    nome: "Ligações por agente",
    canal: "Ligação",
    traz: ["Qual agente participou de cada ligação"],
    ondeAparece: ["Auditoria: junto com o REL001, monta a lista de ligações do colaborador"],
  },
  {
    codigo: "Histórico de mensagens",
    nome: "Conversas do chat",
    canal: "WhatsApp",
    traz: ["Mensagens de cada conversa", "Quais agentes atenderam, em ordem"],
    ondeAparece: ["Auditoria: abre a conversa", "Triagem: quantas conversas foram transferidas e para quem"],
  },
  {
    codigo: "Gravações",
    nome: "Áudio da ligação",
    canal: "Ligação",
    traz: ["O som da ligação escolhida"],
    ondeAparece: ["Auditoria: ouve a gravação"],
  },
];

/** Dias sem dado novo a partir dos quais a tela avisa (domingo não é sincronizado, então 2 dias é normal) */
export const DIAS_PARA_AVISAR = 3;

/** Maior data AAAA-MM-DD da lista; undefined se vazia */
export function ultimaData(datas: string[]): string | undefined {
  return datas.reduce<string | undefined>((maior, d) => (!maior || d > maior ? d : maior), undefined);
}

/** Dias inteiros entre a data do último dado e hoje (as duas AAAA-MM-DD) */
export function diasSemDado(ultimo: string, hoje: string): number {
  return Math.round((Date.parse(`${hoje}T12:00:00Z`) - Date.parse(`${ultimo}T12:00:00Z`)) / 86_400_000);
}
