<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * Prefeituras — contrato de routes/prefeituras.ps1 (o que o front usa):
 *   GET  /prefeituras                    contatos (lista do legado, em legado_bruto.prefeituras; importada pela Importacao de Bases)
 *   GET  /prefeituras/config             [{municipio, tiposOS, kmz, atualizadoEm, atualizadoPor}]
 *   PUT  /prefeituras/config/{municipio} {tiposOS, kmz} (prefeituras.editar); os dois nulos = volta ao padrao
 *   POST /prefeituras/salvar-pacote      {nome, base64} copia do .zip gerado no navegador (storage/app/relatorios_prefeituras/<dia>)
 * Logistica (GET /logistica/equipes|programacoes|os|vinculos): bases prontas do sistema antigo, guardadas em legado_bruto.
 */
class PrefeiturasController extends Controller
{
    private const TIPOS = ['Pendente', 'A reprogramar', 'Programada', 'Despachada', 'Executada', 'Cancelada'];

    private static function bruto(string $entidade, $padrao = [])
    {
        $v = DB::table('legado_bruto')->where('entidade', $entidade)->value('dados');

        return $v === null ? $padrao : json_decode($v, true);
    }

    private function ver(Request $r, string $msg = 'Sem permissão para visualizar Prefeituras.'): ?JsonResponse
    {
        return $r->user()->pode('prefeituras', 'visualizar') ? null : response()->json(['erro' => $msg], 403);
    }

    public function index(Request $r): JsonResponse
    {
        return $this->ver($r) ?? response()->json(array_values((array) self::bruto('prefeituras')));
    }

    private static function lerConfig(): array
    {
        $v = DB::table('configuracoes')->where('chave', 'prefeituras_config')->value('valor');

        return array_values(array_filter((array) json_decode((string) $v, true), 'is_array'));
    }

    public function config(Request $r): JsonResponse
    {
        return $this->ver($r) ?? response()->json(self::lerConfig());
    }

    public function salvarConfig(Request $r, string $municipio): JsonResponse
    {
        if (! $r->user()->pode('prefeituras', 'editar')) {
            return response()->json(['erro' => 'Sem permissão para editar as prefeituras.'], 403);
        }
        $municipio = trim($municipio);
        if ($municipio === '' || mb_strlen($municipio) > 120) {
            return response()->json(['erro' => 'Município inválido.'], 400);
        }
        $tipos = $r->has('tiposOS') && is_array($r->input('tiposOS')) ? array_values(array_intersect(self::TIPOS, $r->input('tiposOS'))) : null;
        $kmz = $r->input('kmz') !== null ? filter_var($r->input('kmz'), FILTER_VALIDATE_BOOLEAN) : null;
        DB::transaction(function () use ($municipio, $tipos, $kmz, $r) {
            DB::select('SELECT pg_advisory_xact_lock(hashtext(?))', ['prefeituras_config']);
            $todos = array_values(array_filter(self::lerConfig(), fn ($c) => ($c['municipio'] ?? null) !== $municipio));
            if ($tipos !== null || $kmz !== null) {
                $todos[] = ['municipio' => $municipio, 'tiposOS' => $tipos, 'kmz' => $kmz, 'atualizadoEm' => now()->toIso8601String(), 'atualizadoPor' => $r->user()->nome];
            }
            DB::table('configuracoes')->upsert([['chave' => 'prefeituras_config', 'valor' => json_encode($todos, JSON_UNESCAPED_UNICODE), 'atualizado_em' => now(),
                'atualizado_por' => $r->user()->id]], ['chave'], ['valor', 'atualizado_em', 'atualizado_por']);
        });

        return response()->json(['municipio' => $municipio, 'tiposOS' => $tipos, 'kmz' => $kmz]);
    }

    public function salvarPacote(Request $r): JsonResponse
    {
        if ($x = $this->ver($r, 'Sem permissão para gerar relatório.')) {
            return $x;
        }
        $nome = (string) $r->input('nome', '');
        if (! preg_match('/^[A-Za-z0-9_\-\.]{1,80}\.zip$/', $nome) || str_contains($nome, '..')) {
            return response()->json(['erro' => 'Nome de arquivo inválido.'], 400);
        }
        $bytes = base64_decode((string) $r->input('base64', ''), true);
        if ($bytes === false || strlen($bytes) < 22 || strlen($bytes) > 80 * 1024 * 1024 || ! str_starts_with($bytes, "PK")) {
            return response()->json(['erro' => 'Conteúdo inválido.'], 400);
        }
        $dir = storage_path('app'.DIRECTORY_SEPARATOR.'relatorios_prefeituras'.DIRECTORY_SEPARATOR.now()->format('Y-m-d'));
        is_dir($dir) || mkdir($dir, 0775, true);
        file_put_contents($dir.DIRECTORY_SEPARATOR.$nome, $bytes);

        return response()->json(['pasta' => 'relatorios_prefeituras/'.now()->format('Y-m-d'), 'arquivo' => $nome, 'bytes' => strlen($bytes)]);
    }

    public function logistica(Request $r, string $qual): JsonResponse
    {
        if (! $r->user()->pode('programacao', 'visualizar')) {
            return response()->json(['erro' => 'Sem permissão para visualizar Programação.'], 403);
        }
        if ($qual === 'vinculos') {
            return response()->json(self::bruto('logistica_vinculos', null) ?? ['vinculos' => (object) [], 'estatisticas' => (object) []]);
        }

        return response()->json(array_values((array) self::bruto('logistica_'.$qual)));
    }
}
