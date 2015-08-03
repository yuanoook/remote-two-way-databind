// Mini query
+function(window){
    var $cache = {};

    window.$ = $;

    function $(elem){
        /* 函数部分 */
        if(typeof elem=='function'){
            if( document.readyState == 'complete' ){
                return elem();
            }else{
                return window.addEventListener('load',elem); 
            }
        }

        /* 选择器部分 */
        if(typeof elem=='string'){
            if( /^<.*>$/.test(elem) ){
                //创建新元素
                var nodeType = elem.replace(/^<(.*)>$/,'$1');
                var node = window.document.createElement( nodeType );
                return $(node);
            }else{

                //建立缓存机制
                if( $cache[elem] ){
                    return $cache[elem];
                }

                var node = window.document.querySelector(elem);
                var result = $(node);
                $cache[elem] = result;

                return result;
            }
        }

        if( elem._isMiniQueryObj_ ){
            return elem;
        }else{
            return new $$(elem);
        }
    }//$ end

    function $$(elem){
        this._isMiniQueryObj_ = true;
        this.originalElement = elem;
        this.eventAndHandlers = {};
    }

    $$.prototype.html = function () {
        if(arguments[0]){
            this.originalElement.innerHTML = arguments[0];
            return this;
        }else{
            return this.originalElement.innerHTML;
        }
    }

    $$.prototype.val = function () {
        if(arguments.length>0){
            this.originalElement.value = arguments[0];
            return this;
        }else{
            return this.originalElement.value;
        }
    }

    $$.prototype.css = function () {
        if (arguments.length == 1){       
            if (typeof arguments[0] == 'string'){
                return this.originalElement.style[arguments[0]] || getComputedStyle(this.originalElement)[arguments[0]];
            }
            if (typeof arguments[0] == 'object') {
                for (i in arguments[0]) {
                    this.originalElement.style[i] = arguments[0][i]
                }
                return this;
            }
        } else if (arguments.length == 2) {
            this.originalElement.style[arguments[0]] = arguments[1];
            return this;
        }
    }

    $$.prototype.cssInit = function () {
        this.css({
            margin: 0,
            padding: 0,
            border: 0,
            overflow: 'hidden',
            boxSizing: 'border-box'
        });

        return this;
    }
 
    $$.prototype.attr = function () {
        if (arguments.length == 1) {
            if (typeof arguments[0] == 'string') return this.originalElement.getAttribute(arguments[0]);
            if (typeof arguments[0] == 'object') {
                for (i in arguments[0]) {
                    this.originalElement.setAttribute(i, arguments[0][i])
                }
                return this;
            }
        } else if (arguments.length == 2) {
            this.originalElement.setAttribute(arguments[0], arguments[1]);
            return this;
        }
    }

    $$.prototype.hasClass = function(){
        return this.originalElement.classList.contains( arguments[0] );
    }

    $$.prototype.removeClass = function(){
        this.originalElement.classList.remove( arguments[0] );
        return this;
    }

    $$.prototype.addClass = function(){
        this.originalElement.classList.add( arguments[0] );
        return this;
    }

    $$.prototype.toggleClass = function(){
        this.originalElement.classList.toggle( arguments[0] );
        return this;
    }

    $$.prototype.append = function(elem){
        this.originalElement.appendChild(
            elem._isMiniQueryObj_ ? elem.originalElement : elem
        );
        return this;
    }

    $$.prototype.appendTo = function(elem){
        $(elem).append(this);
        return this;
    }

    $$.prototype.remove = function(){
        this.originalElement.parentElement.removeChild( this.originalElement );
        delete this;
        return;
    }

    $$.prototype.on = function () {
        var that = this;
        var eventTypes = arguments[0].split(' ');

        // selector 判断
        var selector = typeof arguments[1] === 'string' ? arguments[1] : '';
        var nextIndex = !selector ? 1 : 2;

        var handler = arguments[nextIndex++];
        var useCapture = arguments[nextIndex++] || false;

        eventTypes.forEach(function (eventType) {

            var handlerKey = eventType+useCapture+'__'+selector;
            // $.on 和实际元素事件监听的处理，只需要调起一次，根据是 eventType
            if( !that.eventAndHandlers[handlerKey] ){
                that.originalElement.addEventListener(eventType, function(event){
                    that.eventAndHandlers[handlerKey].forEach(function(handler){
                        if( selector && [].indexOf.call( that.originalElement.querySelectorAll(selector), event.target ) > -1 ){
                            handler.call( $(event.target), event);
                        }else{
                            handler.call( that, event);
                        }
                    });
                });
            }

            that.eventAndHandlers[handlerKey] = that.eventAndHandlers[handlerKey] || [];
            that.eventAndHandlers[handlerKey].push(handler);

        });

        return this;
    }

    $$.prototype.off = function(){

        var evtType = arguments[0];
        // selector 判断
        var selector = typeof arguments[1] === 'string' ? arguments[1] : '';
        var nextIndex = !selector ? 1 : 2;
        var handler = arguments[nextIndex++];
        var useCapture = arguments[nextIndex++] || false;

        var handlerKey = evtType+useCapture+'__'+selector;

        if(evtType && !handler){
            this.eventAndHandlers[handlerKey].length = 0;
            return this;
        }

        if(evtType && handler){
            var index = this.eventAndHandlers[handlerKey].indexOf( handler );
            this.eventAndHandlers[handlerKey].splice(index,1);
            return this;
        }

        for(eventType in this.eventAndHandlers){
            this.eventAndHandlers[eventType+useCapture].length = 0;
        };

        return this;
    }
}(window);

