# SPARK - imagem do Render (Laravel + front do legado + migrar.php)
# Estrutura dentro da imagem igual a do repositorio, para os caminhos padrao funcionarem:
#   /var/www/spark/php  /var/www/spark/legado-powershell/view  /var/www/spark/migracao
FROM php:8.3-apache

RUN apt-get update \
 && apt-get install -y --no-install-recommends libpq-dev unzip \
 && docker-php-ext-install pdo_pgsql opcache \
 && a2enmod rewrite headers \
 && rm -rf /var/lib/apt/lists/*

COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# PHP de producao. Upload em pedacos de 8 MB (importacao do sistema antigo) cabe com folga.
RUN cp "$PHP_INI_DIR/php.ini-production" "$PHP_INI_DIR/php.ini" \
 && { echo 'upload_max_filesize=20M'; echo 'post_max_size=24M'; echo 'memory_limit=512M'; \
      echo 'max_execution_time=3600'; echo 'expose_php=Off'; echo 'opcache.validate_timestamps=0'; } \
    > "$PHP_INI_DIR/conf.d/spark.ini"

WORKDIR /var/www/spark
COPY php/composer.json php/composer.lock php/
RUN cd php && composer install --no-dev --no-scripts --no-interaction --prefer-dist --no-autoloader

COPY php/ php/
COPY legado-powershell/view/ legado-powershell/view/
COPY migracao/schema.sql migracao/migrar.php migracao/

RUN cd php && composer dump-autoload --optimize --no-dev \
 && mkdir -p storage/app/legado storage/framework/cache storage/framework/views storage/logs bootstrap/cache \
 && chown -R www-data:www-data storage bootstrap/cache

# Apache: raiz em php/public, porta vinda do Render ($PORT), sem assinatura de versao
RUN sed -ri 's#/var/www/html#/var/www/spark/php/public#g' /etc/apache2/sites-available/000-default.conf \
 && printf '<Directory /var/www/spark/php/public>\n  AllowOverride All\n  Require all granted\n</Directory>\nServerTokens Prod\nServerSignature Off\nTimeout 3600\nAllowEncodedSlashes NoDecode\nAddOutputFilterByType DEFLATE application/json application/x-ndjson\n' > /etc/apache2/conf-enabled/spark.conf \
 && sed -ri 's#</VirtualHost>#  AllowEncodedSlashes NoDecode\n</VirtualHost>#' /etc/apache2/sites-available/000-default.conf

COPY docker/entrypoint.sh /usr/local/bin/spark-entrypoint
RUN chmod +x /usr/local/bin/spark-entrypoint

ENV APP_ENV=production APP_DEBUG=false LOG_CHANNEL=stderr CACHE_STORE=file SESSION_DRIVER=array PORT=10000 \
    DB_CONNECTION=pgsql DB_SEARCH_PATH=spark,public APP_TIMEZONE=America/Sao_Paulo
EXPOSE 10000
CMD ["spark-entrypoint"]
