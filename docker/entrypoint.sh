#!/bin/sh
# Inicio do container no Render.
set -e
cd /var/www/spark/php

# Apache escuta na porta que o Render manda
sed -ri "s/Listen [0-9]+/Listen ${PORT:-10000}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT:-10000}>/" /etc/apache2/sites-available/000-default.conf

if [ -z "$APP_KEY" ]; then echo "ERRO: defina APP_KEY no Render (php artisan key:generate --show)"; exit 1; fi
if [ -z "$DB_URL" ] && [ -z "$DB_HOST" ]; then
  echo "ERRO: falta o banco. No Render, crie a variavel DB_URL com a 'Internal Database URL' do PostgreSQL (aba Info do banco)."
  exit 1
fi

php artisan config:cache
php artisan route:cache
# cria as tabelas so se o banco estiver vazio (nunca apaga nada)
php artisan spark:instalar-schema

# 1o admin sem Shell: se SPARK_ADMIN_EMAIL e SPARK_ADMIN_SENHA estiverem no Render e ainda
# nao houver nenhum administrador, cria. Depois disso nao faz nada (pode apagar as variaveis).
if [ -n "$SPARK_ADMIN_EMAIL" ] && [ -n "$SPARK_ADMIN_SENHA" ]; then
  php artisan spark:admin-semente "$SPARK_ADMIN_EMAIL" "${SPARK_ADMIN_NOME:-Administrador}" --senha-env=SPARK_ADMIN_SENHA --so-se-nao-houver-admin || echo "AVISO: admin nao criado (senha com menos de 8 caracteres?)"
fi

exec apache2-foreground
