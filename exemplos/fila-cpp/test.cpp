#include "fila.hpp"
#include <algorithm>
#include <future>
#include <iostream>
#include <stdexcept>
#include <vector>

void exigir(bool condicao, const char* mensagem) {
    if (!condicao) throw std::runtime_error(mensagem);
}

int main() {
    Fila fifo;
    exigir(fifo.enviar(4) && fifo.enviar(2), "envio em fila aberta");
    fifo.fechar();
    fifo.fechar();
    exigir(!fifo.enviar(9), "envio depois de fechar");
    exigir(fifo.receber() == 4 && fifo.receber() == 2, "FIFO e drenagem");
    exigir(!fifo.receber() && !fifo.receber(), "fim estavel");

    Fila encerramento;
    auto vazio1 = std::async(std::launch::async, [&] { return encerramento.receber(); });
    auto vazio2 = std::async(std::launch::async, [&] { return encerramento.receber(); });
    encerramento.fechar();
    exigir(!vazio1.get() && !vazio2.get(), "encerramento de consumidores");

    Fila concorrente;
    auto consumir = [&] {
        std::vector<int> valores;
        while (auto valor = concorrente.receber()) valores.push_back(*valor);
        return valores;
    };
    auto primeiro = std::async(std::launch::async, consumir);
    auto segundo = std::async(std::launch::async, consumir);
    try {
        for (int valor = 0; valor < 10000; ++valor) concorrente.enviar(valor);
    } catch (...) {
        concorrente.fechar();
        throw;
    }
    concorrente.fechar();
    auto a = primeiro.get();
    auto b = segundo.get();
    exigir(std::is_sorted(a.begin(), a.end()) && std::is_sorted(b.begin(), b.end()), "ordem por consumidor");
    a.insert(a.end(), b.begin(), b.end());
    std::sort(a.begin(), a.end());
    exigir(a.size() == 10000, "quantidade total");
    for (int valor = 0; valor < 10000; ++valor) exigir(a[valor] == valor, "sem perda ou duplicacao");
    std::cout << "OK: FIFO, drenagem, fechamento e 10000 itens concorrentes\n";
}
