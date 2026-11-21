"""
ESCPOSService — Gera o stream de bytes ESC/POS para impressoras térmicas.
Sem dependência de biblioteca externa neste módulo; apenas bytes puros.
Compatível com impressoras 80mm (42 colunas) e 58mm (32 colunas).
"""

import logging
import textwrap
from datetime import datetime
from decimal import Decimal
from dataclasses import dataclass
from app.config import get_settings

settings = get_settings()
logger = logging.getLogger(__name__)

# Tempo máximo (ms) de espera da impressora USB antes de desistir.
USB_TIMEOUT_MS = 5000

# ── Constantes ESC/POS ─────────────────────────────────────────────────────────
ESC = b"\x1b"
GS  = b"\x1d"

INIT          = ESC + b"@"           # Inicializa impressora
ALIGN_LEFT    = ESC + b"a\x00"
ALIGN_CENTER  = ESC + b"a\x01"
ALIGN_RIGHT   = ESC + b"a\x02"
BOLD_ON       = ESC + b"E\x01"
BOLD_OFF      = ESC + b"E\x00"
FONT_NORMAL   = ESC + b"!\x00"
FONT_DOUBLE_H = ESC + b"!\x10"
FONT_DOUBLE   = ESC + b"!\x30"
UNDERLINE_ON  = ESC + b"-\x01"
UNDERLINE_OFF = ESC + b"-\x00"
LINE_FEED     = b"\n"
CUT_FULL      = GS + b"V\x00"        # Corte completo
CUT_PARTIAL   = GS + b"V\x01"        # Corte parcial (recomendado)

COLS_80MM = 42
COLS_58MM = 32


@dataclass
class ItemRecibo:
    nome: str
    quantidade: Decimal
    preco_unit: Decimal
    total_item: Decimal
    unidade: str = "un"


@dataclass
class DadosRecibo:
    numero_venda: int
    uuid_venda: str
    operador: str
    caixa_nome: str
    itens: list[ItemRecibo]
    subtotal: Decimal
    desconto: Decimal
    total: Decimal
    pagamentos: list[dict]   # [{"forma": "dinheiro", "valor": 20.00}]
    troco: Decimal
    data_hora: datetime


def gerar_recibo(dados: DadosRecibo) -> bytes:
    cols = COLS_80MM if settings.printer_paper_width >= 80 else COLS_58MM
    enc = "cp850"  # Codepage padrão para impressoras térmicas no Brasil

    def enc_line(text: str) -> bytes:
        return text.encode(enc, errors="replace") + LINE_FEED

    def sep(char: str = "-") -> bytes:
        return enc_line(char * cols)

    def center(text: str) -> bytes:
        return ALIGN_CENTER + enc_line(text)

    def left(text: str) -> bytes:
        return ALIGN_LEFT + enc_line(text)

    def right(text: str) -> bytes:
        return ALIGN_RIGHT + enc_line(text)

    def fmt_brl(value: Decimal) -> str:
        return f"R$ {value:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

    def fmt_qtd(qtd: Decimal, unit: str) -> str:
        # kg e l: 3 casas com vírgula BR  → "1,250 kg", "0,500 l"
        # demais: sem zeros à direita       → "200 g", "3 un"
        if unit in ("kg", "l"):
            return f"{qtd:.3f}".replace(".", ",") + f" {unit}"
        return f"{qtd:g} {unit}"

    def item_line(nome: str, qtd: Decimal, unit: str, preco: Decimal, total: Decimal) -> bytes:
        # Duas linhas por item, para caber em 58mm e 80mm sem cortar valores:
        #   Pão Francês
        #     2 un x R$ 0,60                   R$ 1,20
        #   Cebola
        #     0,200 kg x R$ 5,90               R$ 1,18
        out = b""
        for parte in textwrap.wrap(nome, cols) or [""]:
            out += ALIGN_LEFT + enc_line(parte)
        detalhe = f"  {fmt_qtd(qtd, unit)} x {fmt_brl(preco)}"
        total_str = fmt_brl(total)
        if len(detalhe) + 1 + len(total_str) <= cols:
            out += ALIGN_LEFT + enc_line(f"{detalhe:<{cols - len(total_str)}}{total_str}")
        else:
            # Valores grandes (comum em 58mm): total vai numa linha própria
            out += ALIGN_LEFT + enc_line(detalhe[:cols])
            out += ALIGN_RIGHT + enc_line(total_str)
        return out

    def totals_line(label: str, value: str) -> bytes:
        line = f"{label:<{cols - len(value) - 1}}{value}"
        return ALIGN_LEFT + enc_line(line)

    # ── Monta buffer ───────────────────────────────────────────────────────────
    buf = bytearray()
    buf += INIT

    # Cabeçalho
    buf += center(settings.padaria_nome.upper())
    buf += center(f"CNPJ: {settings.padaria_cnpj}")
    if settings.padaria_endereco:
        buf += center(settings.padaria_endereco)
    if settings.padaria_cidade:
        buf += center(settings.padaria_cidade)
    if settings.padaria_telefone:
        buf += center(f"Tel: {settings.padaria_telefone}")
    buf += sep("=")
    buf += center("CUPOM NÃO FISCAL")
    buf += sep("=")

    # Info da venda
    buf += left(f"Venda: #{dados.numero_venda:06d}  {dados.data_hora.strftime('%d/%m/%Y %H:%M')}")
    buf += left(f"Operador: {dados.operador}  Caixa: {dados.caixa_nome}")
    buf += sep()

    # Cabeçalho de itens
    header = f"{'ITEM / QTD x UNIT':<{cols - 5}}TOTAL"
    buf += BOLD_ON + ALIGN_LEFT + enc_line(header) + BOLD_OFF
    buf += sep()

    # Itens
    for item in dados.itens:
        buf += item_line(item.nome, item.quantidade, item.unidade, item.preco_unit, item.total_item)

    buf += sep()

    # Totais
    buf += totals_line("SUBTOTAL:", fmt_brl(dados.subtotal))
    if dados.desconto > 0:
        buf += totals_line("DESCONTO:", f"- {fmt_brl(dados.desconto)}")
    buf += BOLD_ON
    buf += totals_line("TOTAL:", fmt_brl(dados.total))
    buf += BOLD_OFF
    buf += sep()

    # Pagamentos
    forma_labels = {
        "dinheiro": "DINHEIRO",
        "cartao_credito": "CARTÃO CRÉDITO",
        "cartao_debito": "CARTÃO DÉBITO",
        "pix": "PIX",
        "vale": "VALE",
    }
    for pag in dados.pagamentos:
        label = forma_labels.get(pag["forma"], pag["forma"].upper())
        buf += totals_line(f"  {label}:", fmt_brl(Decimal(str(pag["valor"]))))

    if dados.troco > 0:
        buf += BOLD_ON
        buf += totals_line("TROCO:", fmt_brl(dados.troco))
        buf += BOLD_OFF

    buf += sep("=")

    # Rodapé
    buf += center(settings.padaria_mensagem_rodape)
    buf += center(f"UUID: {dados.uuid_venda[:18]}")
    buf += LINE_FEED * 3

    buf += CUT_PARTIAL

    return bytes(buf)


