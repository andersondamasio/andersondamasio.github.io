'use strict';

function compararDatas(temporal = globalThis.Temporal) {
  if (!temporal?.PlainDate || !temporal?.ZonedDateTime) {
    throw new Error('Temporal indisponivel neste ambiente.');
  }
  const inicio = temporal.PlainDate.from('2026-02-13');
  const seteDiasDepois = inicio.add({ days: 7 });
  const partida = temporal.ZonedDateTime.from('2026-03-07T12:00[America/New_York]');
  const diaSeguinte = partida.add({ days: 1 });
  const rejeitaHorario = texto => {
    try {
      temporal.ZonedDateTime.from(texto, { disambiguation: 'reject' });
      return false;
    } catch (erro) {
      if (!(erro instanceof RangeError)) throw erro;
      return true;
    }
  };
  return {
    dataOriginal: inicio.toString(),
    seteDiasDepois: seteDiasDepois.toString(),
    partida: partida.toString(),
    diaSeguinte: diaSeguinte.toString(),
    horasTranscorridas: diaSeguinte.since(partida, { largestUnit: 'hours' }).hours,
    apos24Horas: partida.add({ hours: 24 }).toString(),
    horarioInexistenteRejeitado: rejeitaHorario('2026-03-08T02:30[America/New_York]'),
    horarioRepetidoRejeitado: rejeitaHorario('2026-11-01T01:30[America/New_York]')
  };
}

if (typeof module !== 'undefined') module.exports = { compararDatas };
