import datetime as dt
import os

import pytest
from django.core.files.base import ContentFile
from django.utils import timezone

from documents.models import Document

pytestmark = pytest.mark.django_db


def make_document(owner="owner-a", age=dt.timedelta(0)) -> Document:
    document = Document(owner=owner, name="exam.pdf", size=3, page_count=1, page_sizes=[[1, 1]])
    document.file.save("ignored.pdf", ContentFile(b"pdf"), save=True)
    if age:
        Document.objects.filter(pk=document.pk).update(created_at=timezone.now() - age)
        document.refresh_from_db()
    return document


def test_file_is_removed_with_the_row():
    document = make_document()
    path = document.file.path

    document.delete()

    assert not os.path.exists(path)


def test_file_is_removed_on_bulk_delete():
    paths = [make_document().file.path for _ in range(2)]

    Document.objects.all().delete()

    assert not any(os.path.exists(p) for p in paths)


def test_expires_at_follows_the_retention_setting(settings):
    settings.PDFNUM_RETENTION_SECONDS = 60

    document = make_document()

    assert document.expires_at - document.created_at == dt.timedelta(seconds=60)


def test_owned_by_excludes_other_owners_and_expired_documents():
    mine = make_document("me")
    make_document("someone-else")
    make_document("me", age=dt.timedelta(hours=3))

    assert list(Document.objects.owned_by("me")) == [mine]


def test_purge_expired():
    fresh = make_document()
    old = make_document(age=dt.timedelta(hours=3))

    removed = Document.objects.purge_expired()

    assert removed == 1
    assert list(Document.objects.all()) == [fresh]
    assert not os.path.exists(old.file.path)
