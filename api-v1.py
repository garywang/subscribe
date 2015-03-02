#!/usr/bin/env python2
#
# Webathena-Moira interface, a mostly-RESTful API.
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
# GET /public_lists
# List all public visible mailing lists, as an array of strings.
#
# PUT /list/<list_name>/<user>
# Add <user> to <list_name>.
#
# DELETE /list/<list_name>/<user>
# Remove <user> from <list_name>.
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
        # We can't call zephyr.init() because we're not authed
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
