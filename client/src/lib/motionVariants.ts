import { AnimatePresence, motion, type Variants } from "framer-motion";

export { AnimatePresence, motion };
export type { Variants };

/** Curva ease-in-out suave usada nas transições de página e de abas */
export const smoothEase = [0.4, 0, 0.2, 1] as const;

/** Intervalo entre irmãos na entrada escalonada (s) */
export const STAGGER_STEP = 0.06;

/** Container da página: o título entra primeiro e os blocos seguintes, um a um */
export const pageContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: STAGGER_STEP, delayChildren: 0.04 },
  },
};

/** Item de página: fade + subida de 8px */
export const pageItemVariants: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.35, ease: smoothEase },
  },
};

/** Grupo de cards/linhas: entram da esquerda para a direita, um a um */
export const staggerContainerVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: STAGGER_STEP },
  },
};

/** Card de indicador, coluna ou linha de tabela dentro de um grupo escalonado */
export const cardItemVariants: Variants = pageItemVariants;

/** Linhas de progresso e etapas que se desenham da esquerda para a direita */
export const drawLineVariants: Variants = {
  hidden: { scaleX: 0 },
  visible: {
    scaleX: 1,
    transition: { duration: 0.8, ease: smoothEase },
  },
};

/** Marcadores de etapa que acendem em sequência */
export const stepMarkerVariants: Variants = {
  hidden: { opacity: 0.25, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.25, ease: smoothEase },
  },
};

/** Duração dos gráficos de linha do Recharts (ms) */
export const CHART_DRAW_MS = 900;

/** Troca de página: crossfade com desfoque de 0 a 6px */
export const PAGE_TRANSITION_S = 0.3;

export const pageTransitionProps = {
  initial: { opacity: 0 },
  animate: {
    opacity: 1,
    transition: { duration: PAGE_TRANSITION_S, ease: smoothEase },
  },
  exit: {
    opacity: 0,
    filter: "blur(6px)",
    transition: { duration: PAGE_TRANSITION_S, ease: smoothEase },
  },
} as const;

/** Troca de aba: sai com fade e a nova sobe 12px com fade e desfoque leve */
export const TAB_EXIT_S = 0.12;
export const TAB_ENTER_S = 0.25;

export const tabPanelVariants: Variants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)" },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transitionEnd: { filter: "none" },
    transition: { duration: TAB_ENTER_S, ease: smoothEase, delay: TAB_EXIT_S },
  },
  exit: {
    opacity: 0,
    transition: { duration: TAB_EXIT_S, ease: smoothEase },
  },
};

export const sidebarEase = smoothEase;
