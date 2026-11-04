import pytest
from django.core.management import call_command


@pytest.mark.django_db
def test_every_model_change_has_a_migration():
    call_command("makemigrations", "--check", "--dry-run", verbosity=0)
