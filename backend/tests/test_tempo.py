"""Horário do sistema: tudo é gravado no fuso do negócio (America/Sao_Paulo),
independente do fuso da máquina/container que roda o backend."""

from datetime import date, datetime, timedelta, timezone
from zoneinfo import ZoneInfo

from app.utils.tempo import agora, hoje_local, limites_do_dia_local


def test_agora_esta_no_horario_de_sao_paulo():
    esperado = datetime.now(ZoneInfo("America/Sao_Paulo")).replace(tzinfo=None)
    assert abs(agora() - esperado) < timedelta(seconds=5)
    assert agora().tzinfo is None  # mesmo formato das colunas do banco


def test_agora_nao_e_utc():
    # São Paulo é UTC-3 (sem horário de verão desde 2019).
    utc = datetime.now(timezone.utc).replace(tzinfo=None)
    assert abs((utc - agora()) - timedelta(hours=3)) < timedelta(seconds=5)


def test_hoje_local_bate_com_agora():
    assert hoje_local() == agora().date()


def test_limites_cobrem_o_dia_inteiro_no_horario_local():
    inicio, fim = limites_do_dia_local(date(2026, 8, 1), date(2026, 8, 1))
    assert inicio == datetime(2026, 8, 1, 0, 0, 0)
    assert fim == datetime(2026, 8, 1, 23, 59, 59, 999999)


def test_venda_das_22h_fica_dentro_do_filtro_de_hoje():
    venda = datetime(2026, 8, 1, 22, 0, 0)  # gravada já no horário de SP
    inicio, fim = limites_do_dia_local(date(2026, 8, 1), date(2026, 8, 1))
    assert inicio <= venda <= fim


def test_periodo_de_varios_dias():
    inicio, fim = limites_do_dia_local(date(2026, 8, 1), date(2026, 8, 5))
    assert inicio == datetime(2026, 8, 1, 0, 0, 0)
    assert fim == datetime(2026, 8, 5, 23, 59, 59, 999999)
