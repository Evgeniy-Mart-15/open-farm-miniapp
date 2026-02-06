#!/bin/bash
# Локальный запуск мини‑аппа (для разработки). Пользователи открывают ферму через бота по https://openfarmik.netlify.app

cd /Users/evgenij/Documents/farm-miniapp

echo "🌱 Запуск мини‑аппа на http://localhost:4173"
echo "   Открой в браузере: http://localhost:4173/"
echo "   Остановить: Ctrl+C"
echo ""

npm run preview
