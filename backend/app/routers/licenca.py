from datetime import timedelta

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.dependencies.auth import get_current_user
from app.models.usuario import Usuario
from app.services.licenca_service import (
    DIAS_VALIDADE_PADRAO,
    ChaveInvalida,
    ativar_chave,
    calcular_situacao,
    situacao_atual,
)
from app.utils.tempo import hoje_local

router = APIRouter()


class AtivarChaveIn(BaseModel):
    chave: str


@router.get("/status")
async def status_licenca(
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    if not get_settings().licenca_obrigatoria:
        # Dev/E2E: sem aviso nem bloqueio
        hoje = hoje_local()
        return calcular_situacao(hoje + timedelta(days=DIAS_VALIDADE_PADRAO), hoje, None, sem_chave=False).como_dict()
    return (await situacao_atual(db)).como_dict()


@router.post("/ativar")
async def ativar_licenca(
    dados: AtivarChaveIn,
    db: AsyncSession = Depends(get_db),
    _: Usuario = Depends(get_current_user),
):
    """Qualquer usuário logado pode colar a chave: ela é assinada, então não
    há como inventar uma — e quem está no balcão é quem vê o bloqueio."""
    try:
        return (await ativar_chave(db, dados.chave)).como_dict()
    except ChaveInvalida as e:
        raise HTTPException(status_code=400, detail=str(e))
