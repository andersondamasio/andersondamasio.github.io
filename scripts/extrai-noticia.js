import { spawn } from 'child_process';

// Função assíncrona que executa extrai-noticia.js e retorna o resumo/texto
export async function extrairResumoDaNoticia(url) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', ['scripts/extrai-noticia.js', url]);

    let data = '';
    let error = '';

    child.stdout.on('data', chunk => {
      data += chunk;
    });

    child.stderr.on('data', chunk => {
      error += chunk;
    });

    child.on('close', code => {
      if (code !== 0) {
        reject(new Error(`Erro ao extrair resumo: ${error}`));
      } else {
        try {
          const resultado = JSON.parse(data);
          resolve(resultado); // { resumoFonte: ..., textoPrincipal: ... }
        } catch (e) {
          reject(new Error(`Erro ao parsear resultado: ${e.message}\nSaída: ${data}`));
        }
      }
    });
  });
}
