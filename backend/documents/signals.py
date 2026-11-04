from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import Document


@receiver(post_delete, sender=Document)
def delete_file(sender, instance: Document, **kwargs) -> None:
    """Remove the PDF from disk whenever its row goes, also on bulk deletes."""
    if instance.file:
        instance.file.delete(save=False)
