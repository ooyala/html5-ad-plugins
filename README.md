# html5-ad-plugins
Open-source HTML5 ad managers that plug into the Ooyala core HTML5 player.

## Requirements
- Access to the Ooyala player. To know more, visit: [www.ooyala.com](http://www.ooyala.com)
- Hosting of the html5-ad-plugins repository located at https://github.com/ooyala/html5-ad-plugins

## Repo setup step

- cd [path to repo parent folder]
- git clone [git hub repo location]
- cd ./html5-ad-plugins
- git pull
- git submodule init
- git submodule update
- npm install
- npm update


## Building the ad managers
gulp build
or
gulp (it defaults to build)

## Running unit tests
gulp test

## Example test page
The following example assumes that you hare hosting the html5-skin repo at http://localhost:8080/skin and that you are hosting this repo at http://localhost:8080/ad-plugins.
```javascript
<html>
  <head>
    <script language="javascript" src="//player.ooyala.com/v3/6440813504804d76ba35c8c787a4b33c?debug=true&platform=html5"></script>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/react/0.12.2/react.js"></script>
    <link rel="stylesheet" href="http://localhost:8080/skin/assets/styles.css"/>
    <script src="http://localhost:8080/skin/build/html5-skin.js"></script>
    <script src="http://localhost:8080/ad-plugins/managers/ad-manager-vast.js"></script>
  </head>
  <body>
    <div id='container' style='width:640px;height:480px'></div>
    <script>
      var playerParam = {
        layout:'chromeless',
        skin: {
          config: "/skin/config/skin.json"
        },
      };
      OO.ready(function() {
        window.pp = OO.Player.create('container', 'RmZW4zcDo6KqkTIhn1LnowEZyUYn5Tb2', playerParam);
      });
    </script>
  </body>
</html>
```

## Structure and Data Flow


## Developer help tool
You'll need to run a webserver in order to serve the ad_manager_[name].html.
The simplest way to do this is with python's built in server, but you can use any server you like.
To start a python server, cd into the repo directory and run:

    python -m SimpleHTTPServer

You should now be able to load the ad managers by hitting http://localhost:8000/ad_manager_[name].html
where ad_manager_[name].html is the name of each ad manager.

## Publisher and Ooyala Customer
Able to fork git repo and build ad managers at will. Terms and condition apply. Please read [Ooyala open-source onboarding guide](http://www.ooyala.com)
