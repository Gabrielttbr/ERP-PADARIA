"""
Horário do sistema: tudo é gravado e exibido no fuso do negócio
(`settings.report_timezone`, padrão America/Sao_Paulo), como datetime
ingênuo (sem tzinfo).

Use sempre `agora()` em vez de `datetime.utcnow()`/`datetime.now()`:
- `utcnow()` grava 3h adiantado (o recibo saía com a hora errada);
- `now()` depende do fuso da máquina/container, que costuma ser UTC.

Exceção: o vencimento do JWT (`utils/security.py`) continua em UTC, que é o
que o padrão exige; ele não é exibido nem gravado no banco.

Registros gravados antes desta mudança estão em UTC (3h adiantados) e não
foram convertidos.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from app.config import get_settings


def _fuso() -> ZoneInfo:
    return ZoneInfo(get_settings().report_timezone)


def agora() -> datetime:
    """Data e hora atuais no fuso do negócio, sem tzinfo (formato do banco)."""
    return datetime.now(_fuso()).replace(tzinfo=None)


def hoje_local() -> date:
    """Que dia é hoje no fuso do negócio — não no fuso de quem roda o
    processo (o servidor/CI pode estar em UTC)."""
    return agora().date()


def limites_do_dia_local(data_inicio: date, data_fim: date) -> tuple[datetime, datetime]:
    """Meia-noite de `data_inicio` até 23:59:59.999999 de `data_fim`, no mesmo
    formato de `created_at` (horário local, sem tzinfo)."""
    return (
        datetime.combine(data_inicio, datetime.min.time()),
        datetime.combine(data_fim, datetime.max.time()),
    )
