#pragma once
#include <condition_variable>
#include <mutex>
#include <optional>
#include <queue>

class Fila {
    std::mutex mutex_;
    std::condition_variable pronta_;
    std::queue<int> itens_;
    bool fechada_ = false;

public:
    bool enviar(int valor) {
        {
            std::lock_guard<std::mutex> trava(mutex_);
            if (fechada_) return false;
            itens_.push(valor);
        }
        pronta_.notify_one();
        return true;
    }

    std::optional<int> receber() {
        std::unique_lock<std::mutex> trava(mutex_);
        pronta_.wait(trava, [this] { return fechada_ || !itens_.empty(); });
        if (itens_.empty()) return std::nullopt;
        const int valor = itens_.front();
        itens_.pop();
        return valor;
    }

    void fechar() {
        {
            std::lock_guard<std::mutex> trava(mutex_);
            fechada_ = true;
        }
        pronta_.notify_all();
    }
};
