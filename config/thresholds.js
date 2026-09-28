/**
 * ============================================================================
 * TEORIA: THRESHOLDS (LIMITES DE ACEITAÇÃO) EM TESTES NÃO FUNCIONAIS
 * ============================================================================
 *
 * O que são Thresholds?
 * ---------------------
 * Em testes não funcionais (especialmente de performance), não basta apenas
 * coletar métricas — é preciso definir critérios objetivos de sucesso ou falha.
 * Esses critérios são chamados de SLAs (Service Level Agreements) ou SLOs
 * (Service Level Objectives).
 *
 * No k6, os Thresholds são a materialização programática desses SLAs/SLOs.
 * Eles permitem que você declare: "o teste SÓ passa se a métrica X estiver
 * dentro do limite Y". Se o limite for violado, o k6 retorna exit code != 0,
 * o que é essencial para pipelines de CI/CD.
 *
 * Por que são importantes?
 * ------------------------
 * 1. Automatizam o julgamento do teste (pass/fail) sem intervenção humana.
 * 2. Garantem que regressões de performance sejam detectadas cedo.
 * 3. Alinham a engenharia com metas de negócio (ex: "95% das req < 500ms").
 * 4. Podem ser reutilizados entre diferentes scripts de teste.
 *
 * Tipos de operadores suportados:
 * - Estatísticos: avg, p(90), p(95), p(99), min, max, med
 * - Contadores: count, rate
 * - Lógicos: >, <, >=, <=, ==, !=
 *
 * abortOnFail:
 * - Se true, o teste é interrompido imediatamente quando o threshold falha,
 *   economizando recursos. Útil em testes longos (Soak, Stress).
 */

export const thresholds = {
  // Tempo de resposta: 95% das requisições devem ser concluídas em até 500ms
  // e 99% em até 1000ms
  http_req_duration: ['p(95)<500', 'p(99)<1000'],

  // Taxa de erro: menos de 1% das requisições podem falhar
  http_req_failed: ['rate<0.01'],

  // Checks: 100% dos checks de validação devem passar
  checks: ['rate==1.00'],

  // Exemplo com abortOnFail (útil para testes de stress/spike)
  // Descomente se quiser que o teste pare imediatamente ao falhar:
  //
  // http_req_duration: [
  //   { threshold: 'p(95)<500', abortOnFail: true },
  // ],
};