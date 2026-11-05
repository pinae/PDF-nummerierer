from django.urls import path

from . import views

urlpatterns = [
    path("", views.DocumentCollectionView.as_view(), name="documents"),
    path("<uuid:document_id>/", views.DocumentDetailView.as_view(), name="document"),
    path("<uuid:document_id>/file/", views.DocumentFileView.as_view(), name="document-file"),
    path(
        "<uuid:document_id>/keepalive/",
        views.DocumentKeepAliveView.as_view(),
        name="document-keepalive",
    ),
]