def _carregar_libusb() -> None:
    """
    Carrega a libusb-1.0.dll que vem no pacote `libusb-package` (Windows).

    O python-escpos chama `usb.core.find()` sem backend, e o pyusb só procura a
    DLL no PATH do sistema — que no Windows não tem. Carregando aqui uma vez, o
    pyusb guarda o backend e o `find()` seguinte já o reutiliza. Sem o pacote
    (Linux/Docker), não faz nada: a libusb do sistema é encontrada sozinha.
    """
    try:
        import libusb_package
        import usb.backend.libusb1
    except ImportError:
        return
    usb.backend.libusb1.get_backend(find_library=libusb_package.find_library)


def enviar_para_impressora_usb(dados_bytes: bytes) -> bool:
    """
    Envia bytes para impressora USB via python-escpos.
    Retorna True se bem-sucedido.
    """
    try:
        _carregar_libusb()
        from escpos.printer import Usb
        vendor_id = int(settings.printer_vendor_id, 16)
        product_id = int(settings.printer_product_id, 16)
        # timeout em ms. NUNCA 0: na libusb 0 = esperar para sempre, e se a
        # impressora não responder (sem papel, driver errado, desligada) a
        # escrita fica presa e trava o servidor junto.
        p = Usb(vendor_id, product_id, timeout=USB_TIMEOUT_MS)
        try:
            p._raw(dados_bytes)
        finally:
            try:
                p.close()   # libera o USB para a próxima impressão
            except Exception:
                pass
        return True
    except Exception as exc:
        logger.exception("Erro ao imprimir via USB: %s", exc)
        return False


def enviar_para_impressora_network(dados_bytes: bytes) -> bool:
    """Envia bytes via socket TCP para impressoras de rede."""
    import socket
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.settimeout(5)
            s.connect((settings.printer_network_ip, settings.printer_network_port))
            s.sendall(dados_bytes)
        return True
    except Exception as exc:
        logger.exception("Erro ao imprimir via rede: %s", exc)
        return False


def imprimir(dados: DadosRecibo) -> bool:
    buf = gerar_recibo(dados)
    tipo = settings.printer_type.lower()
    if tipo == "usb":
        return enviar_para_impressora_usb(buf)
    elif tipo == "network":
        return enviar_para_impressora_network(buf)
    elif tipo == "file":
        import tempfile
        import os
        path = os.path.join(tempfile.gettempdir(), "ultimo_recibo.bin")
        with open(path, "wb") as f:
            f.write(buf)
        return True
    return False
