#!/bin/sh
# Inicio do container no Render.
set -e
cd /var/www/spark/php

# Apache escuta na porta que o Render manda
sed -ri "s/Listen [0-9]+/Listen ${PORT:-10000}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:[0-9]+>/<VirtualHost *:${PORT:-10000}>/" /etc/apache2/sites-available/000-default.conf

if [ -z "$APP_KEY" ]; then echo "ERRO: defina APP_KEY no Render (php artisan key:generate --show)"; exit 1; fi

php artisan config:cache
php artisan route:cache
# cria as tabelas so se o banco estiver vazio (nunca apaga nada)
php artisan spark:instalar-schema

exec apache2-foreground
