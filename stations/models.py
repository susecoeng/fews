import pytz

from django.db import models
from django.db.models import F


from .common import getLocalTime

from django.utils import timezone


# Create your models here.

# class Province(models.Model):
#     name=models.CharField(max_length=255)

# class District(models.Model):
#     province=models.ForeignKey(Province,on_delete=models.CASCADE)
#     name=models.CharField(max_length=255)


class District(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)

    def __str__(self):
        return self.name


class Station(models.Model):
    id = models.AutoField(primary_key=True)
    water_station = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    reach_id = models.IntegerField()
    lat = models.FloatField()
    lon = models.FloatField()
    district = models.ForeignKey(District, on_delete=models.CASCADE)
    station_update = models.CharField(max_length=2,  default='y')
    first_warning = models.IntegerField()
    second_warning = models.IntegerField()
    station_URL = models.CharField(max_length=255, default='malawi.cbfews.com')
    low_level = models.IntegerField(default=0)
    higer_level = models.IntegerField(default=0, verbose_name='high level')
    coeff_c = models.FloatField(
        default=0.0, verbose_name='discharge coefficient (C)')
    section_b = models.FloatField(
        default=0.0, verbose_name='section hydrograph (b)')
    qc_level = models.IntegerField(
        verbose_name='threshold value')  # threshold value
    alert_interval = models.IntegerField(
        verbose_name='alert interval in minutes', null=True)
    station_height = models.IntegerField()
    gprs_APN = models.CharField(max_length=255, default='internet')
    gprs_user = models.CharField(max_length=100, default='myName')
    gprs_password = models.CharField(max_length=100, default='myPass')
    gprs_filter = models.CharField(max_length=20, default='1')

    def __str__(self):
        return self.water_station + ' - ' + self.name

    # def __str__(self):
    #     return self.waterStation + ' - ' + str(self.stationHeight) + ' - ' + str(self.firstWarn) + ' - ' + str(self.secondWarn) + ' - ' + str(self.stationIP) + ' - ' + str(self.stationUpdate)


class StationData(models.Model):
    id = models.BigAutoField(primary_key=True)
    station = models.ForeignKey(Station, on_delete=models.CASCADE)
    packetID = models.IntegerField()
    receivedDate = models.DateTimeField()
    depthValue = models.FloatField()
    rainfall = models.FloatField()
    wf = models.IntegerField()
    wdate = models.DateField(default='2010-01-01')
    wTime = models.TimeField(default='00:00')
    # Dont use if it is spike. 0-not spike, 1-spike
    isSpike = models.IntegerField(default=0)
    # Only display after processing. 0-not processed, 1-processed
    isProcessed = models.IntegerField(default=0)
    last_alert_time = models.DateTimeField(null=True, blank=True)
    alert_status = models.CharField(max_length=255)

    def depth_Value(self):
        if self.depthValue == -999:
            return 'N/A'
        else:
            return self.depthValue

    def received_date(self):
        local_dt = getLocalTime(self.receivedDate)
        return local_dt.date()

    def received_time(self):
        local_dt = getLocalTime(self.receivedDate)
        return local_dt.time()

    def __str__(self):
        local_dt = getLocalTime(self.receivedDate)
        return self.station.water_station + ' - ' + str(local_dt) + ' - ' + str(self.receivedDate.time())


class Alram(models.Model):
    id = models.AutoField(primary_key=True)
    alram_station = models.CharField(max_length=255)
    name = models.CharField(max_length=255)
    lat = models.FloatField()
    lon = models.FloatField()
    active_on = models.DateTimeField()

    def active_date(self):
        local_dt = getLocalTime(self.active_on)
        return local_dt.date()

    def active_time(self):
        local_dt = getLocalTime(self.active_on)
        return local_dt.time()

    def __str__(self):
        local_dt = getLocalTime(self.active_on)
        # + ' - ' + str(local_dt)
        return self.alram_station + ' - ' + self.name


class AlramData(models.Model):
    id = models.AutoField(primary_key=True)
    alram = models.ForeignKey(Alram, on_delete=models.CASCADE)
    siren_triggered_at = models.DateTimeField()

    def siren_triggered_date(self):
        local_dt = getLocalTime(self.siren_triggered_at)
        return local_dt.date()

    def siren_triggered_time(self):
        local_dt = getLocalTime(self.siren_triggered_at)
        return local_dt.time()

    def __str__(self):
        local_dt = getLocalTime(self.siren_triggered_at)
        return self.alram.alram_station + ' - ' + str(local_dt) + ' - ' + str(self.siren_triggered_at.time())


class Subscriber(models.Model):
    id = models.AutoField(primary_key=True)
    name = models.CharField(max_length=255)
    email = models.CharField(max_length=255, null=True, blank=True)
    mobile = models.BigIntegerField(blank=True, null=True)
    country = models.CharField(max_length=255)

    def __str__(self):
        return self.name + ' - ' + str(self.email) + ' - ' + str(self.mobile)
