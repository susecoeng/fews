#from django.shortcuts import render
# from _typeshed import NoneType
from django.views import generic
from django.views.generic.edit import CreateView, UpdateView, DeleteView
from django.urls import reverse_lazy

from django.shortcuts import render
from .models import Station, StationData, District, Subscriber
from .models import Alram, AlramData

from django.http import HttpResponse, JsonResponse
from django.core import serializers
# from rest_framework import viewsets
# from .serializer import StationSerializer


import datetime
from .common import getLocalTime
from django.template import loader

from .messageHelper import *

# Create your views here.


def IndexView(request):
    #template_name = 'stations/index.html'
    return render(request, 'stations/index.html')


def StInfoMalawi(request):
    return render(request, 'stations/stInfoMalawi.html')


# return all stations
def getStations(request):
    stns = Station.objects.all().order_by('name')
    data = serializers.serialize('json', stns, fields=(
        'water_station', 'name', 'lat', 'lon', 'district', 'first_warning', 'second_warning', 'station_height', 'low_level', 'higer_level', 'coeff_c', 'section_b', 'reach_id'))
    return HttpResponse(data, content_type='application/json')
    # return JsonResponse(data)


# return all districts
def getDistricts(request):
    dist = District.objects.all()
    data = serializers.serialize('json', dist)
    return HttpResponse(data, content_type='application/json')

# post siren status


def PostAlramData(request):
    alramID = request.GET.get('ID')
    alramStatus = int(request.GET.get('Status'))
    curDate = datetime.datetime.now()

    if(alramStatus == 0):
        Alram.objects.filter(alram_station=alramID).update(active_on=curDate)
    else:
        alm = Alram.objects.get(alram_station=alramID)
        alramData = AlramData(
            alram=alm,
            siren_triggered_at=curDate
        )
        alramData.save()

    return HttpResponse('Alram sucessfully saved', content_type='application/json')

# post data from station to database


def PostData(request):
    stationID = request.GET.get('stID')
    pktID = int(request.GET.get('pktID'))
    depth = float(request.GET.get('dptValue'))
    rfall = float(request.GET.get('rainFall'))
    # wF=int(request.GET.get('wF'))
    curDate = datetime.datetime.now()

    # Blog.objects.get(name="Cheddar Talk")
    s = Station.objects.get(water_station=stationID)

    sd = StationData(
        station=s,
        packetID=pktID,
        receivedDate=curDate,
        depthValue=depth,
        rainfall=rfall,
        wf=0,
        wdate=curDate.date(),
        wTime=curDate.time(),
        isSpike=0,
        isProcessed=0
    )

    if(sd.depthValue == -999):
        sd.isProcessed = 1

    # https://docs.djangoproject.com/en/3.1/topics/db/queries/
    sdExist = StationData.objects.filter(station__water_station=stationID, wdate=sd.wdate,
                                         packetID=sd.packetID, depthValue=sd.depthValue, rainfall=sd.rainfall)

    html = ''
    if sdExist:
        html = s.name + " already exists"
    else:
        sd.save()
        html = s.name + " successfully received"
        # process QC
        processQC(stationID)
        # notify(stationID)

    return HttpResponse(html, content_type='application/json')
    # return HttpResponse(html + "Data <h1>" + s.name + "</h1>")


