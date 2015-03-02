(function() {
    var WEBATHENA_HOST = "https://webathena.mit.edu";
    var REALM = "ATHENA.MIT.EDU";
    var PRINCIPAL = [ "moira", "moira7.mit.edu" ];

    var TICKET_LABEL = "webathena"; // name in storage and in GET data

    var LOGIN_ACTION = "Log In with Webathena";
    var LOGIN_ONGOING = "Logging In...";

    var SUBSCRIBE_ACTION = "Subscribe";
    var SUBSCRIBE_ONGOING = "Subscribing...";

    var RANDOM_ACTION = "I'm Feeling Lucky";
    var RANDOM_ONGOING = SUBSCRIBE_ONGOING;

    // Object representing Webathena session
    var session;

    // Currently logged-in user. (string)
    var username;

    // Public lists
    var lists;

    /*
     * Query the server.
     *
     * @param endpoint endpoint to call, e.g. "/user/reset"
     * @param method method, "GET" or "PUT"
     * @param callback function to call on success; passed the
     *     JSON-decoded response as a single parameter
     */
    function apiQuery( endpoint, method, callback ) {
        $( "#loader" ).removeClass( "hidden" );
        $.ajax({
            type: method,
            url: "./api/v1/" + endpoint + "?webathena=" +
                btoa( sessionStorage.getItem( TICKET_LABEL ) ),
        }).done( function( response ) {
            callback( JSON.parse( response ) );
            $( "#loader" ).addClass( "hidden" );
        }).fail( function ( jqXHR ) {
            alert( "API Error", jqXHR.statusText, "danger" );
            console.log( "Request to API failed:" );
            console.log( jqXHR );
        });
    };
    window.apiQuery = apiQuery;

    /*
     * Display a visual alert to the user.
     *
     * @param title text to prefix the message in bold, or empty
     * @param message the message to display; text only
     * @param type one of "danger", "warning", "info", "success"; controls the
     *        color of the alert
     * @param tag an optional tag, added as a class, to allow for batch
     *        dismissal via $( ".tag" ).alert( "close" );
     * @param unescaped optional, set to true to allow HTML content
     */
    function alert( title, message, type, tag, unescaped ) {
        var element = $( "#alert" ).clone();

        element.prop( "id", "" );
        if ( unescaped ) {
            element.find( ".error-title" ).html( title );
            element.find( ".error-text" ).html( message );
        } else {
            element.find( ".error-title" ).text( title );
            element.find( ".error-text" ).text( message );
        }

        if ( typeof( tag ) !== "undefined" ) element.addClass( tag );
        element.addClass( "alert-" + type );
        element.removeClass( "hidden" );
        $( "#alert" ).before( element );
    }

    /*
     * Update the UI to reflect that the user is logged in.
     *
     * @param session r.session returned by Webathena
     */
    function logMeIn( session ) {
        username = session.cname.nameString[0];
        // Dismiss earlier login errors
        $( ".alert-login" ).alert( "close" );

        // Put email address into relevant divs
        $( ".thisuser" ).text( username + "@mit.edu" );

        // Disable login button, just in case
        $( "#login" ).attr( "disabled", true);
        $( "#login" ).text( LOGIN_ONGOING );

        // Query to load results from API
        apiQuery("public_lists", "GET", function( response ) {
            console.log(response);
            //updateUI( response );
            $( "#landing" ).addClass( "hidden" );
            $( "#app" ).removeClass( "hidden" );
        });
    }

    function subscribe( list, callback ) {
        apiQuery("list/" + list + "/" + username, "PUT", function( response ) {
            alert( "", response.msg, response.status );
            callback();
        });
    }

    function unsubscribe( list, callback ) {
        apiQuery("list/" + list + "/" + username, "DELETE", function() {
            alert( "", "Unsubscribed from " + list, "success" );
            callback();
        });
    }

    function fetchLists() {
        apiQuery("public_lists", "GET", function( response ) {
            lists = response;
            for (var n = 0; n < 5; n++) {
                addListListItem(randomList());
            }
            $( "#randsub" ).removeClass( "hidden" );
        });
    }

    // Adds an item to the list of lists
    function addListListItem( listname ) {
        var element = $( "#list" ).clone();
        element.prop( "id", "" );

        element.find( ".list-name" ).text(listname);
        var link = "https://groups.mit.edu/webmoira/list/" +
            encodeURIComponent(listname);
        element.find( "a.webmoira-link" ).attr("href", link);

        element.find( ".subscribe" ).click(function( event ) {
            event.preventDefault();
            var button = $( this );
            handleLoginButton(button, SUBSCRIBE_ACTION, function() {
                button.text( SUBSCRIBE_ONGOING );
                subscribe( listname,  function() {
                    element.remove();
                    addListListItem( randomList() );
                });
            });
            
        });

        element.removeClass( "hidden" );
        $( "#list" ).after( element );
    }

    function randomList() {
        return lists[Math.floor(Math.random() * lists.length)];
    }

    /* Button Handlers */
    $( "#random" ).click( function( event ) {
        event.preventDefault();
        if (!lists) {
            return;
        }
        var button = $( this );
        handleLoginButton(button, RANDOM_ACTION, function() {
            button.text( RANDOM_ONGOING );
            subscribe( randomList(),  function() {
                button.text( RANDOM_ACTION );
                button.attr( "disabled", false );
            });
        });
    });

    function handleLoginButton( button, original_text, callback ) {
        button.attr( "disabled", true );
        button.text( LOGIN_ONGOING );

        if (username) {
            callback();
            return;
        }

        WinChan.open({
            url: WEBATHENA_HOST + "/#!request_ticket_v1",
            relay_url: WEBATHENA_HOST + "/relay.html",
            params: {
                realm: REALM,
                principal: PRINCIPAL
            }
        }, function( err, r ) {
            if ( err ) {
                button.attr( "disabled", false );
                button.text( original_text );

                console.log( "Webathena returned err: " + err );
                if ( err.indexOf( "closed window" ) != -1 ) {
                    // User closed Webathena window. Take no action.
                } else {
                    alert( "Achtung!",
                           "An error occurred while communicating with Webathena.",
                           "danger", "alert-login" );
                }
                return;
            }
            if ( r.status !== "OK" ) {
                button.attr( "disabled", false );
                button.text( original_text );

                console.log( "Webathena returned r (" + r.status + "}:");
                console.log( r );
                if ( r.status == "DENIED" ) {
                    alert( "Login Failed.",
                           "I need \"mailing lists and groups\" access in order " +
                           "to change your forwarding settings.",
                           "warning", "alert-login");
                } else {
                    alert( "Achtung!",
                           "An error occurred while communicating with Webathena.",
                           "danger", "alert-login" );
                }
                return;
            }

            // Success! Put session information into a cookie and update UI
            console.log( "Login succeeded." );
            sessionStorage.setItem( TICKET_LABEL, JSON.stringify( r.session ) );
            logMeIn( r.session );
            callback();
        });
    }

    /* On Load: Initialize Page */
    fetchLists();

    /* Load Session, if any */
    session = JSON.parse( sessionStorage.getItem( TICKET_LABEL ) );
    if ( session !== null ) {
        console.log( "Loading session from storage..." );
        logMeIn( session );
    }
})();
