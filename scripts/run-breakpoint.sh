#!/bin/bash

# ============================================================================
# Script para executar o Breakpoint Test e gerar o relatório visual do Knee Point
# ============================================================================

set -e

# Cores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
TEST_FILE="$PROJECT_DIR/tests/05-breakpoint-test.js"
JSON_OUTPUT="$PROJECT_DIR/reports/breakpoint-data.json"
HTML_OUTPUT="$PROJECT_DIR/reports/breakpoint-knee-point.html"

echo -e "${BLUE}"
echo "╔══════════════════════════════════════════════════════════════╗"
echo "║   🎯 BREAKPOINT TEST - Knee Point Analysis                 ║"
echo "╚══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Verifica se Node.js está instalado
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}⚠️  Node.js não encontrado. Instalando via nvm...${NC}"
    echo "Por favor, instale Node.js: https://nodejs.org/"
    exit 1
fi

# Cria pasta de relatórios
mkdir -p "$PROJECT_DIR/reports"

echo -e "${BLUE}▶  Executando Breakpoint Test...${NC}"
echo ""

# Executa o k6 com output JSON
k6 run --out "json=$JSON_OUTPUT" "$TEST_FILE"

echo ""
echo -e "${BLUE}▶  Gerando relatório visual do Knee Point...${NC}"
echo ""

# Gera o relatório HTML
node "$SCRIPT_DIR/breakpoint-reporter.js" "$JSON_OUTPUT" "$HTML_OUTPUT"

echo ""
echo -e "${GREEN}✅ Concluído!${NC}"
echo ""
echo -e "📊 Relatório HTML: ${BLUE}$HTML_OUTPUT${NC}"
echo -e "📁 Dados JSON:     ${BLUE}$JSON_OUTPUT${NC}"
echo ""
echo -e "${YELLOW}💡 Abra o relatório no navegador para ver os gráficos interativos:${NC}"
echo -e "   ${BLUE}open $HTML_OUTPUT${NC}  (macOS)"
echo -e "   ${BLUE}xdg-open $HTML_OUTPUT${NC}  (Linux)"
echo -e "   ${BLUE}start $HTML_OUTPUT${NC}  (Windows)"
echo ""