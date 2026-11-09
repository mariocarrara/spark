# SPARK — backend Laravel 11

Responde o mesmo contrato `/api/...` do legado (ver `../migracao/INVENTARIO_API.md`), em cima das tabelas do `../migracao/schema.sql`. O schema e a fonte da verdade: o Laravel NAO cria as tabelas de negocio (sem migrations para elas).

## Rodar local
1. `docker compose up -d` na raiz e carregar `migracao/schema.sql` (ver README da raiz).
2. `cp .env.example .env`, preencher `DB_PASSWORD`, `php artisan key:generate`.
3. Primeiro admin: `php artisan spark:admin-semente admin@empresa.com.br "Nome"` (a senha e pedida no terminal).
4. `php artisan serve` -> abra `http://localhost:8000` (o Laravel serve o front do legado, pasta `SPARK_FRONT_DIR`).
5. Testes: uma vez `php artisan spark:banco-teste` (cria o banco `spark_test` com o schema.sql), depois `php artisan test`. Cada teste roda numa transacao desfeita no fim. Precisa do Docker no ar.

O PHP precisa das extensoes `pdo_pgsql` e `sodium` ligadas no `php.ini`.

## Onde fica cada coisa
- `routes/api.php`: rotas `/api`.
- `app/Http/Controllers/Api/`: controllers (um por modulo do legado).
- `app/Models/`: Usuario, Permissao (tabelas do schema.sql).
- `app/Services/`: Login (bloqueio por tentativas, upgrade de senha legada), SessaoToken (Bearer; so o SHA-256 vai pro banco), Auditoria (nunca grava senha), SenhaLegada.
- Permissao na rota: `->middleware('perm:programacao,editar')`; so admin: `->middleware('admin')`.
- Regras ajustaveis: `config/spark.php` (variaveis `SPARK_*` no .env).
