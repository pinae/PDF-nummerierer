from django.apps import AppConfig


class GenerationConfig(AppConfig):
    name = "generation"
    default_auto_field = "django.db.models.BigAutoField"

    def ready(self) -> None:
        from . import signals  # noqa: F401
