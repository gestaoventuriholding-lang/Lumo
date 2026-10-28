/**
 * Gera IDs numéricos únicos para registros que vão para o banco.
 *
 * Antes o Lumo usava "maior ID + 1", o que funciona só no navegador de uma
 * pessoa. Com o banco compartilhado (e o admin vendo dados de todos), os IDs
 * precisam ser únicos globalmente. Usamos o horário em milissegundos x 1000
 * mais um contador, o que cabe com folga em um inteiro seguro do JavaScript.
 */
let lastBase = 0;
let counter = 0;

export function newId(): number {
  const base = Date.now() * 1000;
  if (base === lastBase) {
    counter += 1;
  } else {
    lastBase = base;
    counter = Math.floor(Math.random() * 100);
  }
  return base + (counter % 1000);
}
