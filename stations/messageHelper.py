
import requests
import json
from django.conf import settings
from django.http import HttpResponse
from django.core.mail import EmailMessage
from django.template.loader import render_to_string
from smtplib import SMTPException


def sendSMS(txtSend, to, country):
    if(country == 'Nepal'):
        sendSparrowSMS(txtSend, to)
    elif(country == 'Malawi'):
        sendMalawiSMS(txtSend, to)


def sendSparrowSMS(txtSend, to):
    r = requests.post(
        "http://api.sparrowsms.com/v2/sms/",
        data={'token': settings.SPARROW_TOKEN,
              'from': 'InfoSMS',
              'to': to,
              'text': txtSend})

    status_code = r.status_code
    response = r.text
    response_json = r.json()


def sendMalawiSMS(txtSend, to):

    # requests.add_header("Authorization", settings.MALAWI_TOKEN)
    # requests.add_header("Content-Type", "application/json")
    headers = {
        'Authorization': settings.MALAWI_TOKEN,
        'Content-Type': 'application/json'}

    # r = requests.post(url, data=json.dumps(data), headers=headers)
    data = {
        'from':  'Flood Alert',
        'to': to,
        'message': txtSend
    }

    r = requests.post(
        "http://206.225.81.36:8989/api/messaging/sendsms",
        data=json.dumps(data),
        headers=headers
    )

    # status_code = r.status_code
    # response = r.text
    # response_json = r.json()
    print(r)


def sendEmail(emailid, subject, msg):

    to = [emailid]
    from_email = settings.EMAIL_HOST_USER

    try:
        EmailMessage(subject, msg, to=to, from_email=from_email).send()
        print('Email sent successfully.')
    except SMTPException as e:
        print('There was an error sending an email: ', e)
