/** Fundo fixo animado só com CSS (estilos `.lumo-bg*` em index.css). */
export default function AnimatedBackground() {
  return (
    <div className="lumo-bg" aria-hidden="true">
      <div className="lumo-bg-wave lumo-bg-wave-a" />
      <div className="lumo-bg-wave lumo-bg-wave-b" />
    </div>
  );
}
