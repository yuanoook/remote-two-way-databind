var http = require('http');
var url = require('url');
var fs = require('fs');

broadcastPrepare();
start();

function start(){
    var server = http.createServer(onRequest);
    server.listen(8000);
    
    function onRequest(request,response){
            client_path = decodeURI( request.url );
            server_path = '.' + client_path;

            fs.readFile( server_path, 'binary', function(err,file){
            if(err){
                if( err.code == 'EISDIR' ){
                    var content = fs.readdirSync( server_path );
                    content = content.map(function( filename ){
                        var href = client_path + "/" +filename;
                        href = href.replace(/\/+/g,'/');
                        return ( "<a href='" + href + "'>" + filename + "</a>" );
                    }).join('<br/>');

                    return resHtml(response, content);
                }

                return res(response,200,'text/plain',JSON.stringify(err))
            }else{
                var type = {
                    '' : 'text/html',
                    'html': 'text/html',
                    'css': 'text/css',
                    'js' : 'text/javascript',
                    'appcache': 'text/appcache',
                    'png':'image/png',
                    'jpg':'image/jpg',
                    'jpeg':'image/jpeg'
                }[request.url.replace(/^.*\./,'')];

                res(response, 200, type ,file ,true)
            }
        });
    }
}

function resHtml(response, content){
    content =   "<!doctype>\
                <html>\
                <head>\
                    <meta charset='utf-8'>\
                </head>\
                <body>"
                    + content +
                "</body>\
                </html>\
                ";
    res(response, 200, 'text/html' ,content);
}

function res(response,code,content_type,content,isBinary){
    response.writeHead(code, {'Content-Type':content_type});
    isBinary ? response.write(content, 'binary') : response.write(content);
    response.end();
}

// databind.js use like angular.controller
function remoteDataFactory(link){
    var handlers = {};

    var $scope = {
        $on: $on,
        $off: $off
    };

    link($scope);

    for(key in $scope){
        if( typeof $scope[key] === 'function' ){
            continue;
        }

        +function(key){
            $scope['$$'+key] = $scope[key];

            $scope.__defineGetter__(key, function(){
                var val = $scope['$$'+key];
                handlers[key+'get'] && handlers[key+'get'].forEach(function(handler){
                    handler( val );
                });

                return $scope['$$'+key];
            });

            $scope.__defineSetter__(key, function(x){
                var oldVal = $scope.key;
                var newVal = x;

                if( newVal !== oldVal ){
                    $scope['$$'+key] = newVal;

                    handlers[key+'set'] && handlers[key+'set'].forEach(function(handler){
                        handler(newVal, oldVal);
                    });
                }
            });
        }(key);
    }

    function $on(eventType, key, handler){
        handlers[key+eventType] = handlers[key+eventType] || [];
        handlers[key+eventType].push( handler );
    }

    function $off(eventType, key, handler){
        var index = handlers[key+eventType].indexOf(handler);
        if(index > -1) handlers[key+eventType].splice( index ,1 );
    }

    return $scope;
}

function broadcastPrepare(){
    var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer({port: 8666}),
    users = {};

    var dataContext = remoteDataFactory(function($scope){
        $scope.remoteData = 'Hello Wold!';
        $scope.$on('set', 'remoteData', function(newVal, oldVal){
            for( userId in users ){
                var cbid = users[userId][ 'watchList:' + 'remoteData' ];
                cbid && users[userId].send( JSON.stringify({
                    $result: newVal,
                    $callback: cbid
                }) );
            }
        });
    });

    wss.on('connection', function(ws) {
        var userId = idFactory();
        users[userId] = ws;

        ws.on('message', function(message) {
            message = JSON.parse(message);

            //来自客户端的监听请求
            if( message.$watch ){

                //装载监听 watchList[ key ] = callbackId
                //收到变化的时候，需要把 callbackId 回传
                //方便客户端调用相关回调函数，从而实现更新数据
                var key = message.$watch;
                if( !dataContext.hasOwnProperty( key ) ){
                    dataContext[ key ] = '';
                };

                ws[ 'watchList:' + key ] = message.$callback;
  
                var result;
                with( dataContext ) result = eval( key );
                message.$result = result;
                return ws.send( JSON.stringify(message) );
            }

            // 来自客户端的执行请求
            if( message.$eval ){
                var result;
                try{
                    with( dataContext ) result = eval( message.$eval );
                }catch(err){
                    message.$err = err.toString();
                }
                message.$result = result;
                return ws.send( JSON.stringify(message) );
            }

            message = JSON.stringify(message);
            for(userId in users){
                if( users[userId] != ws ) users[userId].send(message);
            }
        });

        ws.on('close', function() {
            delete users[userId];
        });
    });

    function idFactory(){
        return ( new Date().valueOf() + '' + Math.random() ).replace(/^(\d*\.\d{6}).*$/,'$1');
    }
}
