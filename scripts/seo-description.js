function descricaoSeoUtilizavel(value) {
  const texto = String(value ?? "").trim();
  // This checks empty/placeholder metadata, not editorial quality or search ranking.
  return /[\p{L}\p{N}]/u.test(texto) &&
    !/^(?:t[i\u00ed]tulo|resumo|introdu[c\u00e7][a\u00e3]o|descri[c\u00e7][a\u00e3]o)\s*[:.!?]*$/iu.test(texto);
}

module.exports = { descricaoSeoUtilizavel };
