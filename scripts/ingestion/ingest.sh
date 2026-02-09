#!/bin/bash
# CompliNist Document Ingestion Tool
# Interactive menu for managing the compliance library

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment if it exists
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
fi

print_header() {
    clear
    echo -e "${CYAN}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║${NC}${BOLD}        CompliNist Document Ingestion Tool                  ${NC}${CYAN}║${NC}"
    echo -e "${CYAN}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

print_menu() {
    echo -e "${BOLD}What would you like to do?${NC}"
    echo ""
    echo -e "  ${GREEN}1)${NC} List current database contents"
    echo -e "  ${GREEN}2)${NC} Ingest NIST 800-53 controls (with evidence suggestions)"
    echo -e "  ${GREEN}3)${NC} Ingest a single document"
    echo -e "  ${GREEN}4)${NC} Ingest all documents in a directory"
    echo -e "  ${GREEN}5)${NC} Audit database quality"
    echo -e "  ${GREEN}6)${NC} Clear database ${RED}(dangerous!)${NC}"
    echo -e "  ${GREEN}7)${NC} Package data for distribution"
    echo ""
    echo -e "  ${YELLOW}q)${NC} Quit"
    echo ""
}

list_contents() {
    echo -e "\n${BLUE}[INFO]${NC} Listing database contents...\n"
    python3 python/ingest_compliance_docs.py --list
    echo ""
    read -p "Press Enter to continue..."
}

ingest_800_53() {
    echo -e "\n${BLUE}[INFO]${NC} Ingesting NIST 800-53 controls...\n"
    echo "This will add all 1,189 NIST 800-53 controls with:"
    echo "  - Control definitions in plain English"
    echo "  - Implementation guidance (discussion)"
    echo "  - Evidence implementation suggestions"
    echo ""
    read -p "Proceed? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        python3 python/ingest_nist_800_53.py
    else
        echo "Cancelled."
    fi
    echo ""
    read -p "Press Enter to continue..."
}

ingest_single_file() {
    echo -e "\n${BLUE}[INFO]${NC} Ingest a single document\n"
    echo "Supported file types: .pdf, .csv, .xml, .xlsx, .xls, .md"
    echo ""

    read -p "Enter file path (or drag & drop): " file_path
    # Remove quotes if present (from drag & drop)
    file_path="${file_path%\"}"
    file_path="${file_path#\"}"
    file_path="${file_path%\'}"
    file_path="${file_path#\'}"

    if [ -z "$file_path" ]; then
        echo -e "${RED}No file specified${NC}"
        read -p "Press Enter to continue..."
        return
    fi

    if [ ! -f "$file_path" ]; then
        echo -e "${RED}File not found: $file_path${NC}"
        read -p "Press Enter to continue..."
        return
    fi

    echo ""
    echo "Document type options:"
    echo "  1) 800-53 (NIST SP 800-53 controls)"
    echo "  2) 800-171 (NIST SP 800-171)"
    echo "  3) 800-37 (RMF)"
    echo "  4) CMMC"
    echo "  5) FedRAMP"
    echo "  6) Other (enter custom)"
    echo "  7) Auto-detect (default)"
    echo ""
    read -p "Select document type [7]: " type_choice

    case $type_choice in
        1) doc_type="800-53" ;;
        2) doc_type="800-171" ;;
        3) doc_type="800-37_rmf" ;;
        4) doc_type="CMMC" ;;
        5) doc_type="FedRAMP" ;;
        6)
            read -p "Enter custom document type: " doc_type
            ;;
        *)
            doc_type=""
            ;;
    esac

    echo ""
    if [ -n "$doc_type" ]; then
        echo -e "${BLUE}[INFO]${NC} Ingesting with document type: $doc_type"
        python3 python/ingest_compliance_docs.py --file "$file_path" --type "$doc_type"
    else
        echo -e "${BLUE}[INFO]${NC} Ingesting with auto-detected document type"
        python3 python/ingest_compliance_docs.py --file "$file_path"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

ingest_directory() {
    echo -e "\n${BLUE}[INFO]${NC} Ingest all documents in a directory\n"
    echo "This will process all supported files (.pdf, .csv, .xml, .xlsx, .xls, .md)"
    echo ""

    read -p "Enter directory path: " dir_path
    # Remove quotes if present
    dir_path="${dir_path%\"}"
    dir_path="${dir_path#\"}"

    if [ -z "$dir_path" ]; then
        echo -e "${RED}No directory specified${NC}"
        read -p "Press Enter to continue..."
        return
    fi

    if [ ! -d "$dir_path" ]; then
        echo -e "${RED}Directory not found: $dir_path${NC}"
        read -p "Press Enter to continue..."
        return
    fi

    echo ""
    echo "Document type options (applies to all files):"
    echo "  1) 800-53"
    echo "  2) 800-171"
    echo "  3) 800-37 (RMF)"
    echo "  4) CMMC"
    echo "  5) FedRAMP"
    echo "  6) Other (enter custom)"
    echo "  7) Auto-detect per file (default)"
    echo ""
    read -p "Select document type [7]: " type_choice

    case $type_choice in
        1) doc_type="800-53" ;;
        2) doc_type="800-171" ;;
        3) doc_type="800-37_rmf" ;;
        4) doc_type="CMMC" ;;
        5) doc_type="FedRAMP" ;;
        6)
            read -p "Enter custom document type: " doc_type
            ;;
        *)
            doc_type=""
            ;;
    esac

    echo ""
    if [ -n "$doc_type" ]; then
        python3 python/ingest_compliance_docs.py --dir "$dir_path" --type "$doc_type"
    else
        python3 python/ingest_compliance_docs.py --dir "$dir_path"
    fi

    echo ""
    read -p "Press Enter to continue..."
}

audit_database() {
    echo -e "\n${BLUE}[INFO]${NC} Running database quality audit...\n"
    python3 scripts/audit-chromadb.py
    echo ""
    read -p "Press Enter to continue..."
}

clear_database() {
    echo -e "\n${RED}╔════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${RED}║                    ⚠️  WARNING ⚠️                            ║${NC}"
    echo -e "${RED}║  This will DELETE ALL documents from the compliance        ║${NC}"
    echo -e "${RED}║  library. This action cannot be undone!                    ║${NC}"
    echo -e "${RED}╚════════════════════════════════════════════════════════════╝${NC}"
    echo ""
    python3 python/ingest_compliance_docs.py --clear
    echo ""
    read -p "Press Enter to continue..."
}

package_data() {
    echo -e "\n${BLUE}[INFO]${NC} Packaging data for distribution...\n"
    echo "This will create complinist-data.tar.gz with:"
    echo "  - AI models (.gguf files)"
    echo "  - ChromaDB compliance library"
    echo ""
    read -p "Proceed? (y/N): " confirm
    if [[ $confirm =~ ^[Yy]$ ]]; then
        ./scripts/package-data.sh
    else
        echo "Cancelled."
    fi
    echo ""
    read -p "Press Enter to continue..."
}

# Main loop
while true; do
    print_header
    print_menu

    read -p "Select an option: " choice

    case $choice in
        1) list_contents ;;
        2) ingest_800_53 ;;
        3) ingest_single_file ;;
        4) ingest_directory ;;
        5) audit_database ;;
        6) clear_database ;;
        7) package_data ;;
        q|Q)
            echo -e "\n${GREEN}Goodbye!${NC}\n"
            exit 0
            ;;
        *)
            echo -e "\n${RED}Invalid option${NC}"
            sleep 1
            ;;
    esac
done