def processQC(stationID):
    curDate = datetime.datetime.now()
    stn = Station.objects.get(water_station=stationID)
    data = StationData.objects.filter(station__water_station=stationID, isSpike=0).exclude(depthValue=-999) \
        .order_by('-receivedDate', '-receivedDate__hour', '-receivedDate__minute')[:2]

    curObj = StationData(
        id=data[0].id,
        station=None,
        packetID=data[0].packetID,
        receivedDate=data[0].receivedDate,
        depthValue=data[0].depthValue,
        rainfall=data[0].rainfall,
        wf=data[0].wf,
        wdate=data[0].wdate,
        wTime=data[0].wTime,
        isSpike=data[0].isSpike,
        isProcessed=data[0].isProcessed,
        last_alert_time=data[0].last_alert_time,
        alert_status=''
    )

    # check if the data is betwen lower and higher water limit
    if((data[0].depthValue > stn.higer_level or data[0].depthValue < stn.low_level) and data[0] != -999):

        StationData.objects.filter(id=data[0].id).update(
            isSpike=1, isProcessed=1, alert_status='Limit Check')

        curObj.alert_status = 'Limit Check'

        # notify Email only
        print('spike - Limit Check failed')

        notifyEmail(stn, curObj)
        return 200

    # check if the data is within threshold value
    if(data.count() == 2):
        print(data[0])
        print(data[1])
        # Hide value x if: x – (x-1) > threshold value (time difference between x and x-1 must be < 10 mins)
        # dt = data[1].receivedDate-data[2].receivedDate
        # if(dt.seconds/60 <= 10):
        x = abs(data[0].depthValue-data[1].depthValue)
        print('x='+str(x))
        if(x >= stn.qc_level):
            StationData.objects.filter(id=data[0].id).update(
                isSpike=1, isProcessed=1, alert_status='Step Check')

            # notify email & sms
            curObj.alert_status = 'Step Check'
            print('Step check failed')
            notifyEmail(stn, curObj)
            # notifySMS(stn, curObj) - edit on 9/14/2021- removed due to msg flood as requested
        else:
            print('not spike')
            print(data[0].depthValue)
            StationData.objects.filter(id=data[0].id).update(
                isSpike=0, isProcessed=1)
    else:
        # very first data
        StationData.objects.filter(id=data[0].id).update(
            isSpike=0, isProcessed=1)

    # check for warning check
    if(data[0].depthValue >= stn.second_warning):
        # StationData.objects.filter(id=data[0].id).update(
        #     alert_status='Warning Check')

        _waring = StationData.objects.filter(station__water_station=stationID, isSpike=0, alert_status='Warning Check') \
            .order_by('-last_alert_time')[:1]
        _isNotify = True
        if(_waring.count() == 1):
            # print('Last warning found at')
            # print(_waring[0].last_alert_time)

            # if(_waring[0].last_alert_time == None):
            #     print('Last warning time is None')
            #     StationData.objects.filter(id=data[0].id).update(
            #         last_alert_time=curDate, alert_status='Warning Check')
            # else:
            # print('receivedDate')
            # print(data[0].receivedDate)
            duration = data[0].receivedDate - _waring[0].last_alert_time
            duration = duration.seconds/60
            # print("Duration")
            # print(duration)
            # print(stn.alert_interval)
            if(duration <= stn.alert_interval):
                _isNotify = False
                StationData.objects.filter(id=data[0].id).update(
                    last_alert_time=_waring[0].last_alert_time, alert_status='Warning Check')
                # print('notify false')
            else:
                StationData.objects.filter(id=data[0].id).update(
                    last_alert_time=curDate, alert_status='Warning Check')
                # print('notify true')
        else:
            print('Very first warning')
            StationData.objects.filter(id=data[0].id).update(
                last_alert_time=curDate, alert_status='Warning Check')

        # notify email & sms
        if(_isNotify):
            curObj.alert_status = 'Warning Check'
            print('Warning notify')
            notifyEmail(stn, curObj)
            notifySMS(stn, curObj)

        return 200

    # check for alert check
    if(data[0].depthValue >= stn.first_warning):
        # StationData.objects.filter(id=data[0].id).update(
        #     alert_status='Alert Check')
        _alert = StationData.objects.filter(
            station__water_station=stationID, isSpike=0, alert_status='Alert Check') \
            .order_by('-last_alert_time')[:1]
        _isNotify = True
        if(_alert.count() == 1):

            # if(_alert[0].last_alert_time == None):
            #     StationData.objects.filter(id=data[0].id).update(
            #         last_alert_time=curDate)
            # else:
            duration = data[0].receivedDate - _alert[0].last_alert_time
            duration = duration.seconds/60
            if(duration <= stn.alert_interval):
                _isNotify = False
                StationData.objects.filter(id=data[0].id).update(
                    last_alert_time=_alert[0].last_alert_time, alert_status='Alert Check')
            else:
                StationData.objects.filter(id=data[0].id).update(
                    last_alert_time=curDate, alert_status='Alert Check')
        else:
            StationData.objects.filter(id=data[0].id).update(
                last_alert_time=curDate, alert_status='Alert Check')

        # notify email & sms
        if(_isNotify):
            curObj.alert_status = 'Alert Check'
            print('Alert notify')
            notifyEmail(stn, curObj)
            notifySMS(stn, curObj)

    return 200  # success


# def processQC_3(stationID):
#     stn = Station.objects.get(water_station=stationID)
#     data = StationData.objects.filter(station__water_station=stationID, isSpike=0) \
#         .order_by('-receivedDate__hour', '-receivedDate__minute')[:3]

#     # check if the data is betwen lower and higher water limit
#     if(data[0].depthValue > stn.higer_level or data[0].depthValue < stn.low_level):
#         StationData.objects.filter(id=data[0].id).update(
#             isSpike=1, isProcessed=1)
#         print('spike')
#         return

#     # check if the data is within threshold value
#     print(data.count())
#     if(data.count() == 3):
#         # Hide value x if: x – (x-1) > threshold value (time difference between x and x-1 must be < 10 mins)
#         # dt = data[1].receivedDate-data[2].receivedDate
#         # if(dt.seconds/60 <= 10):
#         x1 = data[0].depthValue-data[1].depthValue
#         x2 = data[1].depthValue-data[2].depthValue
#         v = abs(x2-x1)

#         if(v >= 2*stn.qc_level):
#             StationData.objects.filter(id=data[1].id).update(
#                 isSpike=1, isProcessed=1)
#         else:
#             StationData.objects.filter(id=data[1].id).update(
#                 isSpike=0, isProcessed=1)

