from django.apps import AppConfig


class ApiConfig(AppConfig):
    name = 'api'

    def ready(self):
        # Connect the "every new Business gets a default branch" receiver.
        from .business import signals  # noqa: F401
        # Structural guard: fails `manage.py check` (and CI) if an endpoint is
        # added without business scoping — api.E001.
        from . import checks  # noqa: F401
