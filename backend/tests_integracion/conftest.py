"""Cargar configuracion antes de evaluar las marcas skipif de los modulos."""
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env")
