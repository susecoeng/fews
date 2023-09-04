import datetime
import pytz

from django.db.models import F
from django.db.models import Q

from django.shortcuts import render
from .models import Station, StationData, District
from django.http import HttpResponse, JsonResponse
from django.core import serializers
from django.http import JsonResponse

from django.conf import settings
from .common import getLocalTime


def getData(request):
    st = request.GET.get('ID')
    fromDate = request.GET.get('fromDate')
    toDate = request.GET.get('toDate')

    time_zone = pytz.timezone(settings.TIME_ZONE)
    fd = datetime.datetime.strptime(fromDate, '%Y-%m-%d')
    td = datetime.datetime.strptime(toDate, '%Y-%m-%d')
    fd = time_zone.localize(fd)
    fd = fd.astimezone(pytz.utc)

    td = time_zone.localize(td)
    td = td.astimezone(pytz.utc)

    if(fromDate == toDate):
        toDate += "T23:59:59.999999"
        td += datetime.timedelta(hours=23, minutes=59, seconds=59.9999)

    # 'wdate','wTime',
    data = StationData.objects.filter(station__water_station=st, isProcessed=1, receivedDate__range=[fd, td]) \
        .values('receivedDate', 'depthValue', 'rainfall', 'isSpike') \
        .annotate(stnid=F('station__water_station')) \
        .order_by('receivedDate__hour', 'receivedDate__minute')

    # wrap in list(), because QuerySet is not JSON serializable
    data = list(data)
    return JsonResponse(data, safe=False)


def getLatestData(request):
    fromDate = request.GET.get('fromDate')

    time_zone = pytz.timezone(settings.TIME_ZONE)
    fd = datetime.datetime.strptime(fromDate, '%Y-%m-%d')
    td = datetime.datetime.strptime(fromDate, '%Y-%m-%d')

    fd = time_zone.localize(fd)
    fd = fd.astimezone(pytz.utc)

    td = time_zone.localize(td)
    td = td.astimezone(pytz.utc)
    td += datetime.timedelta(hours=23, minutes=59, seconds=59.9999)

    data = StationData.objects.filter(isProcessed=1, receivedDate__range=[fd, td]) \
        .values('receivedDate', 'depthValue', 'rainfall', 'isSpike') \
        .order_by('station__water_station', '-receivedDate') \
        .distinct('station__water_station') \
        .annotate(stnid=F('station__water_station'))

    data = list(data)
    return JsonResponse(data, safe=False)
