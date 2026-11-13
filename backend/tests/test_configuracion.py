import os
import unittest
from unittest.mock import patch

from app.config import load_settings


class TestConfiguracion(unittest.TestCase):
    def tearDown(self):
        load_settings.cache_clear()

    def test_normaliza_origenes_y_configura_s3(self):
        with patch.dict(os.environ, {
            "ECORAEE_CORS_ORIGINS": " https://app.example , https://admin.example ",
            "ECORAEE_STORAGE": "s3",
            "ECORAEE_S3_BUCKET": "evidencias-prod",
            "ECORAEE_DB_MAX_OVERFLOW": "0",
        }):
            load_settings.cache_clear()
            settings = load_settings()

        self.assertEqual(settings.cors_origins, ("https://app.example", "https://admin.example"))
        self.assertEqual(settings.storage_mode, "s3")
        self.assertEqual(settings.s3_bucket, "evidencias-prod")
        self.assertEqual(settings.db_max_overflow, 0)

    def test_rechaza_modo_de_almacenamiento_desconocido(self):
        with patch.dict(os.environ, {"ECORAEE_STORAGE": "filesystem"}, clear=False):
            load_settings.cache_clear()
            with self.assertRaisesRegex(RuntimeError, "ECORAEE_STORAGE"):
                load_settings()

    def test_exige_bucket_para_s3(self):
        variables = os.environ.copy()
        variables["ECORAEE_STORAGE"] = "s3"
        variables.pop("ECORAEE_S3_BUCKET", None)
        with patch.dict(os.environ, variables, clear=True):
            load_settings.cache_clear()
            with self.assertRaisesRegex(RuntimeError, "ECORAEE_S3_BUCKET"):
                load_settings()


if __name__ == "__main__":
    unittest.main()
