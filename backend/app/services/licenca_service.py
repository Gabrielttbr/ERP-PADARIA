"""Chave de acesso: bloqueia o sistema quando a mensalidade não é renovada.

Como funciona
-------------
- O dono do sistema gera a chave com `gerar_chave_acesso.py`, assinando com a
  chave PRIVADA (que fica só no computador dele, nunca no repositório).
- O sistema instalado no cliente só tem a chave PÚBLICA abaixo: consegue
  conferir que a chave é verdadeira, mas não consegue criar uma.
- A chave diz até que dia o sistema pode ser usado. Nos últimos
  `DIAS_AVISO` dias aparece o aviso para regularizar o pagamento; depois do
  vencimento o sistema bloqueia até uma chave nova ser colada.
- Instalação sem chave nenhuma (primeira instalação ou atualização de quem já
  usava antes deste recurso) roda `DIAS_SEM_CHAVE` dias em modo de aviso.

Formato: GN1.<dados em base64url>.<assinatura Ed25519 em base64url>
"""

import base64
import json
import re
import time
from dataclasses import dataclass
from datetime import date, timedelta

from cryptography.exceptions import InvalidSignature
from cryptography.hazmat.primitives.asymmetric.ed25519 import Ed25519PrivateKey, Ed25519PublicKey
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.licenca import Licenca
from app.utils.tempo import agora

# Par da chave privada em ~/.gironegocios/chave_privada_licenca.pem (máquina do dono).
CHAVE_PUBLICA_B64 = "aSTOW6Te03GaD5wCjEETIL+Nrok3P5ITSMYRrymH5xw="

PREFIXO = "GN1"
DIAS_VALIDADE_PADRAO = 35
DIAS_AVISO = 5
DIAS_SEM_CHAVE = 5

MSG_REGULARIZE = (
    "Regularize o seu pagamento e solicite ao responsável pelo sistema "
    "uma nova chave de acesso."
)


_GRAVAR_ULTIMO_VISTO_A_CADA = timedelta(minutes=5)


class ChaveInvalida(ValueError):
    pass


@dataclass(frozen=True)
class DadosChave:
    cliente: str
    emitida_em: date
    expira_em: date


def _b64e(dados: bytes) -> str:
    return base64.urlsafe_b64encode(dados).rstrip(b"=").decode()


def _b64d(texto: str) -> bytes:
    return base64.urlsafe_b64decode(texto + "=" * (-len(texto) % 4))


def _chave_publica() -> Ed25519PublicKey:
    return Ed25519PublicKey.from_public_bytes(base64.b64decode(CHAVE_PUBLICA_B64))


def gerar_chave(privada: Ed25519PrivateKey, cliente: str, emitida_em: date, expira_em: date) -> str:
    dados = json.dumps(
        {"c": cliente, "i": emitida_em.isoformat(), "e": expira_em.isoformat()},
        separators=(",", ":"),
        ensure_ascii=False,
    ).encode()
    corpo = f"{PREFIXO}.{_b64e(dados)}"
    return f"{corpo}.{_b64e(privada.sign(corpo.encode()))}"


def normalizar(chave: str) -> str:
    # Copiar do WhatsApp/e-mail costuma quebrar linha ou meter espaço no meio
    return re.sub(r"\s+", "", chave or "")


def ler_chave(chave: str, publica: Ed25519PublicKey | None = None) -> DadosChave:
    chave = normalizar(chave)
    partes = chave.split(".")
    if len(partes) != 3 or partes[0] != PREFIXO:
        raise ChaveInvalida("Chave de acesso em formato inválido. Confira se copiou a chave inteira.")
    corpo = f"{partes[0]}.{partes[1]}"
    try:
        (publica or _chave_publica()).verify(_b64d(partes[2]), corpo.encode())
        dados = json.loads(_b64d(partes[1]))
        return DadosChave(
            cliente=str(dados["c"]),
            emitida_em=date.fromisoformat(dados["i"]),
            expira_em=date.fromisoformat(dados["e"]),
        )
    except (InvalidSignature, ValueError, KeyError, TypeError):
        raise ChaveInvalida("Chave de acesso inválida. Confira se copiou a chave inteira.")


# ── Situação da instalação ────────────────────────────────────────────────────

