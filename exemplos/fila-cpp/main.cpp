#include "fila.hpp"
#include <iostream>
#include <thread>

int main() {
    Fila fila;
    std::thread consumidor([&] {
        while (auto valor = fila.receber()) {
            std::cout << *valor << '\n';
        }
    });
    try {
        for (int valor = 1; valor <= 3; ++valor) fila.enviar(valor);
    } catch (...) {
        fila.fechar();
        consumidor.join();
        throw;
    }
    fila.fechar();
    consumidor.join();
}