// HtmlStateMachine.js State Machine
+function(window){
    window.htmlStateMachine = {
        changeState: changeState
    }

    function changeState(who,status){
        var classList = document.documentElement.classList;
        for( i=classList.length-1; i>=0; i-- ){
            classList[i].indexOf( who + '-' ) === 0 && Array.prototype.splice.call(classList,i,1);
        }
        classList.add( who + '-' + status );
    }
}(window);

// smartSocket.js dependences: HtmlStateMachine.js
+function(window){
    /*
        很大部分工作都是为了保证数据畅通
        特别是断开连接和重新连接的时候保证数据不会丢失
    */
    var connectTasks = [];
    var tasks = [];
    var listeners = [];
 
    window.smartSocket = socketFactory();
 
    function socketFactory() {
        //这里的 url 配置和服务器端的配置是相对应的，服务器端是用的 http 服务和 websocket 服务共享端口的模式
        var url = 'ws://' + location.host;
        var socket = new WebSocket( url );
 
        socket.sendOriginal = socket.send;
        socket.send = function (data) {
            data = typeof data == 'string' ? data : JSON.stringify(data);
            if (socket.readyState == 1) {
                socket.sendOriginal(data);
            } else {
                tasks.push(data);
            }
        }

        socket.connectSend = function(data) {
            data = typeof data == 'string' ? data : JSON.stringify(data);
            if (socket.readyState == 1) {
                socket.sendOriginal(data);
            }
            connectTasks.push(data);
        }
 
        socket.addEventListener('message', function (event) {
            var data = event.data;
            data = typeof data == 'string' ? JSON.parse(data) : data;
            listeners.forEach(function(listener){
                listener( data );
            });
        });

        socket.onopen = function () {
            htmlStateMachine.changeState('websocket','open');

            while( tasks.length ){
                socket.sendOriginal( tasks.pop() );
            }
            for( i in connectTasks ){
                socket.sendOriginal( connectTasks[i] );
            }
        }
        socket.listen = function (func) {
            listeners.push( func );
        }
        socket.onclose = function () {
            htmlStateMachine.changeState('websocket','close');

            setTimeout(function () {
                window.smartSocket = socketFactory();
            }, 1000);
        }
 
        return socket;
    };
}(window);