@dataclass(frozen=True)
class Situacao:
    situacao: str  # "ok" | "aviso" | "bloqueada"
    sem_chave: bool
    cliente: str | None
    expira_em: date
    dias_restantes: int
    mensagem: str

    @property
    def bloqueada(self) -> bool:
        return self.situacao == "bloqueada"

    def como_dict(self) -> dict:
        return {
            "situacao": self.situacao,
            "sem_chave": self.sem_chave,
            "cliente": self.cliente,
            "expira_em": self.expira_em.isoformat(),
            "dias_restantes": self.dias_restantes,
            "dias_aviso": DIAS_AVISO,
            "mensagem": self.mensagem,
        }


def calcular_situacao(expira_em: date, hoje: date, cliente: str | None, sem_chave: bool) -> Situacao:
    """A chave vale até o fim do dia `expira_em`."""
    dias = (expira_em - hoje).days
    data_br = expira_em.strftime("%d/%m/%Y")
    if dias < 0:
        situacao = "bloqueada"
        mensagem = (
            "Sistema bloqueado: o período de uso sem chave de acesso terminou. "
            if sem_chave else
            f"Sistema bloqueado: a chave de acesso venceu em {data_br}. "
        ) + MSG_REGULARIZE
    elif dias <= DIAS_AVISO:
        situacao = "aviso"
        quando = "hoje" if dias == 0 else ("amanhã" if dias == 1 else f"em {dias} dias")
        mensagem = (
            f"Este sistema ainda não tem chave de acesso e será bloqueado {quando} ({data_br}). "
            if sem_chave else
            f"Sua chave de acesso vence {quando} ({data_br}). "
        ) + MSG_REGULARIZE
    else:
        situacao = "ok"
        mensagem = f"Chave de acesso válida até {data_br}."
    return Situacao(situacao, sem_chave, cliente, expira_em, dias, mensagem)


async def garantir_registro(db: AsyncSession) -> None:
    """Cria o registro na inicialização — criar sob demanda dava corrida
    (duas requisições simultâneas inserindo o id=1)."""
    await _obter_registro(db)


async def _obter_registro(db: AsyncSession) -> Licenca:
    registro = (await db.execute(select(Licenca).where(Licenca.id == 1))).scalar_one_or_none()
    if registro is None:
        registro = Licenca(id=1, instalada_em=agora(), ultimo_visto=agora())
        db.add(registro)
        await db.flush()
    return registro


async def situacao_atual(db: AsyncSession) -> Situacao:
    registro = await _obter_registro(db)
    momento = agora()
    if momento >= registro.ultimo_visto:
        # Só grava de vez em quando: escrever a cada requisição disputaria o
        # banco (SQLite) com as vendas
        if momento - registro.ultimo_visto > _GRAVAR_ULTIMO_VISTO_A_CADA:
            registro.ultimo_visto = momento
    else:
        # Relógio atrasado: conta a partir do maior horário já visto
        momento = registro.ultimo_visto
    hoje = momento.date()

    if registro.chave:
        try:
            dados = ler_chave(registro.chave)
            return calcular_situacao(dados.expira_em, hoje, dados.cliente, sem_chave=False)
        except ChaveInvalida:
            pass  # chave gravada adulterada: trata como vencida
        return calcular_situacao(hoje - timedelta(days=1), hoje, None, sem_chave=False)

    expira = registro.instalada_em.date() + timedelta(days=DIAS_SEM_CHAVE)
    return calcular_situacao(expira, hoje, None, sem_chave=True)


async def ativar_chave(db: AsyncSession, chave: str) -> Situacao:
    dados = ler_chave(chave)
    hoje = agora().date()
    if dados.expira_em < hoje:
        raise ChaveInvalida(
            f"Esta chave de acesso já venceu em {dados.expira_em.strftime('%d/%m/%Y')}. "
            "Solicite uma chave nova ao responsável pelo sistema."
        )
    registro = await _obter_registro(db)
    registro.chave = normalizar(chave)
    registro.ativada_em = agora()
    # Chave nova e verdadeira zera um relógio que tenha ido pro futuro por engano
    registro.ultimo_visto = agora()
    await db.flush()
    limpar_cache()
    return await situacao_atual(db)


# ── Cache usado pelo middleware (evita consultar o banco a cada requisição) ──

_CACHE_SEGUNDOS = 60
_cache: tuple[float, Situacao] | None = None


def limpar_cache() -> None:
    global _cache
    _cache = None


async def situacao_em_cache(db_factory) -> Situacao:
    global _cache
    if _cache and time.monotonic() - _cache[0] < _CACHE_SEGUNDOS:
        return _cache[1]
    async with db_factory() as db:
        situacao = await situacao_atual(db)
        await db.commit()
    _cache = (time.monotonic(), situacao)
    return situacao
