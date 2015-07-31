/******** index.js ***************/
var http = require('http');
var url = require('url');
var fs = require('fs');

//coding 环境不用跑静态页面，需要在 coding 项目里面配置环境变量 CODING = 1
start();

function start(){
    var server = http.createServer(onRequest);
    server.listen( 80 );
    
    function onRequest(request,response){

            client_path = decodeURI( request.url ).replace(/\?.*$/,'');
            server_path = '.' + client_path;

            fs.readFile( server_path, 'binary', function(err,file){
            if(err){
                if( err.code == "EISDIR" ){
                    //是文件目录
                    var content = fs.readdirSync( server_path );
                    content = content.map(function( filename ){
                        var href = client_path + "/" +　filename;
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
                    'jpeg':'image/jpeg',
                    'svg':'image/svg+xml'
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

/******** SmartSocket.js *********/

var WebSocketServer = require('ws').Server,
    wss = new WebSocketServer( 8666 );

var users = {};

// if(process.env.CODING){
//     console.log( 'Websocket server ready...')
//     console.log( process.env.PORT );
// }

var dataContext = remoteDataFactory(function($scope){

    //欢迎光临
    $scope.welcomeMsg = 'Hello World!';

    $scope.time = new Date().valueOf();

    $scope.usersCount = 0;

    setInterval(function(){
        $scope.time = new Date().valueOf();

        $scope.usersCount = function(){
            var count = 0;
            for( i in users ){
                count ++;
                console.log(i);
            }
            return count;
        }();

    },1000);
});

wss.on('connection', function(ws) {
    var userId = idFactory();
    users[userId] = ws;

    ws.on('message', function(message) {

        if( dataContext.$checkMessage(ws,message) ){
            return '检查到数据，已经交由 dataContext 处理';
        }

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

// databind.js use like angular.controller
function remoteDataFactory(link){
    var handlers = {};

    var $scope = {
        $on: $on,
        $off: $off,
        $eval: $eval,
        $connect: $connect,
        $checkMessage: $checkMessage,
        $upgradeProperty: $upgradeProperty
    };

    link($scope);

    for(key in $scope){
        if( typeof $scope[key] === 'function' ){
            continue;
        }

        $scope.$upgradeProperty( key );
    }

    function $upgradeProperty( key ){
        this['$$'+key] = this[key];
        this['$$'+key+'timer'] = 0;

        this.__defineGetter__(key, function(){
            var val = this['$$'+key];
            // console.log(key, val);
            handlers[key+'get'] && handlers[key+'get'].forEach(function(handler){
                handler( val );
            });

            return this['$$'+key];
        });

        this.__defineSetter__(key, function(x){

            // console.log(key, x);

            var oldVal = this['$$'+key];
            var newVal = x;

            if( newVal !== oldVal ){

                //防止数据过度更新造成的网路上的数据震荡

                clearTimeout( this['$$'+key+'timer'] );
                this['$$'+key+'timer'] = setTimeout(function(){
                    //$scope Fucking this
                    $scope['$$'+key] = newVal;
                    handlers[key+'set'] && handlers[key+'set'].forEach(function(handler){
                        handler(newVal, oldVal);
                    });
                },300);
            }
        });
    }

    function $on(eventType, key, handler){
        handlers[key+eventType] = handlers[key+eventType] || [];
        handlers[key+eventType].push( handler );
    }

    function $off(eventType, key, handler){
        // console.log( key+eventType );
        var index = handlers[key+eventType].indexOf(handler);
        // console.log( index );
        if(index > -1){
            handlers[key+eventType].splice( index ,1 );
            return true;
        }else{
            return false;
        }
    }

    function $checkMessage(user, message){
        var message = JSON.parse(message);

        //来自客户端的监听请求
        if( message.$watch ){
            dataContext.$connect( user, message );
            return true;
        }
        // 来自客户端的执行请求
        if( message.$eval ){
            dataContext.$eval( user, message );
            return true;
        }

        //没有检查到数据
        return false;
    }

    function $connect(user, message){
        var remoteData = message.$watch;

        //预处理数据属性
        if( !this.hasOwnProperty(remoteData) ){
            // console.log('没有找到相关属性');
            this[remoteData] = '';
            this.$upgradeProperty( remoteData );
        }else{
            // console.log('找到相关属性');
            // console.log('当前值是 ' + remoteData + ' : ' + this[remoteData]);
        }

        //装载监听 watchList[ remoteData ] = callbackId
        //收到变化的时候，需要把 callbackId 回传
        //方便客户端调用相关回调函数，从而实现更新数据
        user[ 'watchList:' + remoteData ] = message.$callback;


        user[ 'watchList' ] = user[ 'watchList' ] || [];

        //这一行属于傻逼的垃圾回收极致
        user[ 'watchList' ].push( setHandler );

        function setHandler(newVal, oldVal){

            var cbid = user[ 'watchList:' + remoteData ];
            try{
                cbid && user.send( JSON.stringify({
                    $result: newVal,
                    $callback: cbid
                }) );
            }catch(err){
                //用户已经挂逼了，回收垃圾
                // console.log( '挂逼了一个', user );

                //这里设置了一个傻逼的垃圾回收机制，有空再来收拾，Fuck
                for( i in user ){
                    if( /watchList\:/.test(i) ){
                        for( handler in user['watchList'] ){
                            $scope.$off('set', i.replace('watchList:',''), user['watchList'][handler] )
                        }
                    }
                }

                // console.log( handlers );

                delete user;
            }
        }
       
        $scope.$on('set', remoteData, setHandler);

        var result;
        with( dataContext ) result = eval( remoteData );
        message.$result = result;
        user.send( JSON.stringify(message) );

        return;
    }

    function $eval(user, message){
        var result;
        try{
            with( dataContext ) result = eval( message.$eval );
        }catch(err){
            message.$err = err.toString();
        }
        message.$result = result;
        user.send( JSON.stringify(message) );

        return;
    }

    return $scope;
}














