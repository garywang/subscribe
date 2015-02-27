#!/usr/bin/env python2
#
# Webathena-Moira Post Office Box interface, a mostly-RESTful API.
#
# Background:
#
# All actions are authenticated. Every request must include a cookie (in this
# case, named "mailto-session") containing the JSON-encoded value of the
# "session" attribute returned by Webathena. Inside of this credential should
# reside a Moira ticket (moira/moira7.mit.edu@ATHENA.MIT.EDU).
#
# Endpoints:
#
# GET /<user>
# List <user>'s post office boxes, including both current ones and disabled ones
# that we can find out about. Return the pobox status as a dictionary:
#  - boxes: a list of dictionaries, each containing:
#     - address: the pobox represented as an email address
#     - type: the type of box, either "IMAP", "EXCHANGE" or "SMTP"
#     - enabled: a boolean value, true iff mail is being sent to this pobox
#  - modtime: the time of the last modification, in ISO 8601 format
#  - modby: the username of the person who performed the modification
#  - modwith: the tool used to modify the settings
#
# PUT /<user>/<address>
# Set <address> as <user>'s only post office box. Return the updated list of
# poboxes in the same format as the GET call.
#
# PUT /<user>/<internal>/<external>
# Set <internal> as <user>'s internal post office box and <external> as the
# external forwarder. The internal pobox must be of type IMAP or EXCHANGE, and
# the external pobox must be of type SMTP. Return the updated list of poboxes in
# the same format as the GET call.
#
# PUT /<user>/reset
# Reset <user>'s post office box settings using the set_pobox_pop query. Return
# the updated list of poboxes in the same format as the GET call.
#

import moira
import os
import re
import zephyr

from bottle import get, put, delete, abort, request
from bottle_webathena import *
from datetime import datetime

APP_ROOT = os.path.abspath(os.path.dirname(__file__))

MN = "subscribe" # this application's name, for Moira modwith


@get("/public_lists")
#@webathena
@moira_unauth
@json_api
def get_public_lists():
    lists = moira.query("qgli", "true", "true", "false", "true", "dontcare")
    return [l['list'] for l in lists]

@put("/list/<list_name>/<user>")
@webathena
@moira_auth(MN)
@json_api
def subscribe(list_name, user):
    try:
        zephyr._z.initialize()
        zephyr._z.openPort()
        zephyr.ZNotice(cls='subscribe-auto', instance='subscribe', message=list_name, auth=False, sender=user, opcode='AUTO').send()
    except e:
        pass
    try:
        moira.query("amtl", list_name, "USER", user)
        return {"msg": "Subscribed to " + list_name + "@mit.edu",
                "status": "success"}
    except moira.MoiraException as e:
        if len(e.args) >= 2 and e[1].lower() == "record already exists":
            return {"msg": "Already subscribed to " + list_name + "@mit.edu",
                    "status": "info"}
        raise e

@delete("/list/<list_name>/<user>")
@webathena
@moira_auth(MN)
@json_api
def unsubscribe(list_name, user):
    moira.query("dmfl", list_name, "USER", user)
    return ""

if __name__ == "__main__":
    import bottle
    from flup.server.fcgi import WSGIServer
    bottle.debug(True) # TODO: disable this
    app = bottle.default_app()
    WSGIServer(app).run()
