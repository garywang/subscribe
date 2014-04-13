(function() {
    var WEBATHENA_HOST = "https://webathena.mit.edu";
    var REALM = "ATHENA.MIT.EDU";
    var PRINCIPAL = [ "moira", "moira7.mit.edu" ];

    var LOGIN_ACTION = "Log In with Webathena";
    var LOGIN_ONGOING = "Logging In...";

    var OPTION_SPLIT = "In addition";
    var OPTION_REPLACE = "Instead";
    var OPTION_REPLACE_MULTIPLE = "Instead of ";

    // Object representing Webathena session
    var session;

    // Currently logged-in user. (string)
    var username;

    // Ordered list of enabled mailboxes. (list of objects)
    var mailboxes;

    // Index of mailbox to replace, or -1 to split. (integer)
    var boxToReplace;

    /*
     * Query the server.
     *
     * @param endpoint endpoint to call, e.g. "/user/reset"
     * @param method method, "GET" or "PUT"
     * @param callback function to call on success; passed the
     *     JSON-decoded response as a single parameter
     */
    function apiQuery( endpoint, method, callback ) {
        console.log( "Query to: " + endpoint );
        $.ajax({
            type: method,
            url: "./api/v1/" + endpoint + "?webathena=" +
                btoa( sessionStorage.getItem( "webathena" ) ),
        }).done( function( response ) {
            callback( JSON.parse( response ) );
        }).fail( function ( jqXHR ) {
            alert( "API Error", jqXHR.statusText, "danger" );
            console.log( "Request to API failed:" );
            console.log( jqXHR );
        });
    };

    /*
     * Display a visual alert to the user.
     *
     * @param title text to prefix the message in bold, or empty
     * @param message the message to display; text only
     * @param type one of "danger", "warning", "info", "success"; controls the
     *        color of the alert
     * @param an optional tag, added as a class, to allow for batch dismissal
     *        via $( ".tag" ).alert( "close" );
     */
    function alert( title, message, type, tag ) {
        var element = $( "#alert" ).clone();

        element.prop( "id", "" );
        element.find( ".error-title" ).text( title );
        element.find( ".error-text" ).text( message );

        if ( typeof( tag ) !== "undefined" ) element.addClass( tag );
        element.addClass( "alert-" + type );
        element.removeClass( "hidden" );
        $( "#alert" ).after( element );
    }

    /*
     * Update the UI element displaying the "Instead"/"In addition" message.
     */
    function updateSplitUI() {
        if ( boxToReplace == -1 )
            $( "#split-option" ).text( OPTION_SPLIT );
        else if ( mailboxes.length == 1 )
            $( "#split-option" ).text( OPTION_REPLACE );
        else {
            var humanTypes = { "EXCHANGE" : "Exchange",
                               "IMAP" : "IMAP",
                               "SMTP" : "External" }
            var type = mailboxes[ boxToReplace ].type;
            $( "#split-option" ).text( OPTION_REPLACE_MULTIPLE +
                humanTypes[ type ] );
        }
    }

    /*
     * Show or hide the entry for a single mailbox.
     *
     * @param selector jQuery selector for the mailbox's line
     * @param mailbox object describing mailbox, from server response
     */
    function updateMailboxUI( selector, mailbox ) {
        if ( mailbox == null ) {    // mailbox is hidden
            $( selector ).hide();
            return;
        }

        // otherwise, show mailbox
        $( selector ).show();
        $( selector ).find( ".fwdaddr" ).text( mailbox.address );

        // only show delete button if multiple mailboxes in use
        if ( mailboxes.length == 1 )
            $( selector ).find( ".del" ).hide();
        else
            $( selector ).find( ".del" ).show();
    }

    /*
     * Guess URL of email provider given an email address.
     *
     * @param address address to examine
     * @return hypothesized URL of service provider's login page
     */
    function guessProvider( address ) {
        var suffix = address.split("@")[1];
        return "https://www." + suffix + "/";
    }

    /*
     * Refresh the UI with a de-stringified (dictionary) response from the
     * server.
     *
     * @param response JSON data from server
     */
    function updateUI( response ) {
        // update lastmod UI elements
        $( "#lastmod-time" ).timeago( "update", response.modtime );
        $( "#lastmod-user" ).text( response.modby );

        // extract three mailboxe types from response
        var exchange = null;
        var imap = null;
        var smtp = null;
        for ( var i = 0; i < response.boxes.length; i++ ) {
            if ( !response.boxes[i].enabled )
                continue;

            if ( response.boxes[i].type == "EXCHANGE" )
                exchange = response.boxes[i];
            else if ( response.boxes[i].type == "IMAP" )
                imap = response.boxes[i];
            else if ( response.boxes[i].type == "SMTP" )
                smtp = response.boxes[i];
        }

        // populate global list of mailboxes, in same order as UI list
        mailboxes = new Array();
        for ( var i = 0; i < response.boxes.length; i++ ) {
            if ( response.boxes[i].enabled == false )    continue;
            if ( response.boxes[i].type == "EXCHANGE" )
                mailboxes = mailboxes.concat( [ response.boxes[i] ] );
        }
        for ( var i = 0; i < response.boxes.length; i++ ) {
            if ( response.boxes[i].enabled == false )    continue;
            if ( response.boxes[i].type == "IMAP" )
                mailboxes = mailboxes.concat( [ response.boxes[i] ] );
        }
        for ( var i = 0; i < response.boxes.length; i++ ) {
            if ( response.boxes[i].enabled == false )    continue;
            if ( response.boxes[i].type == "SMTP" )
                mailboxes = mailboxes.concat( [ response.boxes[i] ] );
        }

        // determine if split mailboxes are in use
        var split = ( mailboxes.length > 1 );

        // update UI to display or hide each kind of mailbox
        updateMailboxUI( "#exchange", exchange );
        updateMailboxUI( "#imap", imap );
        updateMailboxUI( "#smtp", smtp );

        // initialize split/replace UI
        boxToReplace = 0;
        updateSplitUI();

        $( "#new-address" ).val("");
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
            apiQuery( username, "GET", function( response ) {
                updateUI( response );
                $( "#landing" ).addClass( "hidden" );
                $( "#app" ).removeClass( "hidden" );
        });
    }

    /* On Load: Initialize Page */
    $( ".timeago" ).timeago();
    $( "#split-option" ).tooltip();

    var login = $( "#login" );
    login.attr( "disabled", false );
    login.text( LOGIN_ACTION );
    $( "#landing" ).removeClass( "hidden" );

    session = JSON.parse( sessionStorage.getItem( "webathena" ) );
    if ( session !== null ) {
        console.log( "Loading session from storage..." );
        logMeIn( session );
    }

    /* Button Handlers */
    login.click( function( event ) {
        event.preventDefault();
	login.attr( "disabled", true );
        login.text( LOGIN_ONGOING );

        WinChan.open({
            url: WEBATHENA_HOST + "/#!request_ticket_v1",
            relay_url: WEBATHENA_HOST + "/relay.html",
            params: {
                realm: REALM,
                principal: PRINCIPAL
            }
        }, function( err, r ) {
            if ( err ) {
                login.attr( "disabled", false );
                login.text( LOGIN_ACTION );

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
                login.attr( "disabled", false );
                login.text( LOGIN_ACTION );

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
            sessionStorage.setItem( "webathena", JSON.stringify( r.session ) );
            logMeIn( r.session );
        });
    });

    $( "#split-option" ).click( function( event ) {
        event.preventDefault();

        boxToReplace++;
        if ( boxToReplace >= mailboxes.length )
            if ( mailboxes.length == 1 )    // only one forwarder
                boxToReplace = -1;          // go back to split
            else                    // multiple forwarders
                boxToReplace = 0;   // only cycle through replacements

        updateSplitUI();
    });

    $( "#restore-default" ).click( function( event ) {
        event.preventDefault();
        apiQuery( username + "/reset", "PUT", updateUI );
    });

    $( "#update-form" ).submit( function( event ) {
        event.preventDefault();

        var newAddress = $( "#new-address" ).val();
        usedAddress = false;

        var query = username + "/";

        if ( newAddress.match(/@EXCHANGE\.MIT\.EDU$/i) ||
             newAddress.match(/@PO.*\.MIT\.EDU$/i) ) {
            query += newAddress + "/";
            usedAddress = true;
        }

        for ( var i = 0; i < mailboxes.length; i++ ) {
            if ( i != boxToReplace )
                query += mailboxes[i].address + "/";
        }

        if ( !usedAddress )
            query += newAddress + "/";
        query = query.substring( 0, query.length - 1 ); // trim trailing slash
        apiQuery( query, "PUT", updateUI );
    });

    var del = function( type ) {
        return function( event ) {
            event.preventDefault();

            var addr = "";
            for ( var i = 0; i < mailboxes.length; i++ )
                if ( mailboxes[i].type != "EXCHANGE" ) {
                    apiQuery( username + "/" + mailboxes[i].address,
                        "PUT", updateUI );
                    return
                }
        };
    }

    $( "#exchange" ).find( ".del" ).click( del( "EXCHANGE" ) );
    $( "#imap" ).find( ".del" ).click( del( "IMAP" ) );
    $( "#exernal" ).find( ".del" ).click( del( "SMTP" ) );
})();
