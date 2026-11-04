from django.urls import path

from . import views

urlpatterns = [
    path("", views.ConfigCollectionView.as_view(), name="configs"),
    path("<uuid:config_id>/", views.ConfigDetailView.as_view(), name="config"),
    path("<uuid:config_id>/versions/", views.ConfigVersionsView.as_view(), name="config-versions"),
]
