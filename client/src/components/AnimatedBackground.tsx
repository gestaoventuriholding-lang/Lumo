/** Fundo fixo animado só com CSS (estilos `.ellos-bg*` em index.css). */
export default function AnimatedBackground() {
  return (
    <div className="ellos-bg" aria-hidden="true">
      <div className="ellos-bg-wave ellos-bg-wave-a" />
      <div className="ellos-bg-wave ellos-bg-wave-b" />
    </div>
  );
}
