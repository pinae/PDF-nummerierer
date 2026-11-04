from django.urls import path

from . import views

urlpatterns = [
    path("<uuid:job_id>/", views.JobView.as_view(), name="job"),
    path("<uuid:job_id>/download/", views.JobDownloadView.as_view(), name="job-download"),
]
