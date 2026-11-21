"""
Log da aplicação em arquivo.

Tudo que passa pelo `logging` (erros da aplicação, exceções não tratadas nas
rotas — que o uvicorn registra em "uvicorn.error" — e os avisos de startup)
vai para `backend/logs/app.log`, além de continuar saindo no terminal.

O arquivo gira em 5 MB e mantém 5 cópias (app.log.1 ... app.log.5), para não
encher o disco da loja. A pasta pode ser trocada com LOG_DIR no .env.
O "uvicorn.access" (uma linha por requisição) fica fora do arquivo de propósito.
"""
import logging
import os
import sys
from logging.handlers import RotatingFileHandler

_BACKEND_DIR = os.path.normpath(os.path.join(os.path.dirname(__file__), ".."))
_FORMATO = "%(asctime)s %(levelname)-8s [%(name)s] %(message)s"



def configurar_logs(log_dir: str = "", nivel: str = "INFO") -> str:
    """Liga o log em arquivo. Idempotente. Retorna o caminho do arquivo."""
    pasta = log_dir or os.path.join(_BACKEND_DIR, "logs")
    if not os.path.isabs(pasta):
        pasta = os.path.join(_BACKEND_DIR, pasta)
    os.makedirs(pasta, exist_ok=True)
    caminho = os.path.join(pasta, "app.log")

    raiz = logging.getLogger()
    if any(getattr(h, "_erp_padaria", False) for h in raiz.handlers):
        return caminho

    arquivo = RotatingFileHandler(
        caminho, maxBytes=5 * 1024 * 1024, backupCount=5, encoding="utf-8"
    )
    arquivo.setFormatter(logging.Formatter(_FORMATO))
    arquivo._erp_padaria = True  # marca para não duplicar em reload

    terminal = logging.StreamHandler()
    terminal.setFormatter(logging.Formatter(_FORMATO))

    raiz.setLevel(nivel.upper())
    raiz.addHandler(arquivo)
    raiz.addHandler(terminal)

    # O logger "uvicorn" não propaga para o root (o uvicorn configura assim);
    # "uvicorn.error" propaga para ele, então basta um handler aqui.
    logging.getLogger("uvicorn").addHandler(arquivo)
    # httpx loga cada requisição em INFO; no arquivo só interessa o que falhou.
    logging.getLogger("httpx").setLevel(logging.WARNING)
    # Com APP_DEBUG o SQLAlchemy ecoa todo SQL no terminal pelo próprio handler;
    # sem isto cada query sairia duplicada no terminal e encheria o app.log.
    logging.getLogger("sqlalchemy.engine.Engine").propagate = False

    # Exceção que escapar fora do event loop (ex.: no import) também vai pro log.
    def _excecao_nao_tratada(tipo, valor, tb):
        if issubclass(tipo, KeyboardInterrupt):
            sys.__excepthook__(tipo, valor, tb)
            return
        logging.getLogger("app").critical("Erro não tratado", exc_info=(tipo, valor, tb))

    sys.excepthook = _excecao_nao_tratada
    return caminho
