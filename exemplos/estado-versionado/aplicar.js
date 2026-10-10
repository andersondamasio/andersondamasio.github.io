'use strict';

function validar(snapshot) {
  if (!snapshot || Object.getPrototypeOf(snapshot) !== Object.prototype ||
      Object.keys(snapshot).sort().join(',') !== 'estado,id,versao' ||
      typeof snapshot.id !== 'string' || !snapshot.id.trim() ||
      snapshot.id !== snapshot.id.trim() ||
      !Number.isSafeInteger(snapshot.versao) || snapshot.versao < 0 ||
      !['disponivel', 'em-chamada', 'indisponivel'].includes(snapshot.estado)) {
    throw new TypeError('Snapshot invalido');
  }
}

// Contrato: snapshots completos, sequencia monotona por entidade e um produtor.
function aplicarSnapshot(atual, recebido) {
  validar(recebido);
  if (atual !== null) {
    validar(atual);
    if (atual.id !== recebido.id) throw new Error('Entidades diferentes');
    if (recebido.versao < atual.versao) {
      return { resultado: 'atrasado', snapshot: { ...atual } };
    }
    if (recebido.versao === atual.versao) {
      return {
        resultado: recebido.estado === atual.estado ? 'duplicado' : 'conflito',
        snapshot: { ...atual }
      };
    }
  }
  return { resultado: 'aplicado', snapshot: { ...recebido } };
}

module.exports = { aplicarSnapshot };
