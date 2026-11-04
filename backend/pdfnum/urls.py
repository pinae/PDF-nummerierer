from django.urls import include, path

from . import views

urlpatterns = [
    path("api/health/", views.health, name="health"),
    path("api/csrf/", views.csrf, name="csrf"),
    path("api/documents/", include("documents.urls")),
    path("api/configs/", include("configs.urls")),
    path("api/fonts/", include("configs.font_urls")),
]
