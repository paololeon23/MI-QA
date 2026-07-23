/** Snapshot compartido del asistente IA (Espárrago PT → sidebar). */

let lastSnapshot = null;

export function setEsparragoPtAiSnapshot(snapshot) {
  lastSnapshot = snapshot || null;
}

export function getEsparragoPtAiSnapshot() {
  return lastSnapshot;
}

export function clearEsparragoPtAiSnapshot() {
  lastSnapshot = null;
}
