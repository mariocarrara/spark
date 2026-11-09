# Inventário da API atual (contrato que o PHP precisa cumprir) — rascunho v0
Extraído dos comentários e do despacho do `controller/server.ps1` (v3.16.0). Corpo e formato de resposta de cada rota serão
registrados módulo a módulo durante a migração (cada um com teste comparando PowerShell × PHP).

Prefixo `/api/`. Autenticação por token de sessão (`Authorization`), exceto `auth/login` e `usuarios/solicitar-cadastro`.
Respostas especiais: algumas rotas devolvem JSON já em gzip (`/manutencao/os`, `/historico/mapa`) e outras bytes crus (`/apprl/indice`).

| Módulo | Rotas |
|---|---|
| auth | POST login · POST logout · GET me · POST trocar-senha |
| usuarios / permissoes | POST cadastro · POST solicitar-cadastro (pública) · GET solicitacoes · POST solicitacoes/{id}/aprovar|recusar · GET lista · DELETE {id} · GET/PUT permissoes/{usuarioId} |
| equipes | GET · POST · PUT {id} · POST importar |
| metas / produtividade | GET/POST metas · PUT metas/{id} · POST metas/importar · GET produtividade/resumo · GET/POST/DELETE justificativas |
| feriados | GET · POST |
| indisponibilidades | GET · POST · DELETE {id} |
| listas | GET · POST · PUT {id} · DELETE (apagar tudo da lista) |
| cadastros (genérico) | GET/POST/DELETE(tudo) `/cadastros/<base>` · PUT/DELETE `/<base>/<chave>` · POST `/<base>/<chave>/restaurar` · GET `/conjuntos/mapa` |
| manutencao | GET os (filtros) · GET camadas · GET localidades-mapa · GET km-rede-resumo |
| ajustes | GET · PUT {osId} · DELETE {osId} |
| programacao | GET (filtros) · POST · PUT {id} · GET {id}/log · GET buscar-protecao · GET protecao-proxima · GET logistica · POST zerar |
| alertas | GET/PUT/DELETE config · GET/PUT tratados |
| apprl | GET indice · GET/PUT config · POST recalcular *(vira consulta PostGIS)* |
| nix | GET · POST (planilha ou `{incluir}`) · PUT raio · DELETE (base ou `?id=`) |
| rank | GET · GET atual · GET {id} · POST · DELETE {id} |
| historico | GET planos · GET os · GET exportar (CSV) · GET mapa · DELETE planos/{plano} |
| importacao | POST validar · POST confirmar · POST shapefile · POST podas-executado · POST podas-pendente · POST podas-historico · GET log · GET camadas · DELETE camadas/{c}[/{chave}] · POST resetar-tudo |
| postes / equip | GET resumo · GET area (bbox) · GET lista · GET poste · DELETE · POST aplicar |
| prefeituras | GET · POST importar · GET/PUT config/{municipio} · POST salvar-pacote · POST gerar-relatorio |
| logistica | GET equipes · programacoes · os · vinculos |
| ajuda | GET · POST · PUT {id} |
