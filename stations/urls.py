from django.urls import path
from . import views, views_waterlevel

urlpatterns = [
    # /music/
    path('', views.IndexView, name='index'),
    path('stInfoMalawi/', views.StInfoMalawi, name='stInfoMalawi'),
    path('postAlramData/', views.PostAlramData, name='postAlramData'),
    path('postData/', views.PostData, name='postData'),
    path('stationDetail/', views.stationDetail, name='stationDetail'),
    path('getDistricts/', views.getDistricts, name='getDistricts'),
    path('getStations/', views.getStations, name='getStations'),
    path('getStationData/', views_waterlevel.getData, name='getData'),
    path('getLatestData/', views_waterlevel.getLatestData, name='getLatestData')

]