#     return 200  # success

# def notify(stationID):
#     stn = Station.objects.get(water_station=stationID)
#     data = StationData.objects.filter(station__water_station=stationID, isSpike=0, isProcessed=1) \
#         .order_by('-receivedDate', '-receivedDate__hour', '-receivedDate__minute')[:1]

#     curDate = datetime.datetime.now()

#     if(data[0].depthValue >= stn.first_warning):
#         # email notification
#         for email_subs in Subscriber.objects.filter(email__isnull=False):
#             try:
#                 sendEmail(email_subs.name, email_subs.email, data[0].depthValue,
#                           str(curDate), stationID, stn.first_warning)
#                 # print('email send successfully')
#             except SMTPException as e:
#                 print('There was an error sending an email: ', e)
#                 # pass

#         # sms notification
#         for sms_subs in Subscriber.objects.filter(mobile__isnull=False):
#             try:
#                 sms = 'test- Water level ('+str(data[0].depthValue) + \
#                     ')raised above warning level. ' + str(curDate)
#                 sendSMS(sms, sms_subs.mobile)
#                 print('sms sent successfully')
#             except Exception as e:
#                 print('There was an error sending an sms: ', e)
#                 # pass


def notifyEmail(stn, stndata):

    # http://malawi.cbfews.com/admin/stations/station/41/change/
    url = 'http://' + \
        settings.ALLOWED_HOSTS[0] + \
        '/admin/stations/stationdata/'+str(stndata.id)+'/change/'
    local_dt = getLocalTime(stndata.receivedDate).strftime("%Y-%m-%d %H:%M")
    subject = ''
    message = ''

    if(stndata.alert_status == 'Warning Check'):
        subject = "WARNING!!! Water depth has gone higher at " + stn.name
        message = render_to_string('notify/email_warning.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
            'url': url,
            'wrn': stn.second_warning
        })
    elif (stndata.alert_status == 'Alert Check'):
        subject = "Alert!!! Water depth has gone higher at " + stn.name
        message = render_to_string('notify/email_alert.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
            'url': url,
            'wrn': stn.first_warning
        })
    elif (stndata.alert_status == 'Limit Check'):
        subject = "LIMIT check failure !!! at " + stn.name
        message = render_to_string('notify/email_limit.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
            'url': url
        })
    elif (stndata.alert_status == 'Step Check'):
        subject = "STEP check failure !!! at " + stn.name
        message = render_to_string('notify/email_step.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
            'url': url
        })

    for email_subs in Subscriber.objects.filter(email__isnull=False):
        sendEmail(email_subs.email, subject, message)


def notifySMS(stn, stndata):

    local_dt = getLocalTime(stndata.receivedDate).strftime("%Y-%m-%d %H:%M")
    message = ''

    if(stndata.alert_status == 'Warning Check'):
        message = render_to_string('notify/sms_warning.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
            'wrn': stn.second_warning
        })
    elif (stndata.alert_status == 'Alert Check'):
        message = render_to_string('notify/sms_alert.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
            'wrn': stn.first_warning
        })
    elif (stndata.alert_status == 'Limit Check'):
        message = render_to_string('notify/sms_limit.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
        })
    elif (stndata.alert_status == 'Step Check'):
        message = render_to_string('notify/sms_step.txt', {
            'depth': stndata.depthValue,
            'time': local_dt,
            'stID': stn.name,
        })

    for sms_subs in Subscriber.objects.filter(mobile__isnull=False):
        try:
            sendSMS(message, sms_subs.mobile, sms_subs.country)
            # print('sms sent successfully')
        except Exception as e:
            print('There was an error sending an sms: ', e)
            # pass


def stationDetail(request):
    template = loader.get_template('stations/station.html')
    context = {
        'waterStation': 'na',
        'stationUpdate': 'na',
        'firstWarn': 'na',
        'secondWarn': 'na',
        'stationIP': 'na',
        'stationHeight': 'na',
        'gprsAPN': 'na',
        'gprsUser': 'na',
        'gprsPass': 'na',
        'gprsFilter': 'na'
    }

    stnid = (request.GET.get('stID'))
    msg = (request.GET.get('msg'))

    if msg == 'on':
        if(str(Station.objects.get(water_station=stnid).station_update) == 'y'):
            stn = Station.objects.get(water_station=stnid)
            context = {
                'waterStation': stn.water_station,
                'stationUpdate': stn.station_update,
                'firstWarn': stn.first_warning,
                'secondWarn': stn.second_warning,
                'stationIP':  stn.station_URL,
                'stationHeight': stn.station_height,
                'gprsAPN': stn.gprs_APN,
                'gprsUser': stn.gprs_user,
                'gprsPass': stn.gprs_password,
                'gprsFilter': stn.gprs_filter
            }
    else:
        Station.objects.filter(water_station=stnid).update(station_update='n')

    return HttpResponse(template.render(context, request))
