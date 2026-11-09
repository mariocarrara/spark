# SPARK

Duas pastas:
- `legado-powershell/` — sistema atual (v3.16.0, PowerShell + JS). Referencia do que precisa ser portado. `iniciar.bat` roda no Windows.
- `migracao/` — schema PostgreSQL/PostGIS, carregador de dados (`migrar.php`), prototipo de escopo por municipio (RLS) e planos.
- `php/` — novo backend Laravel 11 (ver `php/README.md`). Pronto: health e login/sessao/permissoes/auditoria.

## Abrir no VS Code com Claude Code
1. Instale: VS Code, extensao **Claude Code**, Git, PHP 8.3 (extensoes pdo_pgsql, sodium, mbstring, zip), e Docker (ou PostgreSQL 16 + PostGIS).
2. `git init && git add . && git commit -m "SPARK: base inicial"` (o .gitignore ja protege dados reais).
3. `code .` e abra o Claude Code. Ele le o `CLAUDE.md` sozinho.
4. Banco: `docker compose up -d`, depois `psql -h localhost -p 5433 -U postgres -d spark -f migracao/schema.sql`.
5. Dados reais (pasta `model/` do sistema atual, fora do Git): `php -d memory_limit=-1 migracao/migrar.php <pasta-model> "pgsql:host=localhost;port=5433;dbname=spark" postgres dev`.

Nunca coloque `model/`, senhas ou chaves no repositorio.

## Publicar no Render
1. Suba este repositorio para o GitHub (privado).
2. No Render: **New > Blueprint**, escolha o repositorio. O `render.yaml` cria o banco (PostgreSQL 16) e o servico web (Docker).
3. No servico web, em **Environment**, preencha `APP_KEY` (rode `cd php && php artisan key:generate --show` e cole) e `APP_URL`.
4. No 1o deploy as tabelas sao criadas sozinhas (`spark:instalar-schema`, nunca apaga dados).
5. Primeiro admin: no Render, aba **Shell** do servico: `cd /var/www/spark/php && php artisan spark:admin-semente seu@email "Seu Nome"`.
6. Dados do sistema antigo: Gestao de Bases > **Importar sistema antigo** (pasta `model`).
