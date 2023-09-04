import pytz
from datetime import datetime
from django.utils import timezone
from django.conf import settings

def convert_to_localtime(utctime):
    # fmt = '%d/%m/%Y %H:%M'
    utc = utctime.replace(tzinfo=pytz.UTC)
    localtz = utc.astimezone(timezone.get_current_timezone())
    return localtz #.strftime(fmt)

def getLocalTime(utctime):
    local_dt = timezone.localtime(utctime, pytz.timezone(settings.TIME_ZONE))
    return local_dt