// coAct.js dependencies:smartSocket.js
+function(window){
    /* coAct 动作管理员 */
    window.coAct = {};

    /* actLiberay 搜录的动作 */
    coAct.actLiberay = {};

    /* actHistory 动作历史历史 */
    coAct.actHistory = [];

    coAct.watch = function (actType) {
        readyOnce();

        /* initial */
        var obj = actType.obj;
        var actName = actType.actName;
        var chatroom_actTypeId = actType.actTypeId || coAct.idFactory();
        var transfer = actType.transfer || function (data){ return data };
        var cover = !!actType.cover;
        
        /* save */
        this.actLiberay[chatroom_actTypeId] = 
        {
            obj: obj,
            actName: actName,
            cover: cover
        }

        /* upgrade */
        obj[actName + '_Original'] = obj[actName];
        obj[actName] = function () {

            var localAct = {
                chatroom_actTypeId: chatroom_actTypeId,
                args: arguments,
                _id: coAct.idFactory()
            }

            smartSocket.send( localAct );

            var result = coAct.does( localAct );

            return transfer(result);
        }
    }

    coAct.idFactory = function(){
        return ( new Date().valueOf() + '' + Math.random() ).replace(/(\d*\.\d{2})\d*$/,'$1');
    }

    coAct.does = function(act, isHistory){
        var actExist = false;

        /* 如果不是动作，略过 */
        if( !act.chatroom_actTypeId ) return null;

        var chatroom_actTypeId = act.chatroom_actTypeId;
        var args = act.args;

        var actNote= this.actLiberay[ chatroom_actTypeId ];
        if( !actNote ) return;

        var obj = actNote.obj;
        var actName = actNote.actName;
        var cover = actNote.cover;

        /* 添加到历史记录，选择性覆盖 */
        for( var i=this.actHistory.length; i--; i>=0 ){
            if( this.actHistory[i]['chatroom_actTypeId'] == chatroom_actTypeId ){
                if(cover) this.actHistory.splice(i,1);
            }

            if( this.actHistory[i]['_id'] === act._id ){
                actExist = true;
            }
        }

        if( actExist ) return;

        this.actHistory.push( act );
        
        /* 把参数升级为 类数组 */
        makeLikeArray( args );
        [].push.call( args, isHistory );

        return obj[ actName + '_Original' ].apply( obj, args );
    }

    function makeLikeArray( obj ){
        if( typeof obj.length === 'undefined' ){
            for(var i = 0; typeof obj[i] !== 'undefined' ; i++ ){
                obj.length = ( i+1 );
            }
        }
    }

    function readyOnce(){

        var birthtime = new Date().valueOf();
        var resHistoryTimer;
        var iNeedActHistroy = true;
        var iCanResHistory = false;

        /* 收听远程行为 */
        smartSocket.listen(function (remoteAct) {
            /* 如果不是动作，略过 */
            if( !remoteAct.chatroom_actTypeId ) return;
            coAct.does( remoteAct );
        });

        /* 请求动作历史 */
        smartSocket.send({
            chartroom_queryHistory: 'chatroom_chartroom_queryHistory'
        });

        /* 10 秒钟之后，不管如何，有权响应历史请求 */
        setTimeout(function(){
            iCanResHistory = true;
        },10000);

        /* 有人广播历史动作后，做出响应 */
        smartSocket.listen(function (res) {
            if( !res.chatroom_resHistory ) return;

            /* 如果我的没有别人的历史更长，就 shut up  TODO: 或许我还应该更新自己的版本 */
            if( res.birthtime <= birthtime ){
                clearTimeout( resHistoryTimer );
            }

            if( iNeedActHistroy ){
                /* 如果是我我需要的请求 */
                iNeedActHistroy = false;

                res.actHistory.forEach(function( historyAct ){
                    /* TODO 第二参数 是否是历史数据，参数做迁移和调整 */
                    coAct.does( historyAct, true );
                });

                iCanResHistory = true;
                birthtime = res.birthtime;
            }
        })

        /* 收到查询请求，做出援助响应 */
        smartSocket.listen(function (query) {
            /* 如果不是动作历史请求，略过 */
            if( !query.chartroom_queryHistory ) return;

            if( !iCanResHistory ){
                /* 如果我没有响应能力，shut up */
                return;
            }

            /* 准备随机抢答广播 */
            var resHistoryTimer = setTimeout(function(){
                smartSocket.send({
                    chatroom_resHistory: 'chatroom_resHistory',
                    birthtime: birthtime,
                    actHistory: coAct.actHistory
                });
            }, Math.random()*1000 );
        })

        readyOnce = function(){};
    }
}(window);

// smartBacker.js dependences: smartsocket.js
// 回调函数处理机制
+function(){
    var callbackList = {
        add: function( call ){
            var id = idFactory();
            this[id] = call;
            return id;
        },
        get: function( id ){
            return this[id];
        },
        call: function( id, msg ){
            if( typeof this[id] === 'function' ){
                return this[id]( msg );
            }
        }
    }

    //这里的设定是这样的
    //一个远程回调函数管理员
    //传进 id ，返回 函数
    //传进 函数，返回 id
    window.smartBacker = function(){
        if( typeof arguments[0] === 'string' ){
            return callbackList.get( arguments[0] );
        }
        if( typeof arguments[0] === 'function' ){
            return callbackList.add( arguments[0] );
        }
    }

    smartSocket.listen(function(msg){
        var cbid = msg.$callback;
        return cbid && callbackList.call(cbid, msg);
    });

    function idFactory(){
        return ( new Date().valueOf() + '' + Math.random() ).replace(/^(\d*\.\d{6}).*$/,'$1');
    }
}();

