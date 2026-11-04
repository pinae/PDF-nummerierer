from django.core.management.base import BaseCommand

from generation import cleanup


class Command(BaseCommand):
    help = "Delete expired uploads, outputs, sessions and leftovers; fail interrupted jobs."

    def handle(self, *args, **options):
        result = cleanup.run()
        self.stdout.write(
            f"Removed {result.documents} expired document(s), "
            f"{result.orphaned_files} orphaned file(s) and {result.temp_files} temporary "
            f"file(s); marked {result.interrupted_jobs} job(s) as interrupted."
        )
