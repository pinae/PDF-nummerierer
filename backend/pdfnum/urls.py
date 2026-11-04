from django.urls import include, path

from generation import views as generation_views

from . import views

urlpatterns = [
    path("api/health/", views.health, name="health"),
    path("api/csrf/", views.csrf, name="csrf"),
    path(
        "api/documents/<uuid:document_id>/generate/",
        generation_views.GenerateView.as_view(),
        name="generate",
    ),
    path("api/documents/", include("documents.urls")),
    path("api/jobs/", include("generation.urls")),
    path("api/configs/", include("configs.urls")),
    path("api/fonts/", include("configs.font_urls")),
]
