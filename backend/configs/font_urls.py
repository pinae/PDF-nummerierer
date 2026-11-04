from django.urls import path

from . import views

urlpatterns = [
    path("", views.FontListView.as_view(), name="fonts"),
    path("<slug:font_id>.ttf", views.FontFileView.as_view(), name="font-file"),
]
