#!/bin/bash

# ============================================================================
# TEORIA: AUTOMAÇÃO DE TESTES NÃO FUNCIONAIS EM PIPELINES
# ============================================================================
#
# Por que automatizar testes não funcionais?
# ------------------------------------------
# Testes de performance tradicionalmente eram feitos "na mão", poucas vezes
# antes do go-live. Isso é um erro grave. A abordagem moderna (Shift-Left
# Testing) defende que testes de performance devem rodar:
#
# 1. FREQUENTEMENTE: Em cada PR (Pull Request) ou merge na branch principal.
# 2. AUTOMATICAMENTE: Via CI/CD (GitHub Actions, GitLab CI, Jenkins, etc).
# 3. COM GATES DE QUALIDADE: Se um threshold falhar, o deploy é BLOQUEADO.
#
# Benefícios da automação:
# - Detecção precoce de regressões de performance (antes de chegar em produção).
# - Histórico de métricas ao longo do tempo (baseline evolutivo).
# - Cultura de performance como código (Performance as Code).
# - Redução de custos (bugs de performance em produção são caríssimos).
#
# Conceitos aplicados neste script:
# 1. set -e: O script aborta imediatamente se qualquer comando falhar.
# 2. Cores ANSI: Feedback visual claro (verde = sucesso, vermelho = falha).
# 3. Captura de exit codes: Sabemos exatamente qual teste falhou.
# 4. Relatórios em HTML: Cada teste gera seu próprio relatório para análise.
# 5. Flag condicional: --skip-soak permite pular o teste longo em execuções rápidas.
# 6. Resumo final: Relatório consolidado ao término da execução.
#
# Como usar:
#   ./scripts/run-all.sh              # Executa todos os testes
#   ./scripts/run-all.sh --skip-soak  # Pula o soak test (recomendado no CI)
#   ./scripts/run-all.sh --quick      # Executa apenas load e spike (rápido)
# ============================================================================

set -e  # Aborta em caso de erro

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Diretórios
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$PROJECT_DIR/reports"
TESTS_DIR="$PROJECT_DIR/tests"

# Cria pasta de relatórios se não existir
mkdir -p "$REPORTS_DIR"

# Flags de execução
SKIP_SOAK=false
QUICK_MODE=false

# Parse de argumentos
for arg in "$@"; do
  case $arg in
    --skip-soak)
      SKIP_SOAK=true
      shift
      ;;
    --quick)
      QUICK_MODE=true
      shift
      ;;
    *)
      echo -e "${YELLOW}⚠️  Argumento desconhecido: $arg${NC}"
      ;;
  esac
done

# Banner inicial
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🚀 SUITE DE TESTES NÃO FUNCIONAIS COM K6                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "📅 Data: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "📂 Projeto: $PROJECT_DIR"
echo -e "📊 Relatórios: $REPORTS_DIR"
echo ""

# Verifica se k6 está instalado
if ! command -v k6 &> /dev/null; then
    echo -e "${RED}❌ ERRO: k6 não está instalado!${NC}"
    echo -e "Instale com: https://k6.io/docs/getting-started/installation/"
    exit 1
fi

echo -e "${GREEN}✅ k6 detectado: $(k6 version | head -n 1)${NC}"
echo ""

# Contadores
TOTAL=0
PASSED=0
FAILED=0
FAILED_TESTS=()

# Função para executar um teste
run_test() {
    local test_name="$1"
    local test_file="$2"
    local description="$3"
    
    TOTAL=$((TOTAL + 1))
    
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${BLUE}▶  Teste $TOTAL: $test_name${NC}"
    echo -e "${BLUE}   $description${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    local start_time=$(date +%s)
    
    if k6 run --out "json=$REPORTS_DIR/${test_name}.json" "$test_file"; then
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo ""
        echo -e "${GREEN}✅ $test_name — PASSOU (${duration}s)${NC}"
        PASSED=$((PASSED + 1))
    else
        local exit_code=$?
        local end_time=$(date +%s)
        local duration=$((end_time - start_time))
        
        echo ""
        echo -e "${RED}❌ $test_name — FALHOU (exit code: $exit_code, ${duration}s)${NC}"
        FAILED=$((FAILED + 1))
        FAILED_TESTS+=("$test_name")
    fi
    
    echo ""
}

# Executa os testes conforme as flags
echo -e "${YELLOW}📋 Iniciando suite de testes...${NC}"
echo ""

# 1. Teste de Carga (sempre executa)
run_test "load-test" "$TESTS_DIR/01-load-test.js" "Avalia comportamento sob carga esperada"

# 2. Teste de Stress (sempre executa)
run_test "stress-test" "$TESTS_DIR/02-stress-test.js" "Descobre o ponto de ruptura do sistema"

# 3. Teste de Pico (sempre executa)
run_test "spike-test" "$TESTS_DIR/03-spike-test.js" "Simula aumento súbito e repentino de carga"

# 4. Teste de Resistência (condicional)
if [ "$SKIP_SOAK" = true ]; then
    echo -e "${YELLOW}⏭️  Soak test pulado (--skip-soak)${NC}"
    echo ""
elif [ "$QUICK_MODE" = true ]; then
    echo -e "${YELLOW}⏭️  Soak test pulado (--quick)${NC}"
    echo ""
else
    run_test "soak-test" "$TESTS_DIR/04-soak-test.js" "Avalia estabilidade sob carga contínua (pode demorar!)"
fi

# Relatório final
echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   📊 RELATÓRIO FINAL                                        ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo -e "Total de testes: ${BLUE}$TOTAL${NC}"
echo -e "Aprovados:       ${GREEN}$PASSED${NC}"
echo -e "Reprovados:      ${RED}$FAILED${NC}"
echo ""

if [ $FAILED -gt 0 ]; then
    echo -e "${RED}❌ Testes que falharam:${NC}"
    for test in "${FAILED_TESTS[@]}"; do
        echo -e "   ${RED}• $test${NC}"
    done
    echo ""
    echo -e "${YELLOW}💡 Dica: Consulte os relatórios em $REPORTS_DIR para detalhes.${NC}"
    echo ""
    exit 1
else
    echo -e "${GREEN}🎉 Todos os testes passaram com sucesso!${NC}"
    echo ""
    echo -e "${YELLOW}💡 Relatórios disponíveis em: $REPORTS_DIR${NC}"
    echo ""
    exit 0
fi