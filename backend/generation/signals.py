from django.db.models.signals import post_delete
from django.dispatch import receiver

from .models import GenerationJob


@receiver(post_delete, sender=GenerationJob)
def delete_output(sender, instance: GenerationJob, **kwargs) -> None:
    if instance.output:
        instance.output.delete(save=False)