// databind.js use like angular.controller
+function(window){
    window.App = {
        controller: controller
    }

    function controller(ctrlName,link){
        var handlers = {};

        var $scope = {
            $on: $on,
            $off: $off,
            $apply: $apply,
            $connect: $connect,
            $upgradeProperty: $upgradeProperty
        };

        var ctrlDiv = $('[rg-controller='+ctrlName+']');

        ctrlDiv.originalElement.scope = function(){ return $scope };
        var templateTextNodes = getTemplateNodes( ctrlDiv.originalElement );
        templateTextNodes.forEach(function(node){
            node.rgTemplate = node.nodeValue;
        });

        link($scope);


        for(key in $scope){
            if( typeof $scope[key] === 'function' ){
                continue;
            }

            $scope.$upgradeProperty( key );
        }

        $apply();

        //事件绑定
        ctrlDiv.on('click','[rg-click]',function(event){
            with($scope) eval( this.attr('rg-click') );
        });
        ctrlDiv.on('change keyup','[rg-model]',function(event){
            var value = this.val();
            //如果不是数字，转换为字符串
            (value === '' || +value != value) && (value = '"' + value + '"');
            var varName = this.attr('rg-model');
            with($scope) eval( varName + '=' + value );
        });
        [].forEach.call(ctrlDiv.originalElement.querySelectorAll('[rg-model]'),function(input){
            $(input).on('focus',function(event){
                this.addClass('rg-lock');
            });
            $(input).on('blur',function(event){
                this.removeClass('rg-lock');
            })
        });

        function $on(eventType, key, handler){
            handlers[key+eventType] = handlers[key+eventType] || [];
            handlers[key+eventType].push( handler );
        }

        function $off(eventType, key, handler){
            var index = handlers[key+eventType].indexOf(handler);
            if(index > -1) handlers[key+eventType].splice( index ,1 );
        }

        function $upgradeProperty( key ){
            this['$$'+key] = this[key];

            Object.defineProperty(this, key, {
                get: function () {
                    var val = this['$$'+key];
                    handlers[key+'get'] && handlers[key+'get'].forEach(function(handler){
                        handler( val );
                    });

                    return this['$$'+key];
                },
                set: function (x) {
                    var oldVal = this['$$'+key];
                    var newVal = x;

                    if( newVal !== oldVal ){
                        this['$$'+key] = newVal;

                        handlers[key+'set'] && handlers[key+'set'].forEach(function(handler){
                            handler(newVal, oldVal);
                        });
                    }

                    this.$apply();
                },
                enumerable: true,
                configurable: true
            });
        }

        //绑定远程变量 dependences: smartSocket.js smartBacker.js
        function $connect(localName, remoteName){
            var context = this;

            //预处理数据属性
            if( !this.hasOwnProperty(localName) ){
                this[localName] = '';
            }

            // $callback 是一个附加参数 id
            // 服务器端会原样返回
            // smartBacker 会自动接收 smartSocket的消息，并且执行回调
            smartSocket.connectSend({
                $watch: remoteName,
                $callback: smartBacker(function( msg ){
                    var err = msg.$err;
                    var result = msg.$result;

                    if(err){ alert(err) };
                    with(context) eval( localName + '=' + JSON.stringify(result) );
                })
            });

            context.$on('set', localName, function(newVal, oldVal){
                smartSocket.send({
                    $eval: remoteName + '=' + JSON.stringify( newVal ),
                    $callback: smartBacker(function( msg ){
                        msg.$err && alert( msg.$err );
                    })
                });
            });
        }

        //数据更新
        function $apply(){
            templateTextNodes.forEach(function(node){
                node.nodeValue = node.rgTemplate.replace(/\{\{(.+?)\}\}/g,function(all,$1){
                    with($scope) return eval($1);
                });
            });
            [].forEach.call( ctrlDiv.originalElement.querySelectorAll('[rg-model]'), function(input){
                if( !$(input).hasClass('rg-lock') ){
                    with($scope) $(input).val( eval( $(input).attr('rg-model') ) );
                }
            });
        };
    }

    function getTemplateNodes(node){
        var allTextNodes = getAllTextNodeChilds( node );

        var templateTextNodes = [].filter.call(allTextNodes,function(node){
            return /\{\{(.+?)\}\}/.test( node.nodeValue );
        });

        return templateTextNodes;

        function getAllTextNodeChilds(node){
            var allElementChildren = node.querySelectorAll(':not(script):not(style)');
            var allChildren = [].reduce.call( allElementChildren, function(x,y){
                return x.concat( [].map.call(y.childNodes,function(node){
                    return node;
                }) );
            }, []);
            var allTextNodes = allChildren.filter(function(node){
                return node.nodeName === '#text';
            });
            return allTextNodes;
        }
    }
}(window);