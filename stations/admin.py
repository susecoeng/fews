from django.contrib import admin
from rangefilter.filter import DateRangeFilter, DateTimeRangeFilter
from .models import Station, StationData, District
from .models import Alram, AlramData
from .models import Subscriber

import datetime


class StationDataAdmin(admin.ModelAdmin):
    ordering = ('-wdate', '-wTime')
    list_display = ('station', 'received_date', 'received_time',
                    'depth_Value', 'rainfall', 'isSpike', 'isProcessed', 'last_alert_time', 'alert_status')
    search_fields = ('station__water_station', 'station__name')
    list_filter = (('wdate', DateRangeFilter), 'isSpike',
                   'isProcessed', 'alert_status')

    # def get_rangefilter_wdate_default(self, request):
    #     return (datetime.date.today, datetime.date.today)

    def get_rangefilter_wdate_title(self, request, field_path):
        return 'Received Date'


class AlramAdmin(admin.ModelAdmin):
    list_display = ('alram_station', 'name', 'active_date', 'active_time')


class AlramDataAdmin(admin.ModelAdmin):
    ordering = ['-siren_triggered_at']
    list_display = ('alram', 'siren_triggered_date', 'siren_triggered_time')
    search_fields = ('alram__alram_station', 'alram__name')
    list_filter = (('siren_triggered_at', DateRangeFilter),)

    # If you would like to add a default range filter
    # method pattern "get_rangefilter_{field_name}_default"
    # def get_rangefilter_siren_triggered_at_default(self, request):
    #     return (datetime.date.today, datetime.date.today)

    # If you would like to change a title range filter
    # method pattern "get_rangefilter_{field_name}_title"
    def get_rangefilter_siren_triggered_at_title(self, request, field_path):
        return 'Siren Triggered Date'


class SubscriberAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'mobile')
    search_fields = ('name', 'email', 'mobile')


class SMSSettingAdmin(admin.ModelAdmin):
    list_display = ('name', 'url', 'access_token', 'sms_from')


# Register your models here.
admin.site.register(District)
admin.site.register(Station)
admin.site.register(StationData, StationDataAdmin)
admin.site.register(Alram, AlramAdmin)
admin.site.register(AlramData, AlramDataAdmin)
admin.site.register(Subscriber, SubscriberAdmin)
