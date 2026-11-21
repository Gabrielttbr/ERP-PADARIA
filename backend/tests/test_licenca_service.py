from datetime import date, datetime, timedelta

import pytest
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey

from app.models.licenca import Licenca
from app.services import licenca_service as ls


@pytest.fixture
def par(monkeypatch):
    """Par de teste no lugar do par real (a privada real não fica no repo)."""
    import base64
    from cryptography.hazmat.primitives import serialization

    privada = Ed25519PrivateKey.generate()
    pub = privada.public_key().public_bytes(serialization.Encoding.Raw, serialization.PublicFormat.Raw)
    monkeypatch.setattr(ls, "CHAVE_PUBLICA_B64", base64.b64encode(pub).decode())
    return privada


@pytest.fixture
def relogio(monkeypatch):
    estado = {"agora": datetime(2026, 11, 21, 10, 0)}
    monkeypatch.setattr(ls, "agora", lambda: estado["agora"])
    return estado


def test_chave_ida_e_volta(par):
    chave = ls.gerar_chave(par, "Padaria São João", date(2026, 11, 1), date(2026, 12, 6))
    dados = ls.ler_chave(chave)
    assert dados.cliente == "Padaria São João"
    assert dados.expira_em == date(2026, 12, 6)


def test_aceita_chave_com_quebra_de_linha(par):
    chave = ls.gerar_chave(par, "X", date(2026, 11, 1), date(2026, 12, 6))
    meio = len(chave) // 2
    assert ls.ler_chave(f"  {chave[:meio]}\n {chave[meio:]} ").cliente == "X"


def test_recusa_chave_adulterada(par):
    chave = ls.gerar_chave(par, "X", date(2026, 11, 1), date(2026, 12, 6))
    prefixo, dados, assinatura = chave.split(".")
    falsos = ls._b64e(b'{"c":"X","i":"2026-11-01","e":"2099-12-31"}')
    with pytest.raises(ls.ChaveInvalida):
        ls.ler_chave(f"{prefixo}.{falsos}.{assinatura}")


def test_recusa_chave_de_outro_par(par):
    outra = Ed25519PrivateKey.generate()
    with pytest.raises(ls.ChaveInvalida):
        ls.ler_chave(ls.gerar_chave(outra, "X", date(2026, 11, 1), date(2026, 12, 6)))


@pytest.mark.parametrize("texto", ["", "abc", "GN1.xx", "GN2.a.b", "GN1.!!!.???"])
def test_recusa_lixo(par, texto):
    with pytest.raises(ls.ChaveInvalida):
        ls.ler_chave(texto)


@pytest.mark.parametrize(
    ("dias", "situacao"),
    [(30, "ok"), (6, "ok"), (5, "aviso"), (1, "aviso"), (0, "aviso"), (-1, "bloqueada")],
)
def test_faixas_da_situacao(dias, situacao):
    hoje = date(2026, 11, 21)
    s = ls.calcular_situacao(hoje + timedelta(days=dias), hoje, "X", sem_chave=False)
    assert s.situacao == situacao
    assert s.dias_restantes == dias
    if situacao != "ok":
        assert "Regularize o seu pagamento" in s.mensagem


async def test_sem_chave_roda_cinco_dias_em_aviso_e_bloqueia(db, relogio):
    s = await ls.situacao_atual(db)
    assert s.sem_chave and s.situacao == "aviso" and s.dias_restantes == ls.DIAS_SEM_CHAVE

    relogio["agora"] += timedelta(days=ls.DIAS_SEM_CHAVE + 1)
    assert (await ls.situacao_atual(db)).bloqueada


async def test_ativar_chave_desbloqueia(db, relogio, par):
    await ls.situacao_atual(db)  # primeira execução: começa o período sem chave
    relogio["agora"] += timedelta(days=30)
    assert (await ls.situacao_atual(db)).bloqueada

    hoje = relogio["agora"].date()
    s = await ls.ativar_chave(db, ls.gerar_chave(par, "Cliente", hoje, hoje + timedelta(days=35)))
    assert s.situacao == "ok" and s.cliente == "Cliente" and s.dias_restantes == 35

    relogio["agora"] += timedelta(days=30)
    assert (await ls.situacao_atual(db)).situacao == "aviso"
    relogio["agora"] += timedelta(days=6)
    assert (await ls.situacao_atual(db)).bloqueada


async def test_ativar_chave_vencida_e_recusado(db, relogio, par):
    hoje = relogio["agora"].date()
    with pytest.raises(ls.ChaveInvalida, match="já venceu"):
        await ls.ativar_chave(db, ls.gerar_chave(par, "X", hoje - timedelta(days=40), hoje - timedelta(days=1)))


async def test_atrasar_relogio_nao_estica_a_chave(db, relogio, par):
    hoje = relogio["agora"].date()
    await ls.ativar_chave(db, ls.gerar_chave(par, "X", hoje, hoje + timedelta(days=35)))

    relogio["agora"] += timedelta(days=40)
    assert (await ls.situacao_atual(db)).bloqueada

    relogio["agora"] -= timedelta(days=20)  # cliente volta o relógio do PC
    assert (await ls.situacao_atual(db)).bloqueada


async def test_chave_gravada_adulterada_bloqueia(db, relogio, par):
    db.add(Licenca(id=1, chave="GN1.lixo.lixo", instalada_em=relogio["agora"], ultimo_visto=relogio["agora"]))
    await db.flush()
    assert (await ls.situacao_atual(db)).bloqueada
