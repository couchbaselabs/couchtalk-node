# CouchTalk
## Push To Talk example app

CouchTalk is an example app showing off node.js with Couchbase Server. To run the app, do this:

    git clone
    cd couchtalk-nodejs
    npm install
    node lib/server.js

The last command will launch the server.

## Contributing

If you edit the files under `lib/` or `page/` you need to run this to get the changes to show up.

    npm install -g grunt
    grunt dev

This will repackage the assets and launch the server in the background. It also watches the source files for changes and regenerates the assets.
